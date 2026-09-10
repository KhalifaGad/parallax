import { Middleware } from './compose.js';

const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /(?:bearer\s+[a-zA-Z0-9_\-\.]{20,})/gi, replacement: 'bearer [REDACTED_TOKEN]' },
  { pattern: /(?:AIza[0-9A-Za-z\-_]{35})/g, replacement: '[REDACTED_GCP_KEY]' },
  { pattern: /(?:ghp_[0-9a-zA-Z]{36})/g, replacement: '[REDACTED_GITHUB_TOKEN]' },
  { pattern: /(?:sntrys_[a-zA-Z0-9]{64})/g, replacement: '[REDACTED_SENTRY_TOKEN]' },
  { pattern: /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, replacement: '[REDACTED_EMAIL]' },
  { pattern: /\b(?:\d{4}[ -]?){3}\d{4}\b/g, replacement: '[REDACTED_CREDIT_CARD]' },
  { pattern: /(?:password|secret|api_key|token)\s*[:=]\s*["']?([a-zA-Z0-9_\-\.@#$%^&*!]{8,})["']?/gi, replacement: '$1: [REDACTED_SECRET]' }
];

export function redactString(input: string): string {
  let output = input;
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    output = output.replace(pattern, replacement);
  }
  return output;
}

export function redactObject(obj: any): any {
  if (typeof obj === 'string') return redactString(obj);
  if (Array.isArray(obj)) return obj.map(redactObject);
  if (obj !== null && typeof obj === 'object') {
    const redacted: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      redacted[k] = redactObject(v);
    }
    return redacted;
  }
  return obj;
}

export function createPiiRedactorMiddleware(): Middleware {
  return (next) => async (name, args, ctx) => {
    const result = await next(name, args, ctx);
    return redactObject(result);
  };
}
