// CD: the one exception to upstream's exclusive mode. Under the tactical HUD a
// collapsed panel is hidden once any panel is expanded -- unless it is marked
// data-rail-keep-header, which the aircraft pane sets on itself and CCTV only
// while both are in the rail, so the pair folds to headers instead of vanishing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hiddenWhenCollapsed } from './rightPanelRail.js';

const panel = ({ collapsed, keep }) => ({
  classList: { contains: (c) => c === 'collapsed' && collapsed },
  hasAttribute: (a) => a === 'data-rail-keep-header' && keep,
});

test('an unmarked collapsed panel is hidden, as upstream intends', () => {
  assert.equal(
    hiddenWhenCollapsed(panel({ collapsed: true, keep: false })),
    true,
  );
});

test('a marked collapsed panel keeps its header', () => {
  assert.equal(
    hiddenWhenCollapsed(panel({ collapsed: true, keep: true })),
    false,
  );
});

test('an expanded panel is never hidden, marked or not', () => {
  assert.equal(
    hiddenWhenCollapsed(panel({ collapsed: false, keep: false })),
    false,
  );
  assert.equal(
    hiddenWhenCollapsed(panel({ collapsed: false, keep: true })),
    false,
  );
});
