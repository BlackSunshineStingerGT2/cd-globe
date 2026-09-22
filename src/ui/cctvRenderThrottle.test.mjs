// CD: the CCTV panel's render throttle and unchanged-text guard.
//
// The flicker came from a loop: every frame-loaded event rendered the panel,
// every render replaced a dozen text nodes even when the text was identical,
// and the right rail re-measures on any mutation inside it. These pin both
// halves of the fix.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { _renderCctvState } from './cctvPresentation.js';
import { setText } from '../cd/textPatch.js';

test('setText leaves an element alone when the text is unchanged', () => {
  let writes = 0;
  const el = {
    _t: 'CCTV ON',
    get textContent() {
      return this._t;
    },
    set textContent(v) {
      writes += 1;
      this._t = v;
    },
  };
  assert.equal(setText(el, 'CCTV ON'), false);
  assert.equal(writes, 0, 'no write means no replaced text node');
  assert.equal(setText(el, 'CCTV OFF'), true);
  assert.equal(writes, 1);
  assert.equal(setText(null, 'x'), false);
});

/** A shell with every element absent, counting full renders. */
function panelContext() {
  const ctx = {
    destroyed: false,
    renders: 0,
    actions: { isEnabled: () => true, setPanelCollapsed() {} },
    _lastSeenCctvActiveId: null,
    _updateCctvSyncChip() {
      ctx.renders += 1; // runs exactly once per full render
    },
    _syncCctvCalReadout() {},
    _syncCctvSourceBadge() {},
    _typeCctvSummary() {},
    _calBadgeLabel: () => '',
    _queueCctvFrame() {},
    _clearCctvFrame() {},
  };
  // Mirrors the shell, which exposes it as a method (cctvControls.js); the
  // throttle's trailing render calls it through `this`.
  ctx._renderCctvState = (state) => _renderCctvState.call(ctx, state);
  ctx.render = ctx._renderCctvState;
  return ctx;
}

const loadingState = (loaded, activeCameraId = 'cam-1') => ({
  enabled: true,
  activeCameraId,
  cameras: [],
  loading: { active: true, loaded, total: 250 },
});

test('bulk loading renders at most 4 times a second', () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  try {
    const ctx = panelContext();
    // 100 frame-loaded notifications spread over one second.
    for (let i = 0; i < 100; i++) {
      ctx.render(loadingState(i));
      mock.timers.tick(10);
    }
    mock.timers.tick(300); // let the trailing render land
    assert.ok(ctx.renders <= 5, `rendered ${ctx.renders} times in ~1 s`);
    assert.ok(ctx.renders >= 4, 'still renders while loading');
  } finally {
    mock.timers.reset();
  }
});

test('the last state always lands, even when it arrives mid-throttle', () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  try {
    const ctx = panelContext();
    ctx.render(loadingState(1));
    ctx.render(loadingState(2));
    ctx.render(loadingState(250));
    mock.timers.tick(300);
    assert.equal(ctx._cctvState.loading.loaded, 250);
  } finally {
    mock.timers.reset();
  }
});

test('a camera change is never delayed by the throttle', () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  try {
    const ctx = panelContext();
    ctx.render(loadingState(1, 'cam-1'));
    ctx.render(loadingState(2, 'cam-2'));
    assert.equal(ctx._cctvState.activeCameraId, 'cam-2', 'rendered at once');
  } finally {
    mock.timers.reset();
  }
});

test('outside bulk loading every state renders immediately', () => {
  const ctx = panelContext();
  for (let i = 0; i < 5; i++)
    ctx.render({ enabled: true, activeCameraId: 'cam-1', cameras: [] });
  assert.equal(ctx.renders, 5);
});
