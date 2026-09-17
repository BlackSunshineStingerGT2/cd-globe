/**
 * CD platform configuration, fetched at runtime.
 *
 * Upstream bakes provider credentials into the bundle with Vite `define`. This
 * deployment is public, so the bundle ships with none and asks the platform what
 * this particular visitor may do. The globe is served same-origin at /globe/, so
 * the request carries CD's httponly session cookie without any cross-domain
 * work, and the Authorization header is added as well when a token is readable.
 *
 * Everything here fails soft. A config that does not answer, answers slowly, or
 * answers with nonsense must leave a working public globe on Esri, never a blank
 * page: the anonymous tier is the product's floor, not an error state.
 */

const CONFIG_URL = '/api/globe/config';
const CONFIG_TIMEOUT_MS = 8000;

/** The public floor. Also exactly what an anonymous caller is served. */
const ANONYMOUS_CONFIG = Object.freeze({
  basemaps: Object.freeze(['esri', 'osm']),
  googleMapsKey: '',
  voice: false,
  layers: Object.freeze(['earthquakes']),
  endpoints: Object.freeze({}),
});

/**
 * CD's JWT, when this browser has one.
 *
 * Same-origin is what makes this readable: the platform's own pages write it to
 * localStorage, and /globe/ shares their origin. Absent for a logged-out
 * visitor, which is normal and not an error.
 */
export function cdAuthToken() {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    // Private mode, or storage blocked by policy. Anonymous still works.
    return '';
  }
}

function sanitize(raw) {
  if (!raw || typeof raw !== 'object') return { ...ANONYMOUS_CONFIG };
  const list = (value, fallback) =>
    Array.isArray(value)
      ? value.filter((v) => typeof v === 'string')
      : fallback;
  return {
    basemaps: list(raw.basemaps, [...ANONYMOUS_CONFIG.basemaps]),
    googleMapsKey:
      typeof raw.googleMapsKey === 'string' ? raw.googleMapsKey.trim() : '',
    voice: raw.voice === true,
    layers: list(raw.layers, [...ANONYMOUS_CONFIG.layers]),
    endpoints:
      raw.endpoints && typeof raw.endpoints === 'object' ? raw.endpoints : {},
  };
}

/** Ask the platform what this visitor's globe may do. Never rejects. */
export async function loadPlatformConfig({
  url = CONFIG_URL,
  transport = (...args) => fetch(...args),
  timeoutMs = CONFIG_TIMEOUT_MS,
} = {}) {
  const token = cdAuthToken();
  try {
    const response = await transport(url, {
      // The cookie is same-origin and httponly; the header covers the case
      // where a token is readable but the cookie has already expired.
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) return { ...ANONYMOUS_CONFIG };
    return sanitize(await response.json());
  } catch {
    // Offline, blocked, timed out, or malformed. Public globe either way.
    return { ...ANONYMOUS_CONFIG };
  }
}

/**
 * Transport for the voice token request, adapted to CD's endpoint.
 *
 * Two deliberate differences from upstream. CD mints the credential on a POST,
 * not a GET, because it costs money and must not be reachable by navigation or
 * prefetch. And it authenticates on the Authorization header ONLY, refusing the
 * session cookie, so that no cross-site page can trigger a paid mint using the
 * visitor's ambient credentials. Upstream builds a GET URL with ?tier=, so the
 * tier is read back off that URL and sent as a body instead.
 */
export function createCdVoiceTransport({
  transport = (...args) => fetch(...args),
} = {}) {
  return async (url, init = {}) => {
    let tier = 'standard';
    let endpoint = url;
    try {
      const parsed = new URL(url, window.location.href);
      tier = parsed.searchParams.get('tier') || 'standard';
      parsed.search = '';
      endpoint = parsed.pathname;
    } catch {
      // Leave the defaults; the server validates tier against a fixed set.
    }
    const token = cdAuthToken();
    return transport(endpoint, {
      ...init,
      method: 'POST',
      cache: 'no-store',
      redirect: 'error',
      // Never 'include': the cookie must not be what authorises this.
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ tier }),
    });
  };
}

/**
 * Transport for a globe whose visitor has no voice.
 *
 * Without this the default backend would point at upstream's dev-server path,
 * `/api/realtime/token`, which this platform does not serve: the mic would make
 * a pointless request and report an HTTP 404 as its reason. Answering locally
 * costs no request and says something true instead. Shaped like the slice of
 * Response that requestToken reads.
 */
export function createUnavailableVoiceTransport(
  reason = 'Voice is not enabled for this account',
) {
  return async () => ({
    ok: false,
    status: 503,
    headers: { get: () => null },
    json: async () => ({ error: reason }),
  });
}

export { ANONYMOUS_CONFIG };
