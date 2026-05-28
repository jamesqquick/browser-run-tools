import { defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { env } from 'cloudflare:workers';
import type { BrowserBinding } from './types';

export const takeFullPageScreenshot = defineAction({
  accept: 'form',
  input: z.object({
    url: z.url('Please enter a valid URL (e.g. https://example.com)'),
  }),
  handler: async ({ url }) => {
    const res = await (env.BROWSER as unknown as BrowserBinding).quickAction('screenshot', {
      url,
      screenshotOptions: { fullPage: true },
      viewport: { width: 1280, height: 720 },
      gotoOptions: { waitUntil: 'networkidle0', timeout: 30_000 },
    });
    const buffer = Buffer.from(await res.arrayBuffer());
    const base64 = buffer.toString('base64');
    return { image: base64, url };
  },
});
