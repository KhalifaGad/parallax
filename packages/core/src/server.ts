import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { db } from './storage/db.js';
import * as schema from './storage/schema.js';
import { users, connectorCredentials, investigationSessions } from './storage/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { decryptPayload } from './storage/crypto.js';
import { composeMiddleware, RequestContext } from '@parallax/connector-sdk';
import { createPiiRedactorMiddleware } from './middleware/pii-redactor.js';
import { createSharedCacheMiddleware } from './middleware/shared-cache.js';
import { createAuditMiddleware } from './middleware/audit.js';
import { partitionSchema } from './middleware/schema-partition.js';
import { redis } from './storage/redis.js';

// Connectors & Investigation Plugin
import { GcpConnector } from '@parallax/connector-gcp';
import { SentryConnector } from '@parallax/connector-sentry';
import { GithubConnector } from '@parallax/connector-github';
import { createInvestigationTools, createCorrelationMiddleware } from '@parallax/plugin-investigation';
import { ConnectorContext, createToolName } from '@parallax/connector-sdk';

export interface ServerOptions {
  port?: number;
  host?: string;
}

export async function createServer(opts: ServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });

  await app.register(cors, { origin: true });

  // 1. Initialize Connectors
  const gcp = new GcpConnector();
  const sentry = new SentryConnector();
  const github = new GithubConnector();
  const investigationTools = createInvestigationTools({ db, schema, eq, desc });

  const toolRegistry = new Map<string, {
    name: string;
    description: string;
    inputSchema: any;
    handler: (args: any, ctx: any) => Promise<any>;
  }>();

  // Register Investigation tools
  for (const tool of investigationTools) {
    toolRegistry.set(tool.name, {
      name: tool.name,
      description: tool.description,
      inputSchema: (tool.inputSchema as any)._def ? (tool.inputSchema as any) : tool.inputSchema,
      handler: tool.handler,
    });
  }

  // Register GCP tools (gcp__search_logs, etc.)
  for (const tool of gcp.getTools()) {
    const fullName = createToolName('gcp', tool.name);
    toolRegistry.set(fullName, {
      name: fullName,
      description: tool.description,
      inputSchema: tool.inputSchema,
      handler: tool.handler,
    });
  }

  // Register Sentry tools (sentry__search_issues, etc.)
  for (const tool of sentry.getTools()) {
    const fullName = createToolName('sentry', tool.name);
    toolRegistry.set(fullName, {
      name: fullName,
      description: tool.description,
      inputSchema: tool.inputSchema,
      handler: tool.handler,
    });
  }

  // Register GitHub tools (github__list_deployments, etc.)
  for (const tool of github.getTools()) {
    const fullName = createToolName('github', tool.name);
    toolRegistry.set(fullName, {
      name: fullName,
      description: tool.description,
      inputSchema: tool.inputSchema,
      handler: tool.handler,
    });
  }

  // 2. Base Tool Execution Handler
  const baseToolHandler = async (toolName: string, args: Record<string, any>, ctx: RequestContext) => {
    const registered = toolRegistry.get(toolName);
    if (!registered) {
      throw new Error(`Tool "${toolName}" is not registered on Parallax MCP server.`);
    }

    // Build mode-agnostic ConnectorContext
    const connectorCtx: ConnectorContext = {
      teamId: ctx.teamId,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      cache: redis,
      getCredentials: async () => {
        // Extract connector namespace
        const [connectorPrefix] = toolName.split('__');
        const [credRecord] = await db.select().from(connectorCredentials).where(
          and(
            eq(connectorCredentials.teamId, ctx.teamId),
            eq(connectorCredentials.connectorName, connectorPrefix)
          )
        );

        if (credRecord) {
          try {
            return decryptPayload(credRecord.encryptedPayload, credRecord.iv, credRecord.tag);
          } catch (e) {
            console.error('[Crypto] Failed to decrypt credentials:', e);
          }
        }
        return {};
      },
      audit: async () => {},
    };

    return await registered.handler(args, connectorCtx);
  };

  // 3. Composed Middleware Pipeline
  const composedToolPipeline = composeMiddleware(
    createAuditMiddleware(),
    createPiiRedactorMiddleware(),
    createSharedCacheMiddleware(),
    createCorrelationMiddleware(),
  )(baseToolHandler);

  // Health and Discovery Routes
  app.get('/health', async () => ({ status: 'healthy', timestamp: new Date() }));
  app.get('/ready', async () => ({ status: 'ready' }));

  app.get('/.well-known/oauth-protected-resource', async () => ({
    resource: 'http://localhost:3000/mcp',
    authorization_servers: ['http://localhost:3000/oauth'],
    scopes_supported: ['investigation:read', 'investigation:write'],
    bearer_methods_supported: ['header'],
  }));

  // Resolve user authentication from request header
  const resolveAuth = async (req: FastifyRequest): Promise<{ teamId: string; userId: string; userName: string }> => {
    const authHeader = req.headers.authorization;
    let token = 'user_alice_cursor'; // Default fallback for local quickstarts

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    const [user] = await db.select().from(users).where(eq(users.token, token));
    if (user) {
      return { teamId: user.teamId, userId: user.id, userName: user.name };
    }

    // Fallback to first user in database
    const [firstUser] = await db.select().from(users);
    if (firstUser) {
      return { teamId: firstUser.teamId, userId: firstUser.id, userName: firstUser.name };
    }

    throw new Error('No valid user authentication found. Please run "pnpm db:seed".');
  };

  // 4. MCP JSON-RPC Streamable HTTP Transport Handler
  app.post('/mcp', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;
    if (!body || typeof body !== 'object') {
      return reply.code(400).send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    }

    const userAuth = await resolveAuth(req);
    const { method, params, id } = body;

    // Handle MCP Protocol Lifecycle
    if (method === 'initialize') {
      return reply.send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo: {
            name: 'parallax-server',
            version: '0.1.0',
          },
        },
      });
    }

    if (method === 'notifications/initialized' || method === 'ping') {
      return reply.send({ jsonrpc: '2.0', id: id ?? null, result: {} });
    }

    // Handle tools/list with Airis Schema Partitioning
    if (method === 'tools/list') {
      const toolsList = Array.from(toolRegistry.values()).map(tool => {
        let rawSchema: any = { type: 'object', properties: {} };
        if (tool.inputSchema?._def?.shape) {
          const shape = tool.inputSchema._def.shape();
          const props: Record<string, any> = {};
          for (const [k, v] of Object.entries<any>(shape)) {
            props[k] = {
              type: v._def?.typeName === 'ZodString' ? 'string' : (v._def?.typeName === 'ZodNumber' ? 'number' : 'string'),
              description: v.description || '',
            };
          }
          rawSchema = { type: 'object', properties: props };
        } else if (tool.inputSchema?.properties) {
          rawSchema = tool.inputSchema;
        }

        const partitioned = partitionSchema(rawSchema);

        return {
          name: tool.name,
          description: tool.description,
          inputSchema: partitioned,
        };
      });

      return reply.send({
        jsonrpc: '2.0',
        id,
        result: { tools: toolsList },
      });
    }

    // Handle tools/call
    if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      // Detect active session for this team/user
      let activeSessionId: string | undefined = toolArgs?.session_id;
      if (!activeSessionId) {
        const [activeSession] = await db.select({ id: investigationSessions.id })
          .from(investigationSessions)
          .where(eq(investigationSessions.status, 'active'))
          .orderBy(desc(investigationSessions.createdAt));

        if (activeSession) {
          activeSessionId = activeSession.id;
        }
      }

      const reqCtx: RequestContext = {
        teamId: userAuth.teamId,
        userId: userAuth.userId,
        userName: userAuth.userName,
        sessionId: activeSessionId,
        clientName: req.headers['user-agent'] || 'mcp-client',
      };

      try {
        const executionResult = await composedToolPipeline(toolName, toolArgs, reqCtx);
        return reply.send({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: typeof executionResult === 'string' ? executionResult : JSON.stringify(executionResult, null, 2),
              },
            ],
          },
        });
      } catch (err: any) {
        return reply.send({
          jsonrpc: '2.0',
          id,
          isError: true,
          result: {
            content: [
              {
                type: 'text',
                text: `Error executing ${toolName}: ${err.message}`,
              },
            ],
          },
        });
      }
    }

    return reply.code(404).send({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method "${method}" not found.` },
    });
  });

  return app;
}
