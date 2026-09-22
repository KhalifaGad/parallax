import { Middleware } from './compose.js';
import { db } from '../storage/db.js';
import { auditLogs, sessionEvents } from '../storage/schema.js';

export function createAuditMiddleware(): Middleware {
  return (next) => async (name, args, ctx) => {
    const startTime = Date.now();
    let result: any;
    let error: any;

    try {
      result = await next(name, args, ctx);
      return result;
    } catch (err: any) {
      error = err;
      throw err;
    } finally {
      const durationMs = Date.now() - startTime;
      const isCacheHit = !!result?._cache?.hit;

      try {
        // 1. Immutable Audit Log
        await db.insert(auditLogs).values({
          teamId: ctx.teamId,
          userId: ctx.userId,
          sessionId: ctx.sessionId || null,
          action: 'CALL_TOOL',
          resourceName: name,
          metadata: {
            args,
            durationMs,
            success: !error,
            error: error ? error.message : null,
            cacheHit: isCacheHit,
          },
        });

        // 2. If inside an active investigation session, append to session_events
        if (ctx.sessionId && !name.startsWith('investigation__')) {
          const summaryText = result?.count !== undefined 
            ? `Found ${result.count} items` 
            : result?.summary || `Executed ${name} successfully`;

          await db.insert(sessionEvents).values({
            sessionId: ctx.sessionId,
            userId: ctx.userId,
            toolName: name,
            inputArgs: args,
            outputData: result,
            outputSummary: summaryText,
            cacheHit: isCacheHit,
            durationMs: durationMs.toString(),
          });
        }
      } catch (logErr) {
        console.error('[Audit] Failed to persist audit log:', logErr);
      }
    }
  };
}
