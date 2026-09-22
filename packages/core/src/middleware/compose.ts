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
