import { rename, rm, access } from 'node:fs/promises';
import path from 'node:path';

/**
 * Put Cesium's runtime assets where the page actually asks for them.
 *
 * vite-plugin-cesium conflates a URL with a filesystem path. It computes
 * `CESIUM_BASE_URL = posix.join(base, 'cesium/')`, which is the correct URL to
 * emit into index.html, then reuses that same string as the copy destination:
 * `copy(cesiumBuildPath, path.join(outDir, CESIUM_BASE_URL, ...))`. With the
 * default `base` of '/' the two agree. With CD's `base` of '/globe/' they do
 * not: index.html requests /globe/cesium/Cesium.js while the files are written
 * to dist/globe/cesium/, so every Cesium asset 404s and the globe never boots.
 *
 * This wraps the plugin rather than sitting beside it in the plugin list.
 * `closeBundle` is a parallel Rollup hook, so a separate plugin (even with
 * enforce: 'post') races the copy it is trying to correct and usually wins.
 * Chaining off the original hook is the only ordering that is actually
 * guaranteed.
 *
 * Remove this the day vite-plugin-cesium separates the two. Note that changing
 * `base` means re-checking it.
 */
export function withCesiumBasePathFix(cesiumPlugin) {
  let outDir = 'dist';
  let base = '/';
  let isBuild = false;
  const originalConfigResolved = cesiumPlugin.configResolved;
  const originalCloseBundle = cesiumPlugin.closeBundle;

  return {
    ...cesiumPlugin,
    async configResolved(config) {
      outDir = path.isAbsolute(config.build.outDir)
        ? config.build.outDir
        : path.join(config.root, config.build.outDir);
      base = config.base || '/';
      isBuild = config.command === 'build';
      return originalConfigResolved?.call(this, config);
    },
    async closeBundle(...args) {
      const result = await originalCloseBundle?.apply(this, args);
      if (!isBuild) return result;

      const nested = path.join(outDir, base, 'cesium');
      const wanted = path.join(outDir, 'cesium');
      if (path.resolve(nested) === path.resolve(wanted)) return result;
      try {
        await access(nested);
      } catch {
        return result; // Upstream fixed it, or nothing was copied.
      }
      await rm(wanted, { recursive: true, force: true });
      await rename(nested, wanted);
      // The base directory exists only to hold that copy, so drop it if empty.
      const stray = path.join(outDir, base);
      if (path.resolve(stray) !== path.resolve(outDir)) {
        await rm(stray, { recursive: true, force: true });
      }
      console.log('[cd] moved Cesium runtime assets to dist/cesium/');
      return result;
    },
  };
}
