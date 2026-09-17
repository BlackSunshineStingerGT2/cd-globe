/**
 * Point upstream's dev-server API paths at the CD platform's equivalents.
 *
 * God's Eye View calls paths like `/api/opensky` that its Vite middleware
 * serves in development. That middleware is not deployed, so on the platform
 * those paths hit the CD origin and 404. The platform serves the same data,
 * with the same response shapes and headers, under `/api/globe/...`.
 *
 * This rewrites the requests rather than editing each call site. The call sites
 * are spread across many upstream modules and some of them build their URL
 * inline, so patching them all would mean a large diff in files upstream keeps
 * changing -- exactly what this fork is trying to avoid. One table here is
 * smaller, easier to audit, and easier to drop if upstream ever grows a base
 * path of its own.
 *
 * Only same-origin, root-absolute `/api/` paths in the table are touched.
 * Anything else, including every third-party URL the app fetches directly, is
 * passed through untouched.
 */

/** Upstream dev-server path -> key in the platform's config.endpoints map. */
const ROUTES = Object.freeze({
  '/api/opensky': 'openSky',
  '/api/opensky-track': 'openSkyTrack',
  '/api/adsblol/mil': 'adsbLolMil',
  '/api/adsblol/trace': 'adsbLolTrace',
  '/api/celestrak/active': 'tles',
  '/api/celestrak': 'tles',
  '/api/terrain/heights': 'terrainHeights',
});

/** Resolve one URL, or null when it is not ours to touch. */
export function rewriteUrl(
  rawUrl,
  endpoints,
  base = 'https://example.invalid',
) {
  if (!endpoints) return null;
  let url;
  try {
    url = new URL(String(rawUrl), base);
  } catch {
    return null;
  }
  const target = endpoints[ROUTES[url.pathname]];
  if (!target) return null;
  // Preserve the query exactly: tier, icao24, hex and points all ride on it,
  // and the platform validates them.
  return `${target}${url.search}`;
}

/**
 * Wrap global fetch so the app's existing calls reach the platform.
 *
 * Returns a restore function. Installed before the application is constructed,
 * so no module can capture the unwrapped fetch first.
 */
export function installCdEndpointRewrite(
  endpoints,
  { target = globalThis } = {},
) {
  const original = target.fetch;
  if (typeof original !== 'function') return () => {};
  const origin =
    target.location && target.location.href
      ? target.location.href
      : 'https://example.invalid';

  target.fetch = function cdRewritingFetch(input, init) {
    try {
      const raw = typeof input === 'string' ? input : input?.url;
      const next = raw ? rewriteUrl(raw, endpoints, origin) : null;
      if (next) {
        // A Request object carries its own method, headers and body, so it is
        // rebuilt against the new URL rather than replaced by a bare string.
        if (typeof input !== 'string' && input instanceof Request) {
          return original.call(this, new Request(next, input), init);
        }
        return original.call(this, next, init);
      }
    } catch {
      // A rewrite must never be the reason a request fails.
    }
    return original.call(this, input, init);
  };

  return () => {
    target.fetch = original;
  };
}

export { ROUTES };
