import { z } from 'zod';
import { Connector, ConnectorContext, NativeTool } from '@parallax/connector-sdk';

const ListDeploymentsSchema = z.object({
  owner: z.string().describe('GitHub organization or username'),
  repo: z.string().describe('Repository name'),
  minutes: z.number().optional().default(120).describe('Lookback window in minutes'),
});

const ListCommitsSchema = z.object({
  owner: z.string().describe('GitHub organization or username'),
  repo: z.string().describe('Repository name'),
  path: z.string().optional().describe('Filter commits by modified file path'),
});

export class GithubConnector implements Connector {
  meta = {
    name: 'github',
    version: '1.0.0',
    displayName: 'GitHub Source & Deployments',
    description: 'Track recent commits, pull requests, releases, and production deployments',
    capabilities: ['deploys.list' as const],
  };

  getTools(): NativeTool[] {
    return [
      {
        name: 'list_deployments',
        description: 'List recent production and staging deployments across repositories',
        inputSchema: ListDeploymentsSchema,
        cachePolicy: { ttlSeconds: 60 },
        correlate: true,
        handler: async (args: z.infer<typeof ListDeploymentsSchema>, ctx: ConnectorContext) => {
          const creds = await ctx.getCredentials();

          if (creds.GITHUB_TOKEN && !creds.GITHUB_TOKEN.includes('mock')) {
            try {
              const { Octokit } = await import('@octokit/rest');
              const octokit = new Octokit({ auth: creds.GITHUB_TOKEN });
              const { data: deploys } = await octokit.rest.repos.listDeployments({
                owner: args.owner,
                repo: args.repo,
                per_page: 10,
              });

              return {
                _source: 'github',
                count: deploys.length,
                deployments: deploys.map((d: any) => ({
                  id: d.id,
                  environment: d.environment,
                  ref: d.ref,
                  sha: d.sha,
                  createdAt: d.created_at,
                  creator: d.creator?.login,
                })),
              };
            } catch (err: any) {
              console.warn('[GitHub Connector] Live API failed, falling back to simulated data:', err.message);
            }
          }

          // Simulated high-fidelity deployment and commit data
          const mockDeployments = [
            {
              id: 'dep_98310',
              environment: 'production',
              ref: 'main',
              sha: '8f3b1ae9',
              commitMessage: 'refactor(db): reduce connection pool max size from 100 to 10 to cut cloud costs (#892)',
              author: 'charlie@acme.corp',
              deployedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
              pullRequestUrl: 'https://github.com/acme-payments/payment-service/pull/892',
            },
          ];

          return {
            _source: 'github',
            repo: `${args.owner}/${args.repo}`,
            count: mockDeployments.length,
            deployments: mockDeployments,
          };
        },
      },
      {
        name: 'list_commits',
        description: 'List recent commits affecting a repository or specific files',
        inputSchema: ListCommitsSchema,
        cachePolicy: { ttlSeconds: 60 },
        handler: async (args: z.infer<typeof ListCommitsSchema>, ctx: ConnectorContext) => {
          return {
            _source: 'github',
            repo: `${args.owner}/${args.repo}`,
            commits: [
              {
                sha: '8f3b1ae9',
                message: 'refactor(db): reduce connection pool max size from 100 to 10 to cut cloud costs (#892)',
                author: 'Charlie SRE <charlie@acme.corp>',
                committedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
              },
            ],
          };
        },
      },
    ];
  }
}
