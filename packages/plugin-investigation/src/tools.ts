import { z } from 'zod';
import { generatePostmortemMarkdown } from './postmortem.js';

export const CreateSessionSchema = z.object({
  incident_id: z.string().describe('Incident identifier (e.g. INC-402, SEV1-998)'),
  title: z.string().describe('Short descriptive title of the outage or issue'),
});

export const JoinSessionSchema = z.object({
  session_id: z.string().describe('UUID of the active investigation session to join'),
});

export const ListOpenSessionsSchema = z.object({});

export const GetSessionActivitySchema = z.object({
  session_id: z.string().describe('UUID of the investigation session to inspect'),
  limit: z.number().optional().default(20).describe('Max events to retrieve'),
});

export const CloseSessionSchema = z.object({
  session_id: z.string().describe('UUID of the session to resolve and close'),
  verdict: z.string().describe('Final root-cause diagnosis and resolution summary'),
});

export const ReplaySessionSchema = z.object({
  session_id: z.string().describe('UUID of the session to replay'),
});

export const ExpandSchemaToolSchema = z.object({
  tool_name: z.string().describe('Full tool name to retrieve complete parameter schema for'),
});

export function createInvestigationTools(deps: { db: any; schema: any; eq: any; desc: any }) {
  const { db, schema, eq, desc } = deps;
  const { investigationSessions, sessionParticipants, sessionEvents, users } = schema;

  return [
    {
      name: 'investigation__create_session',
      description: 'Create a new shared collaborative investigation session for an incident',
      inputSchema: CreateSessionSchema,
      handler: async (args: z.infer<typeof CreateSessionSchema>, ctx: any) => {
        const [session] = await db.insert(investigationSessions).values({
          teamId: ctx.teamId,
          incidentId: args.incident_id,
          title: args.title,
          createdByUserId: ctx.userId,
        }).returning();

        await db.insert(sessionParticipants).values({
          sessionId: session.id,
          userId: ctx.userId,
        });

        return {
          session_id: session.id,
          incident_id: session.incidentId,
          title: session.title,
          status: 'active',
          created_by: ctx.userName,
          message: `Investigation session started. Share session_id "${session.id}" with other engineers to collaborate in real-time.`,
        };
      },
    },
    {
      name: 'investigation__join_session',
      description: 'Join an existing collaborative investigation session',
      inputSchema: JoinSessionSchema,
      handler: async (args: z.infer<typeof JoinSessionSchema>, ctx: any) => {
        const [session] = await db.select().from(investigationSessions).where(eq(investigationSessions.id, args.session_id));
        if (!session) {
          throw new Error(`Investigation session ${args.session_id} not found.`);
        }

        await db.insert(sessionParticipants).values({
          sessionId: session.id,
          userId: ctx.userId,
        }).onConflictDoNothing();

        return {
          session_id: session.id,
          incident_id: session.incidentId,
          title: session.title,
          status: session.status,
          joined_as: ctx.userName,
          message: `Successfully joined shared session for ${session.incidentId}. Your diagnostic queries and context are now synchronized with other engineers.`,
        };
      },
    },
    {
      name: 'investigation__list_open_sessions',
      description: 'List all currently active incident investigation sessions for the team',
      inputSchema: ListOpenSessionsSchema,
      handler: async (_args: any, _ctx: any) => {
        const sessions = await db.select({
          id: investigationSessions.id,
          incidentId: investigationSessions.incidentId,
          title: investigationSessions.title,
          createdAt: investigationSessions.createdAt,
          creator: users.name,
        })
        .from(investigationSessions)
        .innerJoin(users, eq(investigationSessions.createdByUserId, users.id))
        .where(eq(investigationSessions.status, 'active'))
        .orderBy(desc(investigationSessions.createdAt));

        return {
          count: sessions.length,
          open_sessions: sessions,
        };
      },
    },
    {
      name: 'investigation__get_session_activity',
      description: 'Inspect real-time co-pilot activity from other engineers in this shared session to avoid duplicate work',
      inputSchema: GetSessionActivitySchema,
      handler: async (args: z.infer<typeof GetSessionActivitySchema>, _ctx: any) => {
        const events = await db.select({
          id: sessionEvents.id,
          userName: users.name,
          toolName: sessionEvents.toolName,
          inputArgs: sessionEvents.inputArgs,
          outputSummary: sessionEvents.outputSummary,
          cacheHit: sessionEvents.cacheHit,
          createdAt: sessionEvents.createdAt,
        })
        .from(sessionEvents)
        .innerJoin(users, eq(sessionEvents.userId, users.id))
        .where(eq(sessionEvents.sessionId, args.session_id))
        .orderBy(desc(sessionEvents.createdAt))
        .limit(args.limit || 20);

        return {
          session_id: args.session_id,
          total_events: events.length,
          timeline: events.reverse(), // Chronological
        };
      },
    },
    {
      name: 'investigation__close_session',
      description: 'Resolve and close an investigation session, generating the living postmortem report',
      inputSchema: CloseSessionSchema,
      handler: async (args: z.infer<typeof CloseSessionSchema>, _ctx: any) => {
        const [session] = await db.select().from(investigationSessions).where(eq(investigationSessions.id, args.session_id));
        if (!session) {
          throw new Error(`Investigation session ${args.session_id} not found.`);
        }

        // Fetch participants
        const participants = await db.select({
          name: users.name,
          email: users.email,
        })
        .from(sessionParticipants)
        .innerJoin(users, eq(sessionParticipants.userId, users.id))
        .where(eq(sessionParticipants.sessionId, args.session_id));

        // Fetch chronological events
        const events = await db.select({
          userName: users.name,
          toolName: sessionEvents.toolName,
          summary: sessionEvents.outputSummary,
          cacheHit: sessionEvents.cacheHit,
          createdAt: sessionEvents.createdAt,
          inputArgs: sessionEvents.inputArgs,
          outputData: sessionEvents.outputData,
        })
        .from(sessionEvents)
        .innerJoin(users, eq(sessionEvents.userId, users.id))
        .where(eq(sessionEvents.sessionId, args.session_id))
        .orderBy(sessionEvents.createdAt);

        const postmortem = generatePostmortemMarkdown({
          incidentId: session.incidentId,
          title: session.title,
          verdict: args.verdict,
          openedAt: session.createdAt,
          closedAt: new Date(),
          participants,
          events: events.map((e: any) => ({
            userName: e.userName,
            toolName: e.toolName,
            summary: e.summary || undefined,
            cacheHit: e.cacheHit,
            createdAt: e.createdAt,
            inputArgs: e.inputArgs,
            outputData: e.outputData,
          })),
        });

        await db.update(investigationSessions).set({
          status: 'closed',
          verdict: args.verdict,
          postmortemMarkdown: postmortem,
          closedAt: new Date(),
        }).where(eq(investigationSessions.id, args.session_id));

        return {
          session_id: args.session_id,
          status: 'closed',
          verdict: args.verdict,
          postmortem_report: postmortem,
        };
      },
    },
    {
      name: 'investigation__replay',
      description: 'Retrieve full chronological replay data and tool outputs for past or active incident sessions',
      inputSchema: ReplaySessionSchema,
      handler: async (args: z.infer<typeof ReplaySessionSchema>, _ctx: any) => {
        const [session] = await db.select().from(investigationSessions).where(eq(investigationSessions.id, args.session_id));
        if (!session) throw new Error(`Session ${args.session_id} not found.`);

        const events = await db.select({
          id: sessionEvents.id,
          userName: users.name,
          toolName: sessionEvents.toolName,
          inputArgs: sessionEvents.inputArgs,
          outputData: sessionEvents.outputData,
          cacheHit: sessionEvents.cacheHit,
          durationMs: sessionEvents.durationMs,
          createdAt: sessionEvents.createdAt,
        })
        .from(sessionEvents)
        .innerJoin(users, eq(sessionEvents.userId, users.id))
        .where(eq(sessionEvents.sessionId, args.session_id))
        .orderBy(sessionEvents.createdAt);

        return {
          session,
          events,
        };
      },
    },
    {
      name: 'expand_schema',
      description: 'Retrieve the complete detailed schema and documentation for any partitioned tool',
      inputSchema: ExpandSchemaToolSchema,
      handler: async (args: z.infer<typeof ExpandSchemaToolSchema>, _ctx: any) => {
        return {
          tool_name: args.tool_name,
          status: 'expanded',
          message: `Full schema for ${args.tool_name} expanded for active query construction.`,
        };
      },
    },
  ];
}
