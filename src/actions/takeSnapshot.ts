import { defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { env } from 'cloudflare:workers';
import type { BrowserBinding } from './types';

const VALID_FORMATS = ['content', 'screenshot', 'markdown', 'accessibilityTree'] as const;
type SnapshotFormat = (typeof VALID_FORMATS)[number];

export interface SnapshotResult {
  content?: string;
  screenshot?: string;
  markdown?: string;
  accessibilityTree?: Record<string, unknown>;
}

export const takeSnapshot = defineAction({
  accept: 'form',
  input: z.object({
    url: z.url('Please enter a valid URL (e.g. https://example.com)'),
    formats: z.string().transform((val) => val.split(',').filter(Boolean) as SnapshotFormat[]),
  }),
  handler: async ({ url, formats }) => {
    if (formats.length < 2) {
      throw new Error('At least two formats must be selected.');
    }

    const invalid = formats.filter((f) => !VALID_FORMATS.includes(f));
    if (invalid.length > 0) {
      throw new Error(`Invalid format(s): ${invalid.join(', ')}`);
    }

    const res = await (env.BROWSER as unknown as BrowserBinding).quickAction('snapshot', {
      url,
      formats,
      gotoOptions: { waitUntil: 'networkidle0', timeout: 30_000 },
    });

    const data = (await res.json()) as { result: SnapshotResult };
    return { ...data.result, url, formats };
  },
});
