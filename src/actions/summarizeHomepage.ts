import { defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { env } from 'cloudflare:workers';
import type { BrowserBinding } from './types';

export const summarizeHomepage = defineAction({
  accept: 'form',
  input: z.object({
    url: z.url('Please enter a valid URL (e.g. https://example.com)'),
  }),
  handler: async ({ url }) => {
    const res = await (env.BROWSER as unknown as BrowserBinding).quickAction('json', {
      url,
      prompt:
        'Write a concise summary (3-5 sentences) of what this homepage communicates to a first-time visitor. Focus on: what the company/product does, who it is for, and the main value proposition. Be objective and direct. Start directly with the summary itself.',
      response_format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
          },
          required: ['summary'],
        },
      },
      gotoOptions: { waitUntil: 'networkidle0', timeout: 30_000 },
    });
    const data = (await res.json()) as { result: { summary: string } };
    return { summary: data.result.summary, url };
  },
});
