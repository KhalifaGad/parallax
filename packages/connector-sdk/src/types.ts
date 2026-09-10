import { z, ZodSchema } from 'zod';
import { ConnectorContext } from './context.js';

export type Capability = 
  | 'logs.search'
  | 'traces.search'
  | 'errors.search'
  | 'deploys.list'
  | 'metrics.query';

export interface CachePolicy {
  ttlSeconds: number;
  varyBy?: string[];
}

export interface NativeTool {
  name: string;
  description: string;
  inputSchema: ZodSchema<any> | Record<string, any>;
  cachePolicy?: CachePolicy;
  correlate?: boolean;
  handler: (args: any, ctx: any) => Promise<any>;
}

export interface ConnectorMeta {
  name: string;
  version: string;
  displayName: string;
  description: string;
  capabilities: Capability[];
}

export interface Connector {
  meta: ConnectorMeta;
  getTools(): NativeTool[];
  healthCheck?(ctx: ConnectorContext): Promise<boolean>;
}

export interface RequestContext {
  teamId: string;
  userId: string;
  userName: string;
  sessionId?: string;
  clientName?: string;
}

export type ToolHandler = (name: string, args: Record<string, any>, ctx: RequestContext) => Promise<any>;
export type Middleware = (next: ToolHandler) => ToolHandler;

export function composeMiddleware(...middlewares: Middleware[]): (base: ToolHandler) => ToolHandler {
  return (baseHandler: ToolHandler) => {
    return middlewares.reduceRight((wrapped, middleware) => middleware(wrapped), baseHandler);
  };
}
