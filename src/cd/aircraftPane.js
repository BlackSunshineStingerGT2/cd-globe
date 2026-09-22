/**
 * @module cd/aircraftPane
 * @description ADSBx-style detail pane for the tracked aircraft. CD addition.
 *
 * Mounted from src/main.js with the viewer the started app hands back, so no
 * upstream file is edited to host it. It sits beside the tracked readout
 * rather than replacing it: the readout stays the compact label on the globe,
 * this is the expanded view in the right rail.
 *
 * Where each row comes from, and why:
 *
 *   /api/globe/aircraft/{hex}/live   the aircraft's raw adsb.lol record. The
 *       client's own records cannot feed this pane: its readsb normaliser drops
 *       squawk, emergency, rssi and the signal source before a record exists,
 *       and civil traffic arrives as OpenSky state vectors that never had them.
 *       CD serves the untouched record from caches it already holds, so this
 *       costs no upstream call. Polled while the pane is open.
 *
 *   /api/globe/aircraft/{hex}        identity and route from adsbdb. adsb.lol
 *       never carries ownOp or desc, so operator and full type come only from
 *       here. Fetched once per selection that holds.
 *
 *   countryForHex                    state of registry from the ICAO address
 *       block. Local; shown before anything is fetched.
 *
 * Nothing here requests any host but the CD API. The ADSBx and FAA links are
 * navigations the viewer chooses, not requests the pane makes. There is no
 * photo: Planespotters' terms forbid proxying its images and forbid showing
 * them in a member-only area, which God's Eye is.
 */
import * as Cesium from 'cesium';
import { cdAuthToken } from './platformConfig.js';
import { setText } from './textPatch.js';
import { countryForHex } from '../data/icaoCountry.js';

const HOLD_MS = 400; // selection must settle before anything is fetched
const LIVE_POLL_MS = 10_000;
const ENRICH_MEMO_MAX = 200;
const AIRCRAFT_LAYERS = new Set(['flights', 'military']);
const EMERGENCY_SQUAWKS = new Set(['7500', '7600', '7700']);
// Both already in the HUD palette (scenes.css alert, the amber used for
// warnings); the foundation tokens have no red of their own.
const ALERT = '#ff7272';
const DESCENDING = '#ffc46b';

const SOURCE_LABELS = [
  [/^(adsb|adsr)_/, 'ADS-B'],
  [/^mlat$/, 'MLAT'],
  [/^tisb_/, 'TIS-B'],
  [/^adsc$/, 'ADS-C'],
];

/** Signal source label for adsb.lol's `type` field. */
export function sourceLabel(type) {
  const t = String(type || '')
    .trim()
    .toLowerCase();
  if (!t) return '';
  for (const [re, label] of SOURCE_LABELS) if (re.test(t)) return label;
  return 'Other';
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value) {
  return String(value ?? '').trim();
}

/** Metres between two WGS-84 points. */
function haversineM(lat1, lon1, lat2, lon2) {
  const r = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * The rows the pane shows, from whatever is known so far. Pure: no DOM, no
 * fetch, so every rule in the spec is testable on its own.
 *
 * Rows with no data are omitted, except Registration and Operator, which say
 * "unknown" -- their absence is itself worth showing.
 *
 * @param {object} input
 * @param {string} input.hex
 * @param {string} [input.layerId]  'flights' | 'military'
 * @param {string} [input.label]    the layer's own display label
 * @param {object|null} [input.live]      raw adsb.lol record
 * @param {number} [input.snapshotAgeS]   age of the snapshot `live` came from
 * @param {object|null} [input.enriched]  /api/globe/aircraft response
 * @param {{lat:number,lon:number}|null} [input.viewCenter]
 */
export function buildPaneModel({
  hex,
  layerId = '',
  label = '',
  live = null,
  snapshotAgeS = 0,
  enriched = null,
  viewCenter = null,
}) {
  const rec = live || {};
  const en = enriched || {};
  const country = countryForHex(hex);
  const callsign = text(rec.flight) || text(label) || hex.toUpperCase();

  const identity = [];
  identity.push([
    'Registration',
    text(rec.r) || text(en.registration) || 'unknown',
  ]);
  if (country)
    identity.push(['Country', `${country.flag} ${country.name}`.trim()]);
  identity.push(['Operator', text(rec.ownOp) || text(en.owner) || 'unknown']);

  const code = text(rec.t) || text(en.icao_type);
  const desc =
    text(rec.desc) ||
    [text(en.manufacturer), text(en.type)].filter(Boolean).join(' ');
  if (code || desc)
    identity.push(['Type', [code, desc].filter(Boolean).join(' · ')]);

  const squawk = text(rec.squawk);
  const emergency = text(rec.emergency);
  if (squawk) {
    const extra =
      emergency && emergency.toLowerCase() !== 'none' ? ` · ${emergency}` : '';
    identity.push([
      'Squawk',
      `${squawk}${extra}`,
      EMERGENCY_SQUAWKS.has(squawk) || !!extra ? 'alert' : '',
    ]);
  }
  const route = en.route;
  if (layerId !== 'military' && route && (route.origin || route.destination)) {
    const code_ = (a) => text(a?.iata) || text(a?.icao) || '?';
    identity.push([
      'Route',
      `${code_(route.origin)} → ${code_(route.destination)}`,
    ]);
  }

  const spatial = [];
  const gs = finite(rec.gs);
  if (gs !== null) spatial.push(['Ground speed', `${Math.round(gs)} kt`]);
  if (text(rec.alt_baro).toLowerCase() === 'ground')
    spatial.push(['Altitude (baro)', 'ground']);
  else if (finite(rec.alt_baro) !== null)
    spatial.push([
      'Altitude (baro)',
      `${Math.round(finite(rec.alt_baro)).toLocaleString('en-US')} ft`,
    ]);
  if (finite(rec.alt_geom) !== null)
    spatial.push([
      'Altitude (geom)',
      `${Math.round(finite(rec.alt_geom)).toLocaleString('en-US')} ft`,
    ]);
  const rate = finite(rec.baro_rate) ?? finite(rec.geom_rate);
  if (rate !== null) {
    const r = Math.round(rate);
    spatial.push([
      'Vertical rate',
      `${r > 0 ? '+' : ''}${r.toLocaleString('en-US')} ft/min`,
      r > 0 ? 'up' : r < 0 ? 'down' : '',
    ]);
  }
  if (finite(rec.track) !== null)
    spatial.push(['Track', `${finite(rec.track).toFixed(1)}°`]);
  const lat = finite(rec.lat);
  const lon = finite(rec.lon);
  if (lat !== null && lon !== null) {
    spatial.push(['Position', `${lat.toFixed(3)}, ${lon.toFixed(3)}`]);
    if (
      viewCenter &&
      Number.isFinite(viewCenter.lat) &&
      Number.isFinite(viewCenter.lon)
    ) {
      const nmi = haversineM(viewCenter.lat, viewCenter.lon, lat, lon) / 1852;
      spatial.push([
        'From view center',
        `${nmi < 10 ? nmi.toFixed(1) : Math.round(nmi)} nmi`,
      ]);
    }
  }

  const signal = [];
  const src = sourceLabel(rec.type);
  if (src) signal.push(['Source', src]);
  if (finite(rec.rssi) !== null)
    signal.push(['RSSI', `${finite(rec.rssi).toFixed(1)} dB`]);
  const age = finite(snapshotAgeS) ?? 0;
  if (finite(rec.seen_pos) !== null)
    signal.push([
      'Last position',
      `${(finite(rec.seen_pos) + age).toFixed(1)} s`,
    ]);
  if (finite(rec.seen) !== null)
    signal.push(['Last seen', `${(finite(rec.seen) + age).toFixed(1)} s`]);

  // Military is a badge, not a row. The mil feed only carries dbFlags-bit-0
  // aircraft, so arriving on that layer is itself the flag.
  const military = layerId === 'military' || (Number(rec.dbFlags) & 1) === 1;

  const links = [
    [
      'View on ADSBx',
      `https://globe.adsbexchange.com/?icao=${encodeURIComponent(hex)}`,
    ],
  ];
  const reg = text(rec.r) || text(en.registration);
  if (/^N\d/i.test(reg))
    links.push([
      'FAA registry',
      `https://registry.faa.gov/AircraftInquiry/Search/NNumberResult?nNumberTxt=${encodeURIComponent(reg)}`,
    ]);

  return { hex, callsign, military, identity, spatial, signal, links };
}

const PANE_ID = 'aircraft-pane';
const CCTV_ID = 'cctv-panel';
const KEEP_HEADER = 'data-rail-keep-header';

// A right-rail panel like CCTV's, so the rail's own allocator budgets it: it
// only counts [data-panel-id] children, and it applies the allocated height by
// id. Without both, the pane was never counted and ran off the bottom of the
// viewport into the ALT/SUN readout.
const STYLE = `
#right-context-rail #${PANE_ID}{width:100%;max-height:100%;pointer-events:auto;
  box-sizing:border-box;border-radius:var(--panel-radius);background:var(--glass-bg);
  border:1px solid var(--glass-border);color:var(--text-primary);font-family:var(--font-sans)}
#${PANE_ID} .cd-ap-inner{display:flex;flex-direction:column;height:100%;min-height:0}
#${PANE_ID} .panel-header{flex:0 0 auto}
#${PANE_ID} .cd-ap-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:0 14px 12px;
  overscroll-behavior:contain;scrollbar-width:thin}
#right-context-rail.layout-focus > #${PANE_ID}:not(.collapsed){
  flex:0 1 var(--right-panel-allocated-height);height:var(--right-panel-allocated-height);
  min-height:0;max-height:var(--right-panel-allocated-height)}
#right-context-rail #${PANE_ID}.collapsed{width:var(--right-display-collapsed-width);margin-left:auto}
#right-context-rail #${PANE_ID}.collapsed .cd-ap-inner{height:50px;min-height:50px}
#${PANE_ID}.collapsed .cd-ap-body{display:none}
#right-context-rail.layout-exclusive > [data-panel-id][data-rail-keep-header].collapsed,
#right-context-rail.layout-focus.layout-exclusive > [data-panel-id][data-rail-keep-header].collapsed{
  display:block;flex:0 0 auto}
.cd-ap-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.cd-ap-callsign{font-size:20px;font-weight:600;letter-spacing:.04em}
.cd-ap-badge{font-family:var(--font-mono);font-size:10px;letter-spacing:.12em;
  padding:1px 6px;border:1px solid var(--accent);color:var(--accent);border-radius:3px}
.cd-ap-hex{font-family:var(--font-mono);font-size:12px;color:var(--text-secondary);margin-top:2px}
.cd-ap-sec{margin-top:10px;font-family:var(--font-mono);font-size:10px;
  letter-spacing:.14em;color:var(--text-dim)}
.cd-ap-row{display:flex;justify-content:space-between;gap:12px;font-size:12px;
  padding:2px 0;border-bottom:1px solid var(--glass-border)}
.cd-ap-row span:first-child{color:var(--text-secondary)}
.cd-ap-row span:last-child{font-family:var(--font-mono);text-align:right}
.cd-ap-row.alert span:last-child{color:${ALERT};font-weight:600}
.cd-ap-row.up span:last-child{color:var(--accent)}
.cd-ap-row.down span:last-child{color:${DESCENDING}}
.cd-ap-links{margin-top:10px;display:flex;gap:12px;font-size:11px}
.cd-ap-links a{color:var(--accent);text-decoration:none}
.cd-ap-links a:hover{text-decoration:underline}
.cd-ap-pending{color:var(--text-dim);font-size:11px;margin-top:6px}
`;

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );

/**
 * Mount the pane. Returns a disposer.
 * @param {object} deps
 * @param {object} deps.viewer   Cesium viewer from the started app
 * @param {object} [deps.shell]  the app shell (controls.styleManager). Its
 *   setPanelCollapsed keeps collapse buttons, the rail's preferred panel and
 *   layout scheduling consistent; without it the class is toggled directly.
 * @param {object} [deps.config] platform config (window.__cdGlobeConfig)
 * @param {Function} [deps.fetchImpl]
 */
export function initAircraftPane({
  viewer,
  shell = null,
  config = globalThis.window?.__cdGlobeConfig || {},
  fetchImpl = (...a) => fetch(...a),
} = {}) {
  if (typeof document === 'undefined' || !viewer) return () => {};
  const base = config?.endpoints?.aircraft || '';

  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  const pane = document.createElement('div');
  pane.id = PANE_ID;
  pane.className = 'panel-collapsible cd-aircraft-pane';
  pane.setAttribute('data-panel-id', PANE_ID);
  // No aria-live: the pane updates on every 10 s poll, and a live region
  // would have a screen reader read the whole of it out each time.
  pane.setAttribute('aria-label', 'Selected aircraft');
  pane.innerHTML =
    '<div class="panel-glow"></div><div class="cd-ap-inner">' +
    '<div class="panel-header"><span class="panel-title">AIRCRAFT</span>' +
    '<span class="panel-divider"></span>' +
    `<button class="panel-collapse-btn" data-collapse-target="${PANE_ID}" ` +
    'title="Collapse panel">▶</button></div>' +
    '<div class="cd-ap-body"></div></div>';
  const titleEl = pane.querySelector('.panel-title');
  const body = pane.querySelector('.cd-ap-body');
  const toggleBtn = pane.querySelector('.panel-collapse-btn');

  const memo = new Map(); // `${hex}|${callsign}` -> enrichment, this session
  let sel = null; // the current selection, replaced per select
  let generation = 0;
  let lastSignature = '';
  let rowEls = new Map(); // row label -> {row, value}
  let foldedCctv = false; // the pane folded CCTV, so closing should restore it

  const isOpen = (el) =>
    !!el && el.isConnected !== false && !el.classList.contains('collapsed');

  function syncGlyph() {
    setText(toggleBtn, pane.classList.contains('collapsed') ? '◀' : '▶');
  }

  function setCollapsed(id, collapsed) {
    const el = document.getElementById(id);
    if (!el) return;
    if (typeof shell?.setPanelCollapsed === 'function') {
      // persist/syncShare off: these moves are automatic, not the viewer's
      // saved layout, and must not be written into it.
      shell.setPanelCollapsed(id, collapsed, {
        explicit: true,
        persist: false,
        syncShare: false,
      });
    } else {
      el.classList.toggle('collapsed', collapsed);
    }
    if (id === PANE_ID) syncGlyph();
  }

  function attach() {
    if (pane.isConnected) return;
    const rail = document.getElementById('right-context-rail');
    const cctv = document.getElementById(CCTV_ID);
    if (rail && cctv && cctv.parentElement === rail) cctv.after(pane);
    else (rail || document.body).appendChild(pane);
    // While both are in the rail, whichever is folded stays as its header
    // (see hiddenWhenCollapsed in rightPanelRail.js). Scoped to the pair's
    // lifetime, so CCTV alone keeps upstream's exclusive-mode behaviour.
    pane.setAttribute(KEEP_HEADER, '');
    cctv?.setAttribute(KEEP_HEADER, '');
  }

  /** A newly selected aircraft is the active thing: it takes the rail. */
  function showPane() {
    attach();
    if (isOpen(document.getElementById(CCTV_ID))) {
      setCollapsed(CCTV_ID, true);
      foldedCctv = true;
    }
    if (pane.classList.contains('collapsed')) setCollapsed(PANE_ID, false);
    else syncGlyph();
  }

  // Keep the pair mutually exclusive whichever side acts: a camera click, the
  // CCTV header, or CCTV's own auto-expand on activation all fold the pane.
  let cctvWasOpen = isOpen(document.getElementById(CCTV_ID));
  const classObserver =
    typeof MutationObserver === 'function'
      ? new MutationObserver(() => {
          const cctvOpen = isOpen(document.getElementById(CCTV_ID));
          if (cctvOpen && !cctvWasOpen && isOpen(pane)) {
            foldedCctv = false;
            setCollapsed(PANE_ID, true);
          }
          cctvWasOpen = cctvOpen;
          syncGlyph();
        })
      : null;
  const cctvEl = document.getElementById(CCTV_ID);
  if (classObserver && cctvEl)
    classObserver.observe(cctvEl, {
      attributes: true,
      attributeFilter: ['class'],
    });
  if (classObserver)
    classObserver.observe(pane, {
      attributes: true,
      attributeFilter: ['class'],
    });

  // A click would move focus off the map onto the button; the map keeps it.
  toggleBtn?.addEventListener?.('mousedown', (event) => event.preventDefault());
  toggleBtn?.addEventListener?.('click', (event) => {
    event.stopPropagation();
    const expand = pane.classList.contains('collapsed');
    if (expand && isOpen(document.getElementById(CCTV_ID))) {
      setCollapsed(CCTV_ID, true);
      foldedCctv = true;
    }
    setCollapsed(PANE_ID, !expand);
  });

  function authHeaders() {
    const token = cdAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function getJson(url, signal) {
    const res = await fetchImpl(url, {
      credentials: 'same-origin',
      headers: authHeaders(),
      signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  }

  function viewCenter() {
    try {
      const canvas = viewer.scene.canvas;
      const hit = viewer.camera.pickEllipsoid(
        new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2),
        viewer.scene.globe.ellipsoid,
      );
      if (!hit) return null;
      const c = Cesium.Cartographic.fromCartesian(hit);
      return {
        lat: Cesium.Math.toDegrees(c.latitude),
        lon: Cesium.Math.toDegrees(c.longitude),
      };
    } catch {
      return null;
    }
  }

  function bodyHtml(m) {
    const rows = (list) =>
      list
        .map(
          ([k, v, cls]) =>
            `<div class="cd-ap-row ${cls || ''}" data-row="${esc(k)}">` +
            `<span>${esc(k)}</span><span>${esc(v)}</span></div>`,
        )
        .join('');
    const section = (title, list) =>
      list.length ? `<div class="cd-ap-sec">${title}</div>${rows(list)}` : '';
    return (
      `<div class="cd-ap-head"><span class="cd-ap-callsign">${esc(m.callsign)}</span>` +
      (m.military ? '<span class="cd-ap-badge">MILITARY</span>' : '') +
      '</div>' +
      `<div class="cd-ap-hex">${esc(m.hex.toUpperCase())}</div>` +
      section('IDENTITY', m.identity) +
      section('SPATIAL', m.spatial) +
      section('SIGNAL', m.signal) +
      (sel.live
        ? ''
        : '<div class="cd-ap-pending">Waiting for the next snapshot…</div>') +
      '<div class="cd-ap-links">' +
      m.links
        .map(
          ([t, href]) =>
            `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" tabindex="-1">${esc(t)}</a>`,
        )
        .join('') +
      '</div>'
    );
  }

  /**
   * Rebuild only when the set of rows changes; otherwise patch values in
   * place. A poll that moves the aircraft changes numbers, not structure, and
   * patching keeps it to the text nodes that actually changed: the rail
   * re-lays-out on any mutation inside it, so needless ones cost layout.
   */
  function render() {
    if (!sel) return;
    const m = buildPaneModel({ ...sel, viewCenter: viewCenter() });
    setText(titleEl, `AIRCRAFT · ${m.callsign}`);
    const all = [...m.identity, ...m.spatial, ...m.signal];
    const signature = JSON.stringify([
      m.hex,
      m.military,
      !!sel.live,
      all.map((r) => r[0]),
      m.links.map((l) => l[1]),
    ]);
    if (
      signature !== lastSignature ||
      typeof body.querySelectorAll !== 'function'
    ) {
      body.innerHTML = bodyHtml(m);
      lastSignature = signature;
      rowEls = new Map();
      for (const row of body.querySelectorAll?.('[data-row]') || [])
        rowEls.set(row.getAttribute('data-row'), {
          row,
          value: row.lastElementChild,
        });
      return;
    }
    setText(body.querySelector('.cd-ap-callsign'), m.callsign);
    for (const [label, value, cls] of all) {
      const el = rowEls.get(label);
      if (!el) continue;
      setText(el.value, value);
      const want = `cd-ap-row ${cls || ''}`;
      if (el.row.className !== want) el.row.className = want;
    }
  }

  function stop() {
    if (!sel) return;
    clearTimeout(sel.holdTimer);
    clearInterval(sel.pollTimer);
    sel.abort.abort();
  }

  function close() {
    stop();
    sel = null;
    lastSignature = '';
    rowEls = new Map();
    body.innerHTML = '';
    pane.remove();
    document.getElementById(CCTV_ID)?.removeAttribute(KEEP_HEADER);
    // Hand the rail back to the camera the pane displaced. A camera the
    // viewer has since collapsed themselves is not reopened.
    if (foldedCctv) {
      foldedCctv = false;
      const cctv = document.getElementById(CCTV_ID);
      if (cctv && cctv.classList.contains('collapsed'))
        setCollapsed(CCTV_ID, false);
    }
  }

  async function pollLive(mine) {
    if (!base || mine !== generation) return;
    try {
      const body = await getJson(
        `${base}/${encodeURIComponent(sel.hex)}/live`,
        sel.abort.signal,
      );
      if (mine !== generation) return;
      if (body?.record) {
        sel.live = body.record;
        sel.snapshotAgeS = body.snapshot_age_s || 0;
        if (!sel.layerId && body.layer) sel.layerId = body.layer;
      }
      render();
    } catch {
      /* aborted, or offline: keep what the pane already shows */
    }
  }

  async function enrich(mine) {
    if (!base || mine !== generation) return;
    const callsign = text(sel.live?.flight) || text(sel.label);
    const key = `${sel.hex}|${callsign}`;
    if (memo.has(key)) {
      sel.enriched = memo.get(key);
      render();
      return;
    }
    try {
      const qs = callsign ? `?callsign=${encodeURIComponent(callsign)}` : '';
      const body = await getJson(
        `${base}/${encodeURIComponent(sel.hex)}${qs}`,
        sel.abort.signal,
      );
      if (mine !== generation || !body) return;
      if (memo.size >= ENRICH_MEMO_MAX) memo.delete(memo.keys().next().value);
      memo.set(key, body);
      sel.enriched = body;
      render();
    } catch {
      /* aborted or failed: identity rows keep their live/unknown values */
    }
  }

  function select({ layerId, id, label }) {
    const hex = String(id || '')
      .trim()
      .toLowerCase();
    if (!/^[0-9a-f]{6}$/.test(hex)) return close();
    if (sel && sel.hex === hex) return; // same aircraft: keep polling
    stop();
    const mine = ++generation;
    sel = {
      hex,
      layerId,
      label,
      live: null,
      snapshotAgeS: 0,
      enriched: null,
      abort: new AbortController(),
      holdTimer: 0,
      pollTimer: 0,
    };
    // Header and country show at once; they cost nothing.
    showPane();
    render();
    // Everything that costs a request waits for the selection to settle, so
    // stepping through contacts fires nothing until the viewer stops on one.
    const current = sel;
    current.holdTimer = setTimeout(async () => {
      if (mine !== generation) return;
      await pollLive(mine);
      // Re-checked after the await: a new selection may have started while
      // the request was in flight, and `sel` would then be that one. Without
      // this it would inherit a timer nobody clears.
      if (mine !== generation) return;
      enrich(mine);
      current.pollTimer = setInterval(() => pollLive(mine), LIVE_POLL_MS);
    }, HOLD_MS);
  }

  const onSelected = (event) => {
    const d = event?.detail || {};
    if (AIRCRAFT_LAYERS.has(d.layerId)) select(d);
    else close();
  };
  // Tracking ended (or moved to something that is not an aircraft).
  const removeTracked = viewer.trackedEntityChanged?.addEventListener?.(() => {
    if (!viewer.trackedEntity) close();
  });
  const onKey = (event) => {
    // Closes the pane and lets the event carry on, so the app's own Esc
    // (exit tracking) still runs. Not handled when typing in a field.
    if (event.key !== 'Escape' || !sel) return;
    const t = event.target;
    if (
      t &&
      (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
    )
      return;
    close();
  };
  const onCleared = (event) => {
    if (
      sel &&
      (!event?.detail?.layerId || AIRCRAFT_LAYERS.has(event.detail.layerId))
    )
      close();
  };
  window.addEventListener('gev:awareness-subject-selected', onSelected);
  window.addEventListener('gev:awareness-subject-cleared', onCleared);
  window.addEventListener('keydown', onKey);

  return function dispose() {
    close();
    window.removeEventListener('gev:awareness-subject-selected', onSelected);
    window.removeEventListener('gev:awareness-subject-cleared', onCleared);
    window.removeEventListener('keydown', onKey);
    if (typeof removeTracked === 'function') removeTracked();
    classObserver?.disconnect();
    document.getElementById(CCTV_ID)?.removeAttribute(KEEP_HEADER);
    pane.remove();
    style.remove();
  };
}
