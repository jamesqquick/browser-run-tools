import { defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import puppeteer from '@cloudflare/puppeteer';
import { env } from 'cloudflare:workers';

export const server = {
  takeScreenshot: defineAction({
    accept: 'form',
    input: z.object({
      url: z.url('Please enter a valid URL (e.g. https://example.com)'),
    }),
    handler: async ({ url }) => {
      const browser = await puppeteer.launch(env.MYBROWSER);
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });
        const screenshot = (await page.screenshot({ type: 'png' })) as Buffer;
        const base64 = screenshot.toString('base64');
        return { image: base64, url };
      } finally {
        await browser.close();
      }
    },
  }),

  compareViewports: defineAction({
    accept: 'form',
    input: z.object({
      url: z.url('Please enter a valid URL (e.g. https://example.com)'),
    }),
    handler: async ({ url }) => {
      const browser = await puppeteer.launch(env.MYBROWSER);
      try {
        const [mobilePage, desktopPage] = await Promise.all([
          browser.newPage(),
          browser.newPage(),
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
        await browser.close();
      }
    },
  }),

  extractOg: defineAction({
    accept: 'form',
    input: z.object({
      url: z.url('Please enter a valid URL (e.g. https://example.com)'),
    }),
    handler: async ({ url }) => {
      const browser = await puppeteer.launch(env.MYBROWSER);
      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });

        const ogData = await page.evaluate(() => {
          const getMeta = (property: string): string | null => {
            const el =
              document.querySelector(`meta[property="${property}"]`) ??
              document.querySelector(`meta[name="${property}"]`);
            return el?.getAttribute('content') ?? null;
          };

          const title =
            getMeta('og:title') ?? document.title ?? null;
          const description =
            getMeta('og:description') ?? getMeta('description') ?? null;
          const image = getMeta('og:image') ?? null;

          return { title, description, image };
        });

        // Resolve relative OG image URLs to absolute
        let imageUrl = ogData.image;
        if (imageUrl && !imageUrl.startsWith('http')) {
          try {
            imageUrl = new URL(imageUrl, url).href;
          } catch {
            imageUrl = null;
          }
        }

        return {
          title: ogData.title,
          description: ogData.description,
          image: imageUrl,
          url,
        };
      } finally {
        await browser.close();
      }
    },
  }),
};
