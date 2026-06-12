// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  vite: {
    optimizeDeps: {
      // Pre-bundle heavy/late-discovered deps so Vite's SSR optimizer does a
      // complete first pass. Prevents a mid-crawl re-optimization + full reload
      // race that throws "deps_ssr/chunk-*.js does not exist" in the workerd runtime.
      include: [
        '@cloudflare/puppeteer',
        'astro/zod',
        'astro/actions/runtime/entrypoints/route.js',
        'astro/actions/runtime/entrypoints/server.js',
      ],
    },
  },
});