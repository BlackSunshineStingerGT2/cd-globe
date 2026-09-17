import test from 'node:test';
import assert from 'node:assert/strict';

import { rewriteUrl, installCdEndpointRewrite } from './endpointMap.js';

const ENDPOINTS = {
  openSky: '/api/globe/opensky',
  openSkyTrack: '/api/globe/opensky-track',
  adsbLolMil: '/api/globe/adsblol/mil',
  adsbLolTrace: '/api/globe/adsblol/trace',
  tles: '/api/globe/tles',
  terrainHeights: '/api/globe/terrain/heights',
};

test('known upstream paths are redirected to the platform', () => {
  assert.equal(rewriteUrl('/api/opensky', ENDPOINTS), '/api/globe/opensky');
  assert.equal(rewriteUrl('/api/adsblol/mil', ENDPOINTS), '/api/globe/adsblol/mil');
  assert.equal(rewriteUrl('/api/celestrak/active', ENDPOINTS), '/api/globe/tles');
});

test('the query string survives, since it carries the parameters', () => {
  assert.equal(
    rewriteUrl('/api/opensky-track?icao24=abc123', ENDPOINTS),
    '/api/globe/opensky-track?icao24=abc123',
  );
  assert.equal(
    rewriteUrl('/api/terrain/heights?points=-97.74000,30.27000', ENDPOINTS),
    '/api/globe/terrain/heights?points=-97.74000,30.27000',
  );
});

test('a layer the platform has not enabled is left alone', () => {
  // No tles key: satellites are not live, so the request must fail as it would
  // have rather than be sent somewhere that cannot answer.
  assert.equal(rewriteUrl('/api/celestrak/active', { openSky: '/api/globe/opensky' }), null);
  assert.equal(rewriteUrl('/api/opensky', {}), null);
  assert.equal(rewriteUrl('/api/opensky', null), null);
});

test('unrelated and third-party URLs are never touched', () => {
  for (const url of [
    '/api/google/nearby-places?lat=1&lon=2',
    '/api/realtime/token',
    '/globe/cesium/Cesium.js',
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
    'https://api.adsb.lol/v2/mil',
  ]) {
    assert.equal(rewriteUrl(url, ENDPOINTS), null, url);
  }
});

test('a malformed url does not throw', () => {
  assert.equal(rewriteUrl('::::', ENDPOINTS), null);
  assert.equal(rewriteUrl(undefined, ENDPOINTS), null);
});

test('installing wraps fetch, rewrites, and restores cleanly', async () => {
  const seen = [];
  const host = {
    location: { href: 'https://cd.test/globe/' },
    fetch: async (url) => {
      seen.push(typeof url === 'string' ? url : url.url);
      return { ok: true };
    },
  };
  const restore = installCdEndpointRewrite(ENDPOINTS, { target: host });

  await host.fetch('/api/adsblol/mil');
  await host.fetch('https://earthquake.usgs.gov/feed.geojson');
  assert.deepEqual(seen, [
    '/api/globe/adsblol/mil',
    'https://earthquake.usgs.gov/feed.geojson',
  ]);

  restore();
  await host.fetch('/api/adsblol/mil');
  assert.equal(seen[2], '/api/adsblol/mil', 'restore must unwrap');
});

test('a throwing rewrite never breaks the request', async () => {
  const host = {
    location: { href: 'https://cd.test/globe/' },
    fetch: async (url) => ({ ok: true, url }),
  };
  // A getter that explodes stands in for any unexpected input shape.
  installCdEndpointRewrite(ENDPOINTS, { target: host });
  const weird = {
    get url() {
      throw new Error('boom');
    },
  };
  const res = await host.fetch(weird);
  assert.equal(res.ok, true);
});
