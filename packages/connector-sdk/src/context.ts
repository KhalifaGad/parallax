import type { Redis } from 'ioredis';

export interface AuditEvent {
  action: string;
  resourceName: string;
  metadata: Record<string, any>;
}

export interface ConnectorContext {
  teamId: string;
  userId: string;
  sessionId?: string;
  cache: Redis;
  getCredentials(): Promise<Record<string, string>>;
  executeUpstream?(method: string, params: unknown): Promise<unknown>;
  audit(event: AuditEvent): Promise<void>;
}
