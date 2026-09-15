import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFieldRaster,
  sampleScalar,
  trailEraseAlpha,
  windTrailColor,
} from './fields.js';
import { sampleWind } from './model.js';

const snapshot = {
  grid: { nx: 4, ny: 2, lo1: 0, la1: 90, dx: 90, dy: 180 },
  u: new Float32Array(8).fill(3),
  v: new Float32Array(8).fill(4),
  scalar: {
    kind: 'temperature',
    units: '°C',
    values: new Float32Array([0, 10, 20, 30, -10, 0, 10, 20]),
  },
};

test('scalar samples preserve normalized units, geometry, poles and the date-line seam', () => {
  assert.equal(sampleScalar(snapshot, 0, 90, 'speed'), 5);
  assert.equal(sampleScalar(snapshot, 0, 90, 'temperature'), 0);
  assert.equal(sampleScalar(snapshot, 90, -90, 'temperature'), 0);
  assert.equal(sampleScalar(snapshot, 180, 0, 'temperature'), 15);
  assert.equal(sampleScalar(snapshot, -180, 0, 'temperature'), 15);
  assert.equal(
    sampleScalar(snapshot, -0.01, 90, 'temperature'),
    sampleScalar(snapshot, 359.99, 90, 'temperature'),
  );
  assert.equal(sampleScalar(snapshot, 0, 0, 'pressure'), null);
  assert.equal(
    sampleScalar(
      { ...snapshot, scalar: { ...snapshot.scalar, units: 'K' } },
      0,
      0,
      'temperature',
    ),
    null,
  );
  assert.equal(sampleScalar(snapshot, Infinity, 0, 'speed'), null);
});

test('raster samples geographic pixel centers, not the source zero-longitude origin', () => {
  const raster = createFieldRaster(snapshot, 'temperature', 4, 2);
  const shifted = {
    ...snapshot,
    grid: { ...snapshot.grid, lo1: -180 },
    scalar: {
      ...snapshot.scalar,
      values: new Float32Array([20, 30, 0, 10, 10, 20, -10, 0]),
    },
  };
  assert.deepEqual(raster, createFieldRaster(shifted, 'temperature', 4, 2));
  assert.equal(raster.rgba.length, 32);
  assert.notDeepEqual(
    [...raster.rgba.slice(0, 3)],
    [...raster.rgba.slice(8, 11)],
  );
  assert.equal(createFieldRaster(snapshot, 'pressure'), null);
  assert.equal(createFieldRaster(snapshot, 'speed', 4000, 2000), null);
});

test('trail decay is independent of frame cadence and palette lookup clamps endpoints', () => {
  const remaining30 = (1 - trailEraseAlpha(1 / 30)) ** 30;
  const remaining60 = (1 - trailEraseAlpha(1 / 60)) ** 60;
  assert.ok(Math.abs(remaining30 - remaining60) < 1e-12);
  assert.ok(Math.abs(1 - trailEraseAlpha(0.65) - 0.5) < 1e-12);
  assert.equal(windTrailColor(-10), windTrailColor(0));
  assert.equal(windTrailColor(100), windTrailColor(30));
  assert.notEqual(windTrailColor(0), windTrailColor(30));
});

test('hot-loop sampling fills the supplied output without allocating a replacement', () => {
  const result = {};
  assert.equal(
    sampleWind(
      { ...snapshot.grid, u: snapshot.u, v: snapshot.v },
      0,
      0,
      result,
    ),
    result,
  );
  assert.deepEqual(result, { u: 3, v: 4 });
});
