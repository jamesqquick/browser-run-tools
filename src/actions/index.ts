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

  summarizeHomepage: defineAction({
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

        const visibleText = await page.evaluate(() => {
          return document.body.innerText;
        });

        // Truncate to ~6000 chars to stay within model context limits
        const truncated = visibleText.slice(0, 6000);

        const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            {
              role: 'system',
              content:
                'You are a homepage messaging analyst. Given the visible text content of a website homepage, write a concise summary (3-5 sentences) of what the homepage communicates to a first-time visitor. Focus on: what the company/product does, who it is for, and the main value proposition. Be objective and direct. Do not include any preamble, introduction, or meta-commentary. Start directly with the summary itself.',
            },
            {
              role: 'user',
              content: `Here is the visible text from the homepage at ${url}:\n\n${truncated}`,
            },
          ],
        });

        const summary =
          'response' in response ? response.response : String(response);

        return { summary, url };
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
