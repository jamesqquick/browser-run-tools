import { defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import puppeteer from '@cloudflare/puppeteer';
import { env } from 'cloudflare:workers';

export const compareViewports = defineAction({
  accept: 'form',
  input: z.object({
    url: z.url('Please enter a valid URL (e.g. https://example.com)'),
  }),
  handler: async ({ url }) => {
    const puppeteerBrowser = await puppeteer.launch(env.BROWSER);
    try {
      const [mobilePage, desktopPage] = await Promise.all([
        puppeteerBrowser.newPage(),
        puppeteerBrowser.newPage(),
      ]);

      await mobilePage.setViewport({ width: 375, height: 812 });
      await desktopPage.setViewport({ width: 1280, height: 720 });

      await Promise.all([
        mobilePage.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 }),
        desktopPage.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 }),
      ]);

      const [mobileShot, desktopShot] = (await Promise.all([
        mobilePage.screenshot({ type: 'png' }),
        desktopPage.screenshot({ type: 'png' }),
      ])) as Buffer[];

      return {
        mobile: mobileShot.toString('base64'),
        desktop: desktopShot.toString('base64'),
        url,
      };
    } finally {
      await puppeteerBrowser.close();
    }
  },
});
