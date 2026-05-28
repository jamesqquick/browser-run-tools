import { defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import puppeteer from '@cloudflare/puppeteer';
import { env } from 'cloudflare:workers';

export const extractColors = defineAction({
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

      const colors = await page.evaluate(() => {
        const rgbToHex = (rgb: string): string | null => {
          const match = rgb.match(
            /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
          );
          if (!match) return null;
          const r = parseInt(match[1]);
          const g = parseInt(match[2]);
          const b = parseInt(match[3]);
          const a = match[4] !== undefined ? parseFloat(match[4]) : 1;
          if (a === 0) return null;
          const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
          if (a < 1) {
            const alphaHex = Math.round(a * 255)
              .toString(16)
              .padStart(2, '0');
            return hex + alphaHex;
          }
          return hex;
        };

        const backgrounds: Record<string, number> = {};
        const text: Record<string, number> = {};
        const accents: Record<string, number> = {};
        const borders: Record<string, number> = {};

        const elements = document.body.querySelectorAll('*');
        for (const el of elements) {
          const style = getComputedStyle(el);

          const bg = rgbToHex(style.backgroundColor);
          if (bg) backgrounds[bg] = (backgrounds[bg] || 0) + 1;

          const color = rgbToHex(style.color);
          if (color) {
            const isLink = el.tagName === 'A' || el.closest('a');
            if (isLink) {
              accents[color] = (accents[color] || 0) + 1;
            } else {
              text[color] = (text[color] || 0) + 1;
            }
          }

          const borderColors = [
            style.borderTopColor,
            style.borderRightColor,
            style.borderBottomColor,
            style.borderLeftColor,
          ];
          for (const bc of borderColors) {
            const hex = rgbToHex(bc);
            if (hex) borders[hex] = (borders[hex] || 0) + 1;
          }
        }

        const toSorted = (map: Record<string, number>) =>
          Object.entries(map)
            .map(([hex, count]) => ({ hex, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
          backgrounds: toSorted(backgrounds),
          text: toSorted(text),
          accents: toSorted(accents),
          borders: toSorted(borders),
        };
      });

      return { ...colors, url };
    } finally {
      await browser.close();
    }
  },
});
