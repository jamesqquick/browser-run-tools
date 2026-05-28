import { defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { env } from 'cloudflare:workers';
import type { BrowserBinding } from './types';

export const checkLinks = defineAction({
  accept: 'form',
  input: z.object({
    url: z.url('Please enter a valid URL (e.g. https://example.com)'),
  }),
  handler: async ({ url }) => {
    const res = await (env.BROWSER as unknown as BrowserBinding).quickAction('links', {
      url,
      gotoOptions: { waitUntil: 'networkidle0', timeout: 30_000 },
    });
    const data = (await res.json()) as { result: string[] };
    const allLinks = data.result.filter(
      (href) =>
        !href.startsWith('javascript:') &&
        !href.startsWith('mailto:') &&
        !href.startsWith('tel:'),
    );

    // Deduplicate
    const uniqueLinks = [...new Set(allLinks)];

    // Limit to 50 links to avoid timeout
    const linksToCheck = uniqueLinks.slice(0, 50);
    const baseHost = new URL(url).hostname;

    const results = await Promise.all(
      linksToCheck.map(async (href) => {
        let status = 0;
        let ok = false;
        const isExternal = (() => {
          try {
            return new URL(href).hostname !== baseHost;
          } catch {
            return true;
          }
        })();

        try {
          const res = await fetch(href, {
            method: 'HEAD',
            redirect: 'follow',
            signal: AbortSignal.timeout(5000),
          });
          status = res.status;
          ok = res.ok;
        } catch {
          status = 0;
          ok = false;
        }

        return {
          href,
          text: href,
          status,
          ok,
          isExternal,
        };
      }),
    );

    const totalLinks = uniqueLinks.length;
    const checkedCount = results.length;
    const brokenCount = results.filter((r) => !r.ok).length;
    const externalCount = results.filter((r) => r.isExternal).length;

    return {
      links: results,
      totalLinks,
      checkedCount,
      brokenCount,
      externalCount,
      url,
    };
  },
});
