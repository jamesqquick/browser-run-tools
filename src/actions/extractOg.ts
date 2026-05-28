import { defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import puppeteer from '@cloudflare/puppeteer';
import { env } from 'cloudflare:workers';

export const extractOg = defineAction({
  accept: 'form',
  input: z.object({
    url: z.url('Please enter a valid URL (e.g. https://example.com)'),
  }),
  handler: async ({ url }) => {
    const browser = await puppeteer.launch(env.BROWSER);
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
});
