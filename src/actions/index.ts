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

  takeFullPageScreenshot: defineAction({
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
        const screenshot = (await page.screenshot({
          type: 'png',
          fullPage: true,
        })) as Buffer;
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

  compareDarkLight: defineAction({
    accept: 'form',
    input: z.object({
      url: z.url('Please enter a valid URL (e.g. https://example.com)'),
    }),
    handler: async ({ url }) => {
      const browser = await puppeteer.launch(env.MYBROWSER);
      try {
        const [lightPage, darkPage] = await Promise.all([
          browser.newPage(),
          browser.newPage(),
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
        await browser.close();
      }
    },
  }),

  extractColors: defineAction({
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

  auditMeta: defineAction({
    accept: 'form',
    input: z.object({
      url: z.url('Please enter a valid URL (e.g. https://example.com)'),
    }),
    handler: async ({ url }) => {
      const browser = await puppeteer.launch(env.MYBROWSER);
      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });

        const meta = await page.evaluate(() => {
          const getMeta = (sel: string): string | null => {
            const el = document.querySelector(sel);
            return el?.getAttribute('content') ?? null;
          };

          const getLink = (rel: string): string | null => {
            const el = document.querySelector(`link[rel="${rel}"]`);
            return el?.getAttribute('href') ?? null;
          };

          // Collect all meta tags
          const allMeta: { name: string; content: string }[] = [];
          document.querySelectorAll('meta[name], meta[property]').forEach((el) => {
            const name = el.getAttribute('name') || el.getAttribute('property') || '';
            const content = el.getAttribute('content') || '';
            if (name && content) allMeta.push({ name, content });
          });

          // Structured data
          const structuredData: string[] = [];
          document
            .querySelectorAll('script[type="application/ld+json"]')
            .forEach((el) => {
              structuredData.push(el.textContent?.trim() ?? '');
            });

          return {
            title: document.title || null,
            titleLength: (document.title || '').length,
            description: getMeta('meta[name="description"]'),
            descriptionLength: (getMeta('meta[name="description"]') || '').length,
            viewport: getMeta('meta[name="viewport"]'),
            charset: document.characterSet || null,
            canonical: getLink('canonical'),
            favicon: getLink('icon') || getLink('shortcut icon'),
            lang: document.documentElement.lang || null,
            ogTitle: getMeta('meta[property="og:title"]'),
            ogDescription: getMeta('meta[property="og:description"]'),
            ogImage: getMeta('meta[property="og:image"]'),
            ogType: getMeta('meta[property="og:type"]'),
            twitterCard: getMeta('meta[name="twitter:card"]'),
            twitterTitle: getMeta('meta[name="twitter:title"]'),
            twitterDescription: getMeta('meta[name="twitter:description"]'),
            twitterImage: getMeta('meta[name="twitter:image"]'),
            robots: getMeta('meta[name="robots"]'),
            allMeta,
            hasStructuredData: structuredData.length > 0,
            structuredDataCount: structuredData.length,
          };
        });

        return { ...meta, url };
      } finally {
        await browser.close();
      }
    },
  }),

  extractFonts: defineAction({
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
  }),
};
