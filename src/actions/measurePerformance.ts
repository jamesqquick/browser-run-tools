import { defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import puppeteer from '@cloudflare/puppeteer';
import { env } from 'cloudflare:workers';

export const measurePerformance = defineAction({
  accept: 'form',
  input: z.object({
    url: z.url('Please enter a valid URL (e.g. https://example.com)'),
  }),
  handler: async ({ url }) => {
    const browser = await puppeteer.launch(env.BROWSER);
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });

      const startTime = Date.now();
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });
      const fullLoadTime = Date.now() - startTime;

      const metrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

        const ttfb = nav ? Math.round(nav.responseStart - nav.requestStart) : null;
        const domContentLoaded = nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null;
        const domInteractive = nav ? Math.round(nav.domInteractive - nav.startTime) : null;

        // LCP via PerformanceObserver entries
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint') as PerformanceEntry[];
        const lcp = lcpEntries.length > 0
          ? Math.round((lcpEntries[lcpEntries.length - 1] as any).startTime)
          : null;

        // Resource counts
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const totalRequests = resources.length;
        const totalTransferSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);

        // By type
        const byType: Record<string, { count: number; size: number }> = {};
        for (const r of resources) {
          const ext = r.name.split('?')[0].split('.').pop()?.toLowerCase() || 'other';
          let type = 'other';
          if (['js', 'mjs'].includes(ext)) type = 'script';
          else if (['css'].includes(ext)) type = 'stylesheet';
          else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif', 'ico'].includes(ext)) type = 'image';
          else if (['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext)) type = 'font';
          else if (r.initiatorType === 'fetch' || r.initiatorType === 'xmlhttprequest') type = 'fetch';

          if (!byType[type]) byType[type] = { count: 0, size: 0 };
          byType[type].count++;
          byType[type].size += r.transferSize || 0;
        }

        return {
          ttfb,
          domContentLoaded,
          domInteractive,
          lcp,
          totalRequests,
          totalTransferSize,
          byType,
        };
      });

      return { ...metrics, fullLoadTime, url };
    } finally {
      await browser.close();
    }
  },
});
