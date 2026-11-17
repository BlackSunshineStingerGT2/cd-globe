import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ageLabel,
  groupByArea,
  initNavalLayer,
  ringPoints,
  shortName,
} from './navalLayer.js';
import { ICON_KEYS, iconKey, iconSize, iconUri } from './navalIcons.js';

test('shortName drops the USS prefix and uppercases', () => {
  assert.equal(shortName({ name: 'USS John Paul Jones' }), 'JOHN PAUL JONES');
  assert.equal(shortName({ hull: 'DDG-1' }), 'DDG-1');
  assert.equal(shortName(null), '?');
});

test('ageLabel', () => {
  assert.equal(ageLabel(0), 'today');
  assert.equal(ageLabel(1), '1 day ago');
  assert.equal(ageLabel(12), '12 days ago');
  assert.equal(ageLabel(null), 'date unknown');
  assert.equal(ageLabel(Number.NaN), 'date unknown');
});

test('ringPoints is closed and every point is the radius from the centre', () => {
  const pts = ringPoints(22, 62, 300, 36);
  assert.equal(pts.length, 37);
  assert.ok(
    Math.abs(pts[0][0] - pts[36][0]) < 1e-9 &&
      Math.abs(pts[0][1] - pts[36][1]) < 1e-9,
  );
  const rad = Math.PI / 180;
  for (const [lon, lat] of pts) {
    const h =
      Math.sin(((lat - 22) * rad) / 2) ** 2 +
      Math.cos(22 * rad) *
        Math.cos(lat * rad) *
        Math.sin(((lon - 62) * rad) / 2) ** 2;
    assert.ok(Math.abs(2 * 6371.0088 * Math.asin(Math.sqrt(h)) - 300) < 0.01);
  }
});

test('ringPoints wraps longitude across the antimeridian', () => {
  for (const [lon] of ringPoints(0, 179.5, 200, 24))
    assert.ok(lon >= -180 && lon <= 180);
});

test('groupByArea keeps first-seen area order and sorts capital ships first', () => {
  const groups = groupByArea([
    { hull: 'DDG-2', type: 'destroyer', area: 'Arabian Sea' },
    { hull: 'DDG-9', type: 'destroyer', area: 'Red Sea' },
    { hull: 'CVN-1', type: 'carrier', area: 'Arabian Sea' },
    { hull: 'DDG-1', type: 'destroyer', area: 'Arabian Sea' },
  ]);
  assert.deepEqual([...groups.keys()], ['Arabian Sea', 'Red Sea']);
  assert.deepEqual(
    groups.get('Arabian Sea').map((s) => s.hull),
    ['CVN-1', 'DDG-1', 'DDG-2'],
  );
});

test('iconKey splits flat-deck amphibs from dock ships by hull prefix', () => {
  assert.equal(iconKey({ type: 'amphib', hull: 'LHD-4' }), 'lhd');
  assert.equal(iconKey({ type: 'amphib', hull: 'LHA-7' }), 'lhd');
  assert.equal(iconKey({ type: 'amphib', hull: 'LPD-27' }), 'dock');
  assert.equal(iconKey({ type: 'amphib', hull: 'LSD-45' }), 'dock');
  assert.equal(iconKey({ type: 'carrier' }), 'carrier');
  assert.equal(iconKey({ type: 'battleship' }), 'other');
  assert.equal(iconKey(null), 'other');
});

test('every glyph is a decodable SVG with a ship-shaped billboard size', () => {
  for (const key of ICON_KEYS) {
    const { width, height } = iconSize(key);
    assert.ok(height > width * 2, `${key} should be long and thin`);
    assert.ok(width >= 6 && height <= 80, `${key} size ${width}x${height}`);
    const uri = iconUri(key);
    assert.ok(uri.startsWith('data:image/svg+xml;charset=utf-8,'));
    const svg = decodeURIComponent(uri.split(',')[1]);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /<\/svg>$/);
    assert.equal(iconUri(key), uri, 'memoised');
  }
});

test('nothing mounts when the platform does not advertise the endpoint', () => {
  const dispose = initNavalLayer({ viewer: {}, config: { endpoints: {} } });
  assert.equal(typeof dispose, 'function');
  dispose();
});
