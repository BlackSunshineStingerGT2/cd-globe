/**
 * @module cd/navalLayer
 * @description US Navy ships from reported sea areas, with a left-stack panel.
 * CD addition.
 *
 * Mounted from src/main.js with the viewer the started app hands back, the
 * same way as the aircraft pane, so no upstream module hosts it.
 *
 * What it draws, and what it must never imply
 * -------------------------------------------
 * US warships do not broadcast AIS in theatre, so there is no feed. The list
 * comes from weekly public reporting (USNI fleet tracker, INSS, Navy
 * releases), kept by hand on the platform and served at
 * config.endpoints.naval (GET /api/globe/naval). It is the same file
 * StraitWatch draws, so the two maps cannot disagree.
 *
 * Each ship is a plotting point chosen inside its reported sea area, with an
 * error radius. So: icons are bow-north and never move or turn (there is no
 * heading or track to show), every one carries a dashed ring for its error,
 * reports older than the server's stale threshold go grey, and the panel
 * says "reported area" before it says anything else.
 *
 * The panel joins #left-panel-stack as an ordinary [data-panel-id] child, so
 * the shell's layout engine budgets it like DATA LAYERS and SCENES and its
 * accordion folds it like them. Collapse goes through the shell's own
 * setPanelCollapsed. If the platform does not advertise the endpoint, nothing
 * is mounted at all.
 */
import * as Cesium from 'cesium';
import { cdAuthToken } from './platformConfig.js';
import { setText } from './textPatch.js';
import {
  hullNumber,
  iconKey,
  iconSize,
  iconUri,
  selectionSize,
  selectionUri,
} from './navalIcons.js';

const PANEL_ID = 'cd-naval-panel';
const POLL_MS = 10 * 60 * 1000; // the list changes weekly
const LABEL_MAX_HEIGHT = 3_000_000; // metres of camera height
const LABEL_FONT = '600 11px "JetBrains Mono", "SF Mono", monospace';
const LABEL_CHAR_PX = 7;
const LABEL_H = 18;
const LABEL_DX = 14;
const PREFS_KEY = 'cd.naval.prefs';

// Pale steel for reported ships: not the cyan of a tracked contact and not
// the amber of military aircraft. Grey once the report is stale. The
// selection takes the HUD accent, the same cue a tracked aircraft gets.
const SHIP = Cesium.Color.fromCssColorString('#e3ebf5');
const STALE = Cesium.Color.fromCssColorString('#8d99a8');
const ACCENT = Cesium.Color.fromCssColorString('#00d4ff');
// The renders are full colour, so they are never tinted to show state: a
// stale report darkens and fades the paintwork, and selection gets brackets.
const ART_STALE = new Cesium.Color(0.55, 0.58, 0.62, 0.85);

const TYPE_LABEL = {
  carrier: 'Aircraft carrier',
  amphib: 'Amphibious ship',
  cruiser: 'Cruiser',
  destroyer: 'Destroyer',
  esb: 'Expeditionary sea base',
  lcs: 'Littoral combat ship',
  other: 'Warship',
};
const TYPE_ORDER = [
  'carrier',
  'amphib',
  'cruiser',
  'destroyer',
  'esb',
  'lcs',
  'other',
];
const BASIS = {
  reported: [
    'Named in area',
    'USNI, INSS or the Navy names this ship in this sea area.',
  ],
  aggregator: [
    'Aggregator only',
    'Only a hobbyist deployment tracker places it here. Likely, not confirmed.',
  ],
  theatre: [
    'Theatre only',
    'Reported in the CENTCOM area with no sea area given. The point is a guess.',
  ],
};

/** "USS John Paul Jones" -> "JOHN PAUL JONES". */
export function shortName(ship) {
  return String(ship?.name || ship?.hull || '?')
    .replace(/^USS\s+/i, '')
    .toUpperCase();
}

export function ageLabel(days) {
  if (typeof days !== 'number' || !Number.isFinite(days)) return 'date unknown';
  if (days <= 0) return 'today';
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/**
 * Closed ring of [lon, lat] around a point, by the great-circle destination
 * formula, so it stays round at any latitude.
 */
export function ringPoints(lat, lon, radiusKm, n = 72) {
  const d = radiusKm / 6371.0088;
  const p1 = (lat * Math.PI) / 180;
  const l1 = (lon * Math.PI) / 180;
  const out = [];
  for (let i = 0; i <= n; i++) {
    const b = (2 * Math.PI * i) / n;
    const p2 = Math.asin(
      Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b),
    );
    const l2 =
      l1 +
      Math.atan2(
        Math.sin(b) * Math.sin(d) * Math.cos(p1),
        Math.cos(d) - Math.sin(p1) * Math.sin(p2),
      );
    out.push([
      (((l2 * 180) / Math.PI + 540) % 360) - 180,
      (p2 * 180) / Math.PI,
    ]);
  }
  return out;
}

/**
 * Icon scale for a camera height. Log-linear: 1.25 at 1,000 km (the theatre
 * view), 0.5 at 10,000 km, about 2 at 100 km and capped at 3 when the camera
 * is right over a ship, so the deck detail is there to see up close without
 * the fleet turning into a blanket at theatre zoom. Cesium's NearFarScalar
 * cannot do this: it interpolates linearly in distance, so any near value big
 * enough for a close look also inflates the theatre view.
 */
export function zoomScale(heightM) {
  const h = Math.max(1, Number(heightM) || 1);
  const s = 1.25 - 0.75 * Math.log10(h / 1e6);
  return Math.min(3, Math.max(0.45, s));
}

/** Ships grouped by reported area, areas in first-seen order, ships by type. */
export function groupByArea(ships) {
  const groups = new Map();
  for (const s of ships) {
    const key = s.area || 'Unknown area';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  for (const list of groups.values())
    list.sort(
      (a, b) =>
        TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
        String(a.hull).localeCompare(String(b.hull)),
    );
  return groups;
}

function readPrefs() {
  try {
    const p = JSON.parse(globalThis.localStorage?.getItem(PREFS_KEY) || '{}');
    return {
      ships: p.ships !== false,
      rings: p.rings !== false,
      med: p.med === true,
    };
  } catch {
    return { ships: true, rings: true, med: false };
  }
}
function savePrefs(p) {
  try {
    globalThis.localStorage?.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* private mode, quota: preferences are a convenience */
  }
}

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );

const STYLE = `
#left-panel-stack > #${PANEL_ID}{position:relative;top:auto;right:auto;bottom:auto;left:auto;
  z-index:auto;max-height:none;flex:0 0 auto;min-height:0;pointer-events:auto;order:3}
#left-panel-stack > #${PANEL_ID}:not(.collapsed){box-sizing:border-box;
  flex:0 1 var(--left-panel-allocated-height,auto);height:var(--left-panel-allocated-height,auto);
  max-height:var(--left-panel-allocated-height,100%)}
#${PANEL_ID}{width:340px}
#${PANEL_ID}.collapsed{width:var(--left-collapsed-width)}
#${PANEL_ID} .panel-glow{position:absolute;inset:-20px;pointer-events:none;opacity:.25;
  filter:blur(20px);background:radial-gradient(ellipse at center,var(--accent-dim) 0%,transparent 60%)}
#${PANEL_ID} .cd-nv-inner{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;
  box-sizing:border-box;background:var(--glass-bg);border:1px solid var(--glass-border);
  border-radius:var(--panel-radius);padding:14px 16px 12px;
  backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);
  box-shadow:0 8px 32px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.03) inset,0 1px 0 rgba(255,255,255,.06) inset}
#${PANEL_ID}.collapsed .cd-nv-inner{padding-bottom:10px}
#${PANEL_ID} .panel-header{flex:0 0 auto}
#${PANEL_ID}.collapsed .panel-header{margin-bottom:2px}
#${PANEL_ID}.collapsed .panel-title{font-size:8px;letter-spacing:1.8px}
#${PANEL_ID}.collapsed .cd-nv-count{display:none}
#${PANEL_ID}:not(.collapsed) .panel-header{position:sticky;top:0}
#${PANEL_ID} .cd-nv-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:0 2px 0 0;
  overscroll-behavior:contain;scrollbar-width:thin;font-size:12px;color:var(--text-primary)}
#${PANEL_ID}.collapsed .cd-nv-body{display:none !important}
#${PANEL_ID} .cd-nv-count{font-family:var(--font-mono);font-size:9px;color:var(--text-secondary);
  letter-spacing:.1em;margin-left:6px}
.cd-nv-toggles{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 8px}
.cd-nv-toggle{font-family:var(--font-mono);font-size:10px;letter-spacing:.1em;padding:3px 8px;
  border-radius:3px;border:1px solid var(--glass-border);background:transparent;
  color:var(--text-secondary);cursor:pointer}
.cd-nv-toggle[aria-pressed="true"]{border-color:var(--accent);color:var(--accent)}
.cd-nv-note{font-size:10.5px;line-height:1.45;color:var(--text-secondary);margin:2px 0 8px}
.cd-nv-note b{color:var(--text-primary);font-weight:600}
.cd-nv-note .old{color:#ffc46b}
.cd-nv-sel{border:1px solid var(--accent);border-radius:4px;padding:8px 10px;margin:4px 0 10px;
  background:rgba(0,212,255,.05)}
.cd-nv-sel-head{display:flex;align-items:baseline;gap:8px}
.cd-nv-sel-name{font-size:16px;font-weight:600;letter-spacing:.03em;flex:1 1 auto}
.cd-nv-x{background:none;border:0;color:var(--text-secondary);cursor:pointer;font-size:15px;line-height:1}
.cd-nv-sub{font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;color:var(--text-secondary);
  margin:2px 0 6px}
.cd-nv-row{display:flex;justify-content:space-between;gap:12px;padding:2px 0;
  border-bottom:1px solid var(--glass-border)}
.cd-nv-row span:first-child{color:var(--text-secondary)}
.cd-nv-row span:last-child{font-family:var(--font-mono);text-align:right}
.cd-nv-row.warn span:last-child{color:#ffc46b}
.cd-nv-text{margin-top:6px;font-size:11px;line-height:1.45;color:var(--text-secondary)}
.cd-nv-text a{color:var(--accent);text-decoration:none}
.cd-nv-text a:hover{text-decoration:underline}
.cd-nv-stale{margin:6px 0;padding:4px 6px;border:1px solid #ffc46b;color:#ffc46b;
  font-family:var(--font-mono);font-size:10px;letter-spacing:.08em}
.cd-nv-area{margin-top:10px;font-family:var(--font-mono);font-size:10px;letter-spacing:.14em;
  color:var(--text-dim);text-transform:uppercase}
.cd-nv-ship{display:flex;align-items:center;gap:8px;width:100%;padding:3px 4px;margin:0;
  background:none;border:0;border-bottom:1px solid var(--glass-border);color:inherit;
  font:inherit;text-align:left;cursor:pointer}
.cd-nv-ship:hover{background:rgba(255,255,255,.04)}
.cd-nv-ship.on{background:rgba(0,212,255,.08)}
.cd-nv-ship img{width:12px;height:30px;object-fit:contain;flex:0 0 auto}
.cd-nv-ship .h{font-family:var(--font-mono);font-size:10.5px;color:var(--text-secondary);width:58px;flex:0 0 auto}
.cd-nv-ship .n{flex:1 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cd-nv-ship .a{font-family:var(--font-mono);font-size:10px;color:var(--text-dim)}
.cd-nv-ship.stale .n{color:var(--text-secondary)}
`;

/**
 * Mount the layer and panel. Returns a dispose function.
 *
 * @param {object} options
 * @param {import('cesium').Viewer} options.viewer
 * @param {object} [options.shell] the shell's style manager (setPanelCollapsed)
 * @param {object} [options.config] the platform config (endpoints.naval)
 * @param {Function} [options.fetchImpl]
 */
export function initNavalLayer({
  viewer,
  shell = null,
  config = globalThis.window?.__cdGlobeConfig || {},
  fetchImpl = (...a) => fetch(...a),
} = {}) {
  const endpoint = config?.endpoints?.naval;
  if (typeof document === 'undefined' || !viewer || !endpoint) return () => {};
  const scene = viewer.scene;

  const prefs = readPrefs();
  let feed = null; // last response minus ships
  let ships = []; // last ship list
  let selected = null; // hull
  let generation = 0;
  let pollTimer = 0;
  let disposed = false;

  // ---- globe primitives ---------------------------------------------------
  const rings = scene.primitives.add(new Cesium.PolylineCollection());
  // Brackets first so they draw under the ship they frame.
  const brackets = scene.primitives.add(
    new Cesium.BillboardCollection({ scene }),
  );
  const icons = scene.primitives.add(new Cesium.BillboardCollection({ scene }));
  const labels = scene.primitives.add(new Cesium.LabelCollection({ scene }));
  const fleet = new Map(); // hull -> { ship, key, bb, label, pos }
  let zoom = 1; // zoomScale() of the current camera height
  const selBB = brackets.add({
    alignedAxis: Cesium.Cartesian3.UNIT_Z,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    show: false,
  });
  const bracketUris = new Map(); // icon key -> data URI

  // ---- panel ---------------------------------------------------------------
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.className = 'panel-collapsible collapsed';
  panel.setAttribute('data-panel-id', PANEL_ID);
  panel.setAttribute('aria-label', 'US Navy reported positions');
  panel.innerHTML =
    '<div class="panel-glow"></div><div class="cd-nv-inner">' +
    '<div class="panel-header"><span class="panel-title">US NAVY</span>' +
    '<span class="cd-nv-count"></span><span class="panel-divider"></span>' +
    `<button class="panel-collapse-btn" data-collapse-target="${PANEL_ID}" title="Expand panel">+</button>` +
    '</div><div class="cd-nv-body">' +
    '<div class="cd-nv-toggles">' +
    '<button class="cd-nv-toggle" data-pref="ships">SHIPS</button>' +
    '<button class="cd-nv-toggle" data-pref="rings">RINGS</button>' +
    '<button class="cd-nv-toggle" data-pref="med">MED</button>' +
    '</div><div class="cd-nv-note"></div><div class="cd-nv-sel" hidden></div>' +
    '<div class="cd-nv-list"></div></div></div>';
  const countEl = panel.querySelector('.cd-nv-count');
  const noteEl = panel.querySelector('.cd-nv-note');
  const selEl = panel.querySelector('.cd-nv-sel');
  const listEl = panel.querySelector('.cd-nv-list');
  const toggleBtn = panel.querySelector('.panel-collapse-btn');
  const stack = document.getElementById('left-panel-stack');
  (stack || document.body).appendChild(panel);

  function setCollapsed(collapsed) {
    if (typeof shell?.setPanelCollapsed === 'function') {
      // persist/syncShare off: this panel is not part of the saved or shared
      // layout upstream knows about.
      shell.setPanelCollapsed(PANEL_ID, collapsed, {
        explicit: true,
        persist: false,
        syncShare: false,
      });
    } else {
      panel.classList.toggle('collapsed', collapsed);
    }
    syncGlyph();
  }
  function syncGlyph() {
    const c = panel.classList.contains('collapsed');
    setText(toggleBtn, c ? '+' : '−');
    toggleBtn.title = c ? 'Expand panel' : 'Collapse panel';
  }
  // A click would move focus off the map onto the button; the map keeps it.
  toggleBtn.addEventListener('mousedown', (e) => e.preventDefault());
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setCollapsed(!panel.classList.contains('collapsed'));
  });
  const glyphObserver =
    typeof MutationObserver === 'function'
      ? new MutationObserver(syncGlyph)
      : null;
  glyphObserver?.observe(panel, {
    attributes: true,
    attributeFilter: ['class'],
  });

  for (const btn of panel.querySelectorAll('.cd-nv-toggle')) {
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.dataset.pref;
      prefs[key] = !prefs[key];
      savePrefs(prefs);
      syncToggles();
      if (key === 'med') load();
      else applyVisibility();
    });
  }
  function syncToggles() {
    for (const btn of panel.querySelectorAll('.cd-nv-toggle')) {
      const on = !!prefs[btn.dataset.pref];
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (btn.dataset.pref !== 'ships') btn.disabled = !prefs.ships;
    }
  }

  listEl.addEventListener('click', (e) => {
    const row = e.target.closest?.('.cd-nv-ship');
    if (!row) return;
    e.stopPropagation();
    select(row.dataset.hull, { fly: true });
  });
  selEl.addEventListener('click', (e) => {
    if (e.target.closest?.('.cd-nv-x')) {
      e.stopPropagation();
      select(null);
    }
  });

  // ---- data ----------------------------------------------------------------
  async function load() {
    const mine = ++generation;
    const token = cdAuthToken();
    let body;
    try {
      const res = await fetchImpl(
        `${endpoint}?med=${prefs.med ? 'true' : 'false'}`,
        {
          credentials: 'same-origin',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (!res.ok) throw new Error(String(res.status));
      body = await res.json();
    } catch (error) {
      if (mine === generation && !disposed) {
        feed = {
          note: `naval list unavailable (${error?.message || 'network'})`,
        };
        renderPanel();
      }
      return;
    }
    if (mine !== generation || disposed) return;
    const { ships: list = [], ...rest } = body || {};
    feed = rest;
    ships = list.filter(
      (s) =>
        s &&
        s.hull &&
        Number.isFinite(Number(s.lat)) &&
        Number.isFinite(Number(s.lon)),
    );
    if (selected && !ships.some((s) => s.hull === selected)) selected = null;
    applyShips();
    renderPanel();
  }

  // ---- drawing ---------------------------------------------------------------
  function applyShips() {
    const seen = new Set();
    for (const ship of ships) {
      seen.add(ship.hull);
      const key = iconKey(ship);
      const { width, height } = iconSize(key);
      const pos = Cesium.Cartesian3.fromDegrees(
        Number(ship.lon),
        Number(ship.lat),
        0,
      );
      let st = fleet.get(ship.hull);
      if (!st) {
        st = {
          bb: icons.add({
            id: { cdNavalHull: ship.hull },
            // Bow north on the ground, not up on the screen: there is no
            // heading to show, and a north-pointing hull reads as a map symbol
            // rather than as a track.
            alignedAxis: Cesium.Cartesian3.UNIT_Z,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          }),
          label: labels.add({
            id: { cdNavalHull: ship.hull },
            font: LABEL_FONT,
            fillColor: SHIP,
            outlineColor: Cesium.Color.BLACK.withAlpha(0.85),
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            showBackground: true,
            backgroundColor:
              Cesium.Color.fromCssColorString('rgba(9,13,19,0.72)'),
            backgroundPadding: new Cesium.Cartesian2(5, 3),
            horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            pixelOffset: new Cesium.Cartesian2(LABEL_DX, 0),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            show: false,
          }),
        };
        fleet.set(ship.hull, st);
      }
      st.ship = ship;
      st.key = key;
      st.pos = pos;
      // Each ship carries its own hull number painted on deck.
      st.bb.image = iconUri(key, hullNumber(ship));
      st.bb.width = width;
      st.bb.height = height;
      st.bb.position = pos;
      st.label.position = pos;
      st.label.text = `${ship.hull}  ${shortName(ship)}`;
    }
    for (const [hull, st] of [...fleet]) {
      if (seen.has(hull)) continue;
      icons.remove(st.bb);
      labels.remove(st.label);
      fleet.delete(hull);
    }
    restyle();
    rebuildRings();
    applyVisibility();
  }

  function restyle() {
    for (const [hull, st] of fleet) {
      const on = hull === selected;
      st.bb.color = st.ship.stale ? ART_STALE : Cesium.Color.WHITE;
      st.bb.scale = zoom * (on ? 1.25 : 1);
      // Label clears the hull whatever its current size.
      const half = (iconSize(st.key).width / 2) * st.bb.scale;
      st.labelDx = Math.round(half + 8);
      st.label.pixelOffset = new Cesium.Cartesian2(st.labelDx, 0);
      st.label.fillColor = on ? ACCENT : st.ship.stale ? STALE : SHIP;
    }
    const st = selected ? fleet.get(selected) : null;
    if (!st) {
      selBB.show = false;
      return;
    }
    const { width, height } = selectionSize(st.key);
    if (!bracketUris.has(st.key))
      bracketUris.set(st.key, selectionUri(width, height));
    selBB.image = bracketUris.get(st.key);
    selBB.width = width;
    selBB.height = height;
    selBB.position = st.pos;
    selBB.scale = zoom * 1.25;
    selBB.show = true;
  }

  function rebuildRings() {
    rings.removeAll();
    for (const [hull, st] of fleet) {
      const on = hull === selected;
      if (!prefs.rings && !on) continue;
      const s = st.ship;
      const color = on ? ACCENT : s.stale ? STALE : SHIP;
      rings.add({
        positions: Cesium.Cartesian3.fromDegreesArray(
          ringPoints(
            Number(s.lat),
            Number(s.lon),
            Number(s.radius_km) || 300,
          ).flat(),
        ),
        width: on ? 2 : 1,
        material: Cesium.Material.fromType('PolylineDash', {
          color: color.withAlpha(on ? 0.9 : 0.28),
          dashLength: 14,
        }),
      });
    }
  }

  function applyVisibility() {
    icons.show = prefs.ships;
    brackets.show = prefs.ships;
    labels.show = prefs.ships;
    rings.show = prefs.ships;
    rebuildRings();
    declutter();
    scene.requestRender?.();
  }

  /**
   * Show the labels that fit. Ships here sit 50 to 100 km apart, so at
   * theatre zoom most labels must give way; the selected ship and capital
   * ships keep theirs first.
   */
  function declutter() {
    if (disposed || !prefs.ships) return;
    const z = zoomScale(viewer.camera.positionCartographic.height);
    if (Math.abs(z - zoom) > 0.01) {
      zoom = z;
      restyle();
    }
    const tooHigh =
      viewer.camera.positionCartographic.height > LABEL_MAX_HEIGHT;
    const canvas = scene.canvas;
    const cand = [];
    for (const [hull, st] of fleet) {
      st.label.show = false;
      if (tooHigh && hull !== selected) continue;
      const win = Cesium.SceneTransforms.worldToWindowCoordinates(
        scene,
        st.pos,
      );
      if (
        !win ||
        win.x < 0 ||
        win.y < 0 ||
        win.x > canvas.clientWidth ||
        win.y > canvas.clientHeight
      )
        continue;
      const rank =
        (hull === selected ? 100 : 0) - TYPE_ORDER.indexOf(st.ship.type);
      cand.push({ st, win, rank });
    }
    cand.sort((a, b) => b.rank - a.rank);
    const placed = [];
    for (const c of cand) {
      const w = c.st.label.text.length * LABEL_CHAR_PX + 12;
      const box = {
        x0: c.win.x + (c.st.labelDx ?? LABEL_DX) - 2,
        x1: c.win.x + (c.st.labelDx ?? LABEL_DX) + w,
        y0: c.win.y - LABEL_H / 2,
        y1: c.win.y + LABEL_H / 2,
      };
      if (
        placed.some(
          (p) =>
            box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0,
        )
      )
        continue;
      placed.push(box);
      c.st.label.show = true;
    }
  }
  let declutterFrame = 0;
  const scheduleDeclutter = () => {
    if (declutterFrame) return;
    declutterFrame = requestAnimationFrame(() => {
      declutterFrame = 0;
      declutter();
    });
  };
  const removeCamChanged =
    viewer.camera.changed.addEventListener(scheduleDeclutter);
  const removeMoveEnd =
    viewer.camera.moveEnd.addEventListener(scheduleDeclutter);

  // ---- selection -------------------------------------------------------------
  function select(hull, { fly = false } = {}) {
    selected = hull || null;
    restyle();
    rebuildRings();
    declutter();
    renderPanel();
    if (!selected) return;
    if (panel.classList.contains('collapsed')) setCollapsed(false);
    const st = fleet.get(selected);
    if (fly && st) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          Number(st.ship.lon),
          Number(st.ship.lat),
          Math.max(900_000, (Number(st.ship.radius_km) || 300) * 4200),
        ),
        duration: 1.6,
      });
    }
  }

  const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
  handler.setInputAction((click) => {
    if (!prefs.ships) return;
    const hull = scene.pick(click.position)?.id?.cdNavalHull;
    if (hull) select(hull);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  const onKey = (event) => {
    if (event.key !== 'Escape' || !selected) return;
    const t = event.target;
    if (
      t &&
      (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
    )
      return;
    select(null);
  };
  window.addEventListener('keydown', onKey);

  // ---- panel rendering ---------------------------------------------------------
  function renderPanel() {
    setText(countEl, ships.length ? `· ${ships.length}` : '');
    if (feed?.note && !ships.length) {
      noteEl.innerHTML = esc(feed.note);
    } else if (feed) {
      const age = feed.compiled_age_days;
      const old = typeof age === 'number' && age > (feed.stale_days || 10);
      noteEl.innerHTML =
        '<b>Reported sea areas, not fixes.</b> Warships run without AIS, so each icon is placed ' +
        'inside its last reported area and the dashed ring is the error. ' +
        `<span class="${old ? 'old' : ''}">List as of ${esc(feed.as_of || '?')} ` +
        `(updated ${esc(ageLabel(age))}${old ? ', OUT OF DATE' : ''}).</span>` +
        (feed.unnamed || []).map((u) => ` ${esc(u)}`).join('');
    }

    const st = selected ? fleet.get(selected) : null;
    if (st) {
      const s = st.ship;
      const [basis, basisText] = BASIS[s.confidence] || BASIS.aggregator;
      selEl.hidden = false;
      selEl.innerHTML =
        `<div class="cd-nv-sel-head"><span class="cd-nv-sel-name">${esc(s.name || s.hull)}</span>` +
        '<button class="cd-nv-x" title="Clear selection">×</button></div>' +
        `<div class="cd-nv-sub">${esc(s.hull)} · ${esc(s.class || '')} ${esc((TYPE_LABEL[s.type] || TYPE_LABEL.other).toLowerCase())} · ${esc(s.group || '')}</div>` +
        (s.stale
          ? `<div class="cd-nv-stale">REPORT ${typeof s.age_days === 'number' ? `${s.age_days} DAYS` : 'OF UNKNOWN'} OLD · MAY HAVE LEFT THIS AREA</div>`
          : '') +
        `<div class="cd-nv-row warn"><span>Reported area</span><span>${esc(s.area)}</span></div>` +
        `<div class="cd-nv-row"><span>Reported</span><span>${esc(s.as_of || '—')} (${esc(ageLabel(s.age_days))})</span></div>` +
        `<div class="cd-nv-row${s.confidence !== 'reported' ? ' warn' : ''}"><span>Basis</span><span>${esc(basis)}</span></div>` +
        `<div class="cd-nv-row"><span>Position error</span><span>± ${Math.round(Number(s.radius_km) || 0)} km</span></div>` +
        `<div class="cd-nv-row"><span>Fleet</span><span>${esc(s.fleet || '5th')} Fleet</span></div>` +
        `<div class="cd-nv-text">${s.note ? `${esc(s.note)}<br>` : ''}${esc(basisText)} ` +
        `Plotting point ${Number(s.lat).toFixed(2)}, ${Number(s.lon).toFixed(2)} is not a position report.` +
        (s.source_url
          ? `<br><a href="${esc(s.source_url)}" target="_blank" rel="noreferrer noopener">${esc(s.source_title || 'Source')} ↗</a>`
          : '') +
        '</div>';
    } else {
      selEl.hidden = true;
      selEl.innerHTML = '';
    }

    let html = '';
    for (const [area, list] of groupByArea(ships)) {
      html += `<div class="cd-nv-area">${esc(area)} · ${list.length}</div>`;
      for (const s of list) {
        html +=
          `<button class="cd-nv-ship${s.hull === selected ? ' on' : ''}${s.stale ? ' stale' : ''}" data-hull="${esc(s.hull)}">` +
          `<img alt="" src="${iconUri(iconKey(s), hullNumber(s))}">` +
          `<span class="h">${esc(s.hull)}</span><span class="n">${esc(shortName(s))}</span>` +
          `<span class="a">${esc(typeof s.age_days === 'number' ? `${s.age_days}d` : '?')}</span></button>`;
      }
    }
    listEl.innerHTML = html;
  }

  syncToggles();
  syncGlyph();
  load();
  pollTimer = setInterval(load, POLL_MS);

  return function dispose() {
    disposed = true;
    clearInterval(pollTimer);
    if (declutterFrame) cancelAnimationFrame(declutterFrame);
    removeCamChanged?.();
    removeMoveEnd?.();
    handler.destroy();
    window.removeEventListener('keydown', onKey);
    glyphObserver?.disconnect();
    if (!viewer.isDestroyed?.()) {
      scene.primitives.remove(rings);
      scene.primitives.remove(brackets);
      scene.primitives.remove(icons);
      scene.primitives.remove(labels);
    }
    panel.remove();
    style.remove();
  };
}
