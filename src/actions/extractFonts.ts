import { defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import puppeteer from '@cloudflare/puppeteer';
import { env } from 'cloudflare:workers';

export const extractFonts = defineAction({
  accept: 'form',
  input: z.object({
    url: z.url('Please enter a valid URL (e.g. https://example.com)'),
  }),
  handler: async ({ url }) => {
    const browser = await puppeteer.launch(env.BROWSER);
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });

      const fonts = await page.evaluate(() => {
        const fontMap: Record<
          string,
          { family: string; weights: Set<string>; sizes: Set<string>; count: number }
        > = {};

        const elements = document.body.querySelectorAll('*');
        for (const el of elements) {
          const style = getComputedStyle(el);
          const family = style.fontFamily.split(',')[0].trim().replace(/['"]/g, '');
          const weight = style.fontWeight;
          const size = style.fontSize;

          if (!family) continue;

          if (!fontMap[family]) {
            fontMap[family] = { family, weights: new Set(), sizes: new Set(), count: 0 };
          }
          fontMap[family].weights.add(weight);
          fontMap[family].sizes.add(size);
          fontMap[family].count++;
        }

        return Object.values(fontMap)
          .map((f) => ({
            family: f.family,
            weights: [...f.weights].sort(),
            sizes: [...f.sizes].sort((a, b) => parseFloat(a) - parseFloat(b)),
            count: f.count,
          }))
          .sort((a, b) => b.count - a.count);
      });

      // Detect Google Fonts links
      const googleFontsUrls = await page.evaluate(() => {
        const links: string[] = [];
        document.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach((el) => {
          const href = el.getAttribute('href');
          if (href) links.push(href);
        });
        return links;
      });

      return { fonts, googleFontsUrls, url };
    } finally {
      await browser.close();
    }
  },
});
