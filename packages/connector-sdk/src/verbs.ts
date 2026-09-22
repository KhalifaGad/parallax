import { z } from 'zod';

export const LogsSearchQuerySchema = z.object({
  filter: z.string().describe('Filter query string (e.g. severity>=ERROR, keyword)'),
  minutes: z.number().optional().default(15).describe('Lookback window in minutes'),
  limit: z.number().optional().default(50).describe('Max entries to return'),
});
export type LogsSearchQuery = z.infer<typeof LogsSearchQuerySchema>;

export const ErrorsSearchQuerySchema = z.object({
  query: z.string().describe('Error search query or issue tag'),
  minutes: z.number().optional().default(60).describe('Lookback window in minutes'),
  limit: z.number().optional().default(20).describe('Max issues to return'),
});
export type ErrorsSearchQuery = z.infer<typeof ErrorsSearchQuerySchema>;

export const DeploysListQuerySchema = z.object({
  owner: z.string().describe('Repository owner / organization'),
  repo: z.string().describe('Repository name'),
  minutes: z.number().optional().default(120).describe('Lookback window in minutes'),
  limit: z.number().optional().default(10).describe('Max deployments to return'),
});
export type DeploysListQuery = z.infer<typeof DeploysListQuerySchema>;
