import test from 'node:test';
import assert from 'node:assert/strict';

import {
  loadPlatformConfig,
  createCdVoiceTransport,
  createUnavailableVoiceTransport,
  cdAuthToken,
  ANONYMOUS_CONFIG,
} from './platformConfig.js';

function withBrowser({ token = null, href = 'https://cd.test/globe/' } = {}, run) {
  const priorStorage = globalThis.localStorage;
  const priorLocation = globalThis.window;
  globalThis.localStorage = {
    getItem: (key) => (key === 'token' ? token : null),
  };
  globalThis.window = { location: { href } };
  try {
    return run();
  } finally {
    globalThis.localStorage = priorStorage;
    globalThis.window = priorLocation;
  }
}

const ok = (body) => async () => ({ ok: true, status: 200, json: async () => body });

test('a platform that does not answer still yields the public globe', async () => {
  for (const transport of [
    async () => {
      throw new Error('network down');
    },
    async () => ({ ok: false, status: 500, json: async () => ({}) }),
    async () => ({ ok: true, status: 200, json: async () => null }),
  ]) {
    const config = await withBrowser({}, () => loadPlatformConfig({ transport }));
    assert.deepEqual(config.basemaps, [...ANONYMOUS_CONFIG.basemaps]);
    assert.equal(config.voice, false);
    assert.equal(config.googleMapsKey, '');
  }
});

test('an allowlisted response is carried through', async () => {
  const config = await withBrowser({ token: 'jwt' }, () =>
    loadPlatformConfig({
      transport: ok({
        basemaps: ['esri', 'osm', 'google3d'],
        googleMapsKey: 'AIzaKEY',
        voice: true,
        layers: ['earthquakes'],
        endpoints: { voiceSession: '/api/globe/voice/session' },
      }),
    }),
  );
  assert.deepEqual(config.basemaps, ['esri', 'osm', 'google3d']);
  assert.equal(config.googleMapsKey, 'AIzaKEY');
  assert.equal(config.voice, true);
  assert.equal(config.endpoints.voiceSession, '/api/globe/voice/session');
});

test('voice is true only for a literal true, never a truthy value', async () => {
  for (const value of ['true', 1, {}, 'yes']) {
    const config = await withBrowser({}, () =>
      loadPlatformConfig({ transport: ok({ voice: value }) }),
    );
    assert.equal(config.voice, false, `voice:${JSON.stringify(value)}`);
  }
});

test('the token is sent when present and omitted when absent', async () => {
  const seen = [];
  const transport = async (url, init) => {
    seen.push(init.headers);
    return { ok: true, status: 200, json: async () => ({}) };
  };
  await withBrowser({ token: 'jwt-abc' }, () => loadPlatformConfig({ transport }));
  assert.equal(seen[0].Authorization, 'Bearer jwt-abc');
  await withBrowser({ token: null }, () => loadPlatformConfig({ transport }));
  assert.equal(seen[1].Authorization, undefined);
});

test('unreadable storage does not break the bootstrap', async () => {
  const prior = globalThis.localStorage;
  globalThis.localStorage = {
    getItem() {
      throw new Error('storage blocked');
    },
  };
  try {
    assert.equal(cdAuthToken(), '');
  } finally {
    globalThis.localStorage = prior;
  }
});

test('the voice request is a POST that authenticates on the header, not the cookie', async () => {
  let call;
  const transport = async (url, init) => {
    call = { url, init };
    return { ok: true, status: 200, json: async () => ({}) };
  };
  await withBrowser({ token: 'jwt-xyz' }, () =>
    createCdVoiceTransport({ transport })(
      '/api/globe/voice/session?tier=mini',
      {},
    ),
  );
  assert.equal(call.init.method, 'POST');
  // The cookie must not be what authorises a paid mint.
  assert.equal(call.init.credentials, 'omit');
  assert.equal(call.init.headers.Authorization, 'Bearer jwt-xyz');
  // Upstream puts tier in the query string; CD reads it as a body.
  assert.equal(call.url, '/api/globe/voice/session');
  assert.deepEqual(JSON.parse(call.init.body), { tier: 'mini' });
});

test('an absent tier falls back to standard', async () => {
  let call;
  const transport = async (url, init) => {
    call = { url, init };
    return { ok: true, status: 200, json: async () => ({}) };
  };
  await withBrowser({}, () =>
    createCdVoiceTransport({ transport })('/api/globe/voice/session', {}),
  );
  assert.deepEqual(JSON.parse(call.init.body), { tier: 'standard' });
});

test('an unavailable mic answers locally instead of calling a dead endpoint', async () => {
  const response = await createUnavailableVoiceTransport()();
  assert.equal(response.ok, false);
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not enabled/i);
});
