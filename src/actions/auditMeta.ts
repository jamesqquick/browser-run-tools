import { defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import puppeteer from '@cloudflare/puppeteer';
import { env } from 'cloudflare:workers';

export const auditMeta = defineAction({
  accept: 'form',
  input: z.object({
    url: z.url('Please enter a valid URL (e.g. https://example.com)'),
  }),
  handler: async ({ url }) => {
    const browser = await puppeteer.launch(env.BROWSER);
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
});
