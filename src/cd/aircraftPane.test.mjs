import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPaneModel,
  sourceLabel,
  initAircraftPane,
} from './aircraftPane.js';
import { countryForHex, ICAO_BLOCKS, flagEmoji } from '../data/icaoCountry.js';

const row = (list, key) => list.find(([k]) => k === key);

const C17_LIVE = {
  hex: 'ae119b',
  type: 'adsb_icao',
  flight: 'BLUES55 ',
  r: '03-3118',
  t: 'C17',
  squawk: '5770',
  emergency: 'none',
  rssi: -20.9,
  seen: 0.1,
  seen_pos: 0.3,
  alt_baro: 35000,
  alt_geom: 35900,
  gs: 432.4,
  track: 141.25,
  baro_rate: -640,
  lat: 50.03712,
  lon: 8.56291,
  dbFlags: 1,
};
const C17_ENRICHED = {
  registration: '03-3118',
  owner: 'United States Air Force',
  manufacturer: 'McDonnell Douglas',
  type: 'C-17A Globemaster III',
  icao_type: 'C17',
  route: null,
  photo: null,
};

// ---- the pane model: the spec's rules, one at a time ------------------------

test('a military C-17 shows the acceptance rows', () => {
  const m = buildPaneModel({
    hex: 'ae119b',
    layerId: 'military',
    live: C17_LIVE,
    enriched: C17_ENRICHED,
  });
  assert.equal(m.callsign, 'BLUES55');
  assert.equal(m.military, true);
  assert.equal(row(m.identity, 'Registration')[1], '03-3118');
  assert.match(row(m.identity, 'Country')[1], /United States$/);
  assert.equal(row(m.identity, 'Operator')[1], 'United States Air Force');
  assert.equal(
    row(m.identity, 'Type')[1],
    'C17 · McDonnell Douglas C-17A Globemaster III',
  );
  assert.equal(row(m.identity, 'Squawk')[1], '5770');
  assert.equal(row(m.spatial, 'Ground speed')[1], '432 kt');
  assert.equal(row(m.spatial, 'Altitude (baro)')[1], '35,000 ft');
  assert.equal(row(m.spatial, 'Track')[1], '141.3°');
  assert.equal(row(m.spatial, 'Position')[1], '50.037, 8.563');
});

test('an emergency squawk is flagged, with its emergency text', () => {
  for (const sq of ['7500', '7600', '7700']) {
    const m = buildPaneModel({
      hex: 'ae119b',
      live: { ...C17_LIVE, squawk: sq },
    });
    assert.equal(row(m.identity, 'Squawk')[2], 'alert', sq);
  }
  const m = buildPaneModel({
    hex: 'ae119b',
    live: { ...C17_LIVE, squawk: '7700', emergency: 'general' },
  });
  assert.equal(row(m.identity, 'Squawk')[1], '7700 · general');
  const ok = buildPaneModel({ hex: 'ae119b', live: C17_LIVE });
  assert.equal(row(ok.identity, 'Squawk')[2], '');
});

test('a civil airliner shows its route; military never does', () => {
  const route = {
    origin: { iata: 'LHR', icao: 'EGLL' },
    destination: { iata: 'JFK', icao: 'KJFK' },
  };
  const civil = buildPaneModel({
    hex: '400a0e',
    layerId: 'flights',
    enriched: { route },
  });
  assert.equal(row(civil.identity, 'Route')[1], 'LHR → JFK');
  const mil = buildPaneModel({
    hex: 'ae119b',
    layerId: 'military',
    enriched: { route },
  });
  assert.equal(row(mil.identity, 'Route'), undefined);
});

test('rows with no data are omitted; Registration and Operator say unknown', () => {
  const m = buildPaneModel({ hex: 'ae119b' });
  assert.equal(row(m.identity, 'Registration')[1], 'unknown');
  assert.equal(row(m.identity, 'Operator')[1], 'unknown');
  for (const k of ['Type', 'Squawk', 'Route'])
    assert.equal(row(m.identity, k), undefined, k);
  assert.deepEqual(m.spatial, []);
  assert.deepEqual(m.signal, []);
});

test('altitude "ground" is shown as ground, not as a number', () => {
  const m = buildPaneModel({ hex: 'ae119b', live: { alt_baro: 'ground' } });
  assert.equal(row(m.spatial, 'Altitude (baro)')[1], 'ground');
});

test('vertical rate is signed and coloured by direction, geom rate as fallback', () => {
  const up = buildPaneModel({ hex: 'ae119b', live: { baro_rate: 1280 } });
  assert.deepEqual(row(up.spatial, 'Vertical rate').slice(1), [
    '+1,280 ft/min',
    'up',
  ]);
  const down = buildPaneModel({
    hex: 'ae119b',
    live: { baro_rate: null, geom_rate: -640 },
  });
  assert.deepEqual(row(down.spatial, 'Vertical rate').slice(1), [
    '-640 ft/min',
    'down',
  ]);
});

test('last seen and last position add the snapshot age', () => {
  const m = buildPaneModel({
    hex: 'ae119b',
    live: { seen: 1.0, seen_pos: 2.0 },
    snapshotAgeS: 4.5,
  });
  assert.equal(row(m.signal, 'Last seen')[1], '5.5 s');
  assert.equal(row(m.signal, 'Last position')[1], '6.5 s');
});

test('the FAA link appears only for N-registered aircraft', () => {
  const us = buildPaneModel({ hex: 'a1b2c3', live: { r: 'N123AB' } });
  assert.ok(us.links.some(([t]) => t === 'FAA registry'));
  const mil = buildPaneModel({ hex: 'ae119b', live: C17_LIVE });
  assert.ok(!mil.links.some(([t]) => t === 'FAA registry'));
  assert.equal(mil.links[0][1], 'https://globe.adsbexchange.com/?icao=ae119b');
});

test('distance from view center is in nautical miles', () => {
  // One degree of latitude is 60 nmi.
  const m = buildPaneModel({
    hex: 'ae119b',
    live: { lat: 51, lon: 0 },
    viewCenter: { lat: 50, lon: 0 },
  });
  assert.equal(row(m.spatial, 'From view center')[1], '60 nmi');
});

test('signal source labels', () => {
  for (const [t, want] of [
    ['adsb_icao', 'ADS-B'],
    ['adsr_icao', 'ADS-B'],
    ['mlat', 'MLAT'],
    ['tisb_trackfile', 'TIS-B'],
    ['adsc', 'ADS-C'],
    ['mode_s', 'Other'],
    ['', ''],
  ])
    assert.equal(sourceLabel(t), want, t);
});

// ---- country from hex ------------------------------------------------------

test('country blocks: known allocations', () => {
  for (const [hex, iso] of [
    ['ae119b', 'US'],
    ['a00001', 'US'],
    ['3c6444', 'DE'],
    ['400a0e', 'GB'],
    ['43c6f1', 'GB'],
    ['4ca334', 'IE'],
    ['7c4ee8', 'AU'],
    ['c00000', 'CA'],
  ])
    assert.equal(countryForHex(hex)?.iso, iso, hex);
  assert.equal(countryForHex('AE119B')?.name, 'United States');
});

test('Malta covers the addresses its aircraft actually use', () => {
  // Every Maltese registration in a 3,852-aircraft live sample transmitted
  // above the original 4D23FF boundary; these are real ones.
  for (const hex of ['4d2418', '4d24c2', '4d2528'])
    assert.equal(countryForHex(hex)?.iso, 'MT', hex);
});

test('non-ICAO and malformed addresses have no country', () => {
  for (const h of ['~2e6b1f', 'zzzzzz', 'ae119', '', null])
    assert.equal(countryForHex(h), null);
});

test('the allocation table is sorted and non-overlapping', () => {
  for (let i = 1; i < ICAO_BLOCKS.length; i++) {
    const [ps, pe] = ICAO_BLOCKS[i - 1];
    const [s, e] = ICAO_BLOCKS[i];
    assert.ok(ps <= pe && s <= e, `block ${i} inverted`);
    assert.ok(s > pe, `block ${i} (${s.toString(16)}) overlaps the one before`);
  }
});

test('flag emoji is two regional indicators', () => {
  assert.equal(flagEmoji('US'), '\u{1F1FA}\u{1F1F8}');
  assert.equal(flagEmoji('x'), '');
});

// ---- the mounted pane: requests, not rendering -----------------------------

function fakeDom() {
  const el = () => ({
    hidden: false,
    innerHTML: '',
    textContent: '',
    className: '',
    children: [],
    setAttribute() {},
    appendChild(c) {
      this.children.push(c);
      return c;
    },
    remove() {},
  });
  const rail = el();
  globalThis.document = {
    head: el(),
    createElement: el,
    getElementById: (id) => (id === 'right-context-rail' ? rail : null),
  };
  globalThis.window = new EventTarget();
  return rail;
}

function fakeViewer() {
  return {
    trackedEntity: { id: 'x' },
    trackedEntityChanged: { addEventListener: () => () => {} },
    scene: {
      canvas: { clientWidth: 100, clientHeight: 100 },
      globe: { ellipsoid: {} },
    },
    camera: { pickEllipsoid: () => null },
  };
}

function recordingFetch() {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    const body = url.endsWith('/live')
      ? { hex: 'x', layer: 'military', snapshot_age_s: 0, record: C17_LIVE }
      : C17_ENRICHED;
    return { ok: true, json: async () => body };
  };
  return { urls, fetchImpl };
}

const select = (id, layerId = 'military') =>
  window.dispatchEvent(
    new CustomEvent('gev:awareness-subject-selected', {
      detail: { layerId, id, label: id },
    }),
  );
const settle = () => new Promise((r) => setImmediate(r));

test('stepping through 20 contacts fires nothing until the selection holds', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  try {
    fakeDom();
    const { urls, fetchImpl } = recordingFetch();
    const dispose = initAircraftPane({
      viewer: fakeViewer(),
      fetchImpl,
      config: { endpoints: { aircraft: '/api/globe/aircraft' } },
    });
    for (let i = 0; i < 20; i++) {
      select((0xae0000 + i).toString(16));
      mock.timers.tick(150); // faster than the 400 ms hold
      await settle();
    }
    assert.equal(urls.length, 0, 'no request while stepping');
    mock.timers.tick(400); // the last one holds
    await settle();
    await settle();
    await settle();
    assert.deepEqual(
      urls.map((u) => u.split('?')[0]),
      ['/api/globe/aircraft/ae0013/live', '/api/globe/aircraft/ae0013'],
    );
    dispose();
  } finally {
    mock.timers.reset();
  }
});

test('reselecting an aircraft reuses its enrichment instead of asking again', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  try {
    fakeDom();
    const { urls, fetchImpl } = recordingFetch();
    const dispose = initAircraftPane({
      viewer: fakeViewer(),
      fetchImpl,
      config: { endpoints: { aircraft: '/api/globe/aircraft' } },
    });
    for (const hex of ['ae119b', 'ae07e1', 'ae119b']) {
      select(hex);
      mock.timers.tick(400);
      await settle();
      await settle();
      await settle();
    }
    const enrichCalls = urls.filter((u) => !u.includes('/live'));
    assert.equal(enrichCalls.filter((u) => u.includes('/ae119b')).length, 1);
    dispose();
  } finally {
    mock.timers.reset();
  }
});

test('the pane only ever requests the CD API', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  try {
    fakeDom();
    const { urls, fetchImpl } = recordingFetch();
    const dispose = initAircraftPane({
      viewer: fakeViewer(),
      fetchImpl,
      config: { endpoints: { aircraft: '/api/globe/aircraft' } },
    });
    select('ae119b');
    mock.timers.tick(400);
    await settle();
    await settle();
    mock.timers.tick(10_000 * 3); // three live polls
    await settle();
    await settle();
    assert.ok(urls.length >= 3);
    for (const u of urls) assert.match(u, /^\/api\/globe\/aircraft\//, u);
    dispose();
  } finally {
    mock.timers.reset();
  }
});
