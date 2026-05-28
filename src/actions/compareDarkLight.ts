import { defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import puppeteer from '@cloudflare/puppeteer';
import { env } from 'cloudflare:workers';

export const compareDarkLight = defineAction({
  accept: 'form',
  input: z.object({
    url: z.url('Please enter a valid URL (e.g. https://example.com)'),
  }),
  handler: async ({ url }) => {
    const puppeteerBrowser = await puppeteer.launch(env.BROWSER);
    try {
      const [lightPage, darkPage] = await Promise.all([
        puppeteerBrowser.newPage(),
        puppeteerBrowser.newPage(),
      ]);

      await Promise.all([
        lightPage.setViewport({ width: 1280, height: 720 }),
        darkPage.setViewport({ width: 1280, height: 720 }),
      ]);

      await Promise.all([
        lightPage.emulateMediaFeatures([
          { name: 'prefers-color-scheme', value: 'light' },
        ]),
        darkPage.emulateMediaFeatures([
          { name: 'prefers-color-scheme', value: 'dark' },
        ]),
      ]);

      await Promise.all([
        lightPage.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 }),
        darkPage.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 }),
      ]);

      const [lightShot, darkShot] = (await Promise.all([
        lightPage.screenshot({ type: 'png' }),
        darkPage.screenshot({ type: 'png' }),
      ])) as Buffer[];

      return {
        light: lightShot.toString('base64'),
        dark: darkShot.toString('base64'),
        url,
      };
    } finally {
      await puppeteerBrowser.close();
    }
  },
});
