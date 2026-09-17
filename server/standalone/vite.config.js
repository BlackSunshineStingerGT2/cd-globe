import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { createBrowserViteConfig } from '../../build/vite.js';
import { localProviderPlugins } from '../providers/local.js';
import { apiNotFoundPlugin } from './api-not-found.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

/** Load this checkout's configuration and attach its local provider middleware. */
export default defineConfig(({ mode }) => {
  const loaded = loadEnv(mode, root, '');
  for (const [key, value] of Object.entries(loaded)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  // CD: no provider credential is baked into the bundle. Upstream injects the
  // Google Maps key and the Cesium ion token at build time via Vite `define`;
  // this deployment is public and hosted, so both are forced empty and the
  // Google key arrives at runtime from GET /api/globe/config, for allowlisted
  // users only. Empty cesiumToken is also what selects GEV's keyless terrain
  // and marks the ion basemaps unavailable, which is deliberate: the ion
  // Community plan does not cover a hosted site.
  return {
    ...createBrowserViteConfig({
      plugins: [...localProviderPlugins(), apiNotFoundPlugin()],
      googleApiKey: '',
      cesiumToken: '',
      host: process.env.HOST,
      port: process.env.PORT,
    }),
    // Assets resolve under https://catastrophicdisclosure.com/globe/
    base: '/globe/',
  };
});
