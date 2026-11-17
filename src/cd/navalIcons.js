/**
 * @module cd/navalIcons
 * @description Top-down US Navy ship glyphs for the CD naval layer.
 *
 * Same conventions as src/data/aircraftIcons.js, so they sit naturally beside
 * the aircraft: bow up (toward -Y), white fill with a dark hairline so
 * billboard.color tints them, high-resolution SVG source down-sampled to the
 * billboard's explicit width/height for crisp edges. Detail (deck lines, gun
 * mounts, missile cells, helo spots) is drawn in translucent black, which
 * survives any tint because a tint multiplies white and leaves black alone.
 *
 * One glyph per silhouette the theatre actually holds: a carrier's angled
 * deck, a big-deck amphib's straight flight deck and island, the dock ships'
 * forward superstructure and aft well deck, cruisers and destroyers by length
 * and their fore/aft missile blocks, the expeditionary sea base's slab, and
 * the littoral ship's trimaran planform. Each reads by shape at ~40 px.
 */

// Every glyph is drawn in a 128-unit-long frame, bow at -64, origin at the
// centre. Each one declares its own viewBox width (vw: beam plus a margin for
// the edge stroke), so a destroyer is not letterboxed into a carrier's box
// and every hull fills its billboard. On-screen width follows from h * vw/128.
const VH = 128;
const box = (vw) => `viewBox="${-vw / 2} ${-VH / 2} ${vw} ${VH}"`;
const widthOf = (g) => Math.round(((g.h * g.vw) / VH) * 10) / 10;

const EDGE =
  'stroke="rgba(0,0,0,0.55)" stroke-width="1.6" stroke-linejoin="round"';
const INK = 'fill="rgba(0,0,0,0.42)"';
const LINE = 'stroke="rgba(0,0,0,0.42)" fill="none"';

function cells(x, y, cols, rows, s = 2.2, g = 0.7) {
  let out = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out += `<rect x="${(x + c * (s + g)).toFixed(2)}" y="${(y + r * (s + g)).toFixed(2)}" width="${s}" height="${s}" ${INK}/>`;
  return out;
}

const GLYPHS = {
  // Nimitz: angled landing deck kicked out to port, island to starboard,
  // two bow catapult tracks, four deck-edge elevators.
  carrier: {
    vw: 42,
    h: 72,
    body: `
      <path d="M-5,-60 L5,-60 L10,-50 L11.5,54 L9,60 L-9,60 L-11,50 L-17,42
               L-19,6 L-14,-8 L-10,-18 L-10,-50 Z" fill="white" ${EDGE}/>
      <path d="M4,56 L-14,-6" ${LINE} stroke-width="1.1" stroke-dasharray="3 2.2"/>
      <path d="M-9,52 L-17.4,36" ${LINE} stroke-width="0.8"/>
      <path d="M-3.5,-56 L-3.5,-22 M3.5,-56 L3.5,-28" ${LINE} stroke-width="0.9"/>
      <rect x="6.8" y="6" width="4" height="15" rx="0.8" ${INK}/>
      <rect x="7.6" y="9" width="2.4" height="3" fill="rgba(0,0,0,0.55)"/>
      <rect x="11.5" y="-4" width="2.6" height="7" ${INK}/>
      <rect x="11.5" y="24" width="2.6" height="7" ${INK}/>
      <rect x="11.5" y="34" width="2.6" height="7" ${INK}/>
      <rect x="-19.4" y="20" width="2.6" height="8" ${INK}/>`,
  },
  // Wasp / America: straight-deck flattop, island amidships to starboard,
  // landing spots down the port side.
  lhd: {
    vw: 32,
    h: 62,
    body: `
      <path d="M-7,-58 L7,-58 L12,-46 L12.5,58 L-12.5,58 L-12.5,-46 Z" fill="white" ${EDGE}/>
      <path d="M-6,-44 L-6,52" ${LINE} stroke-width="0.9" stroke-dasharray="2.5 2.5"/>
      ${[-36, -20, -4, 12, 28, 44].map((y) => `<circle cx="-6" cy="${y}" r="2.6" ${LINE} stroke-width="0.8"/>`).join('')}
      <rect x="6.5" y="-8" width="5" height="22" rx="0.8" ${INK}/>
      <rect x="7.4" y="-3" width="3.2" height="4" fill="rgba(0,0,0,0.55)"/>
      <rect x="12.4" y="20" width="2.4" height="8" ${INK}/>`,
  },
  // San Antonio / Whidbey Island: superstructure forward, long open well
  // deck and helo deck aft.
  dock: {
    vw: 24,
    h: 54,
    body: `
      <path d="M0,-58 C6,-48 9,-34 9.5,-20 L9.5,56 L-9.5,56 L-9.5,-20 C-9,-34 -6,-48 0,-58 Z" fill="white" ${EDGE}/>
      <rect x="-7" y="-30" width="14" height="22" rx="1.5" ${INK}/>
      <circle cx="0" cy="-20" r="2.4" fill="rgba(0,0,0,0.55)"/>
      <rect x="-6.5" y="-2" width="13" height="26" ${LINE} stroke-width="0.9"/>
      <circle cx="0" cy="40" r="5" ${LINE} stroke-width="0.9"/>
      <path d="M-2.4,40 L2.4,40 M0,37.6 L0,42.4" ${LINE} stroke-width="0.8"/>`,
  },
  // Ticonderoga: longer and beamier than a destroyer, two gun mounts,
  // missile blocks fore and aft, twin superstructure blocks.
  cruiser: {
    vw: 22,
    h: 54,
    body: `
      <path d="M0,-60 C6,-48 8,-30 8,-12 L8,52 L6,58 L-6,58 L-8,52 L-8,-12 C-8,-30 -6,-48 0,-60 Z" fill="white" ${EDGE}/>
      <circle cx="0" cy="-44" r="2.6" fill="rgba(0,0,0,0.55)"/>
      ${cells(-4.7, -36, 4, 3)}
      <rect x="-5.5" y="-24" width="11" height="12" rx="1" ${INK}/>
      <rect x="-5" y="-6" width="10" height="12" rx="1" ${INK}/>
      ${cells(-4.7, 12, 4, 3)}
      <circle cx="0" cy="26" r="2.6" fill="rgba(0,0,0,0.55)"/>
      <circle cx="0" cy="44" r="4.6" ${LINE} stroke-width="0.9"/>`,
  },
  // Arleigh Burke: slim, flared bow, one gun forward, forward missile block,
  // single superstructure with mast, aft block, flight deck.
  destroyer: {
    vw: 20,
    h: 50,
    body: `
      <path d="M0,-60 C5.5,-48 7,-30 7,-12 L7,52 L5,58 L-5,58 L-7,52 L-7,-12 C-7,-30 -5.5,-48 0,-60 Z" fill="white" ${EDGE}/>
      <circle cx="0" cy="-42" r="2.4" fill="rgba(0,0,0,0.55)"/>
      ${cells(-4.2, -32, 4, 3, 2, 0.6)}
      <rect x="-5" y="-20" width="10" height="20" rx="1.2" ${INK}/>
      <circle cx="0" cy="-12" r="1.8" fill="rgba(0,0,0,0.6)"/>
      ${cells(-3.2, 10, 3, 3, 2, 0.6)}
      <circle cx="0" cy="44" r="4.2" ${LINE} stroke-width="0.9"/>`,
  },
  // Lewis B. Puller ESB: a slab. Bridge right forward, long flight and
  // mission deck behind it.
  esb: {
    vw: 30,
    h: 60,
    body: `
      <path d="M-6,-60 L6,-60 L13,-48 L13,58 L-13,58 L-13,-48 Z" fill="white" ${EDGE}/>
      <rect x="-10" y="-50" width="20" height="12" rx="1.2" ${INK}/>
      <rect x="-9" y="-30" width="18" height="34" ${LINE} stroke-width="0.9"/>
      ${[16, 32, 46].map((y) => `<circle cx="0" cy="${y}" r="4.2" ${LINE} stroke-width="0.9"/>`).join('')}`,
  },
  // Independence LCS: trimaran, wide angular stern, big flight deck aft.
  lcs: {
    vw: 28,
    h: 42,
    body: `
      <path d="M0,-58 L7,-34 L12,4 L12,56 L-12,56 L-12,4 L-7,-34 Z" fill="white" ${EDGE}/>
      <rect x="-5" y="-22" width="10" height="16" rx="1.2" ${INK}/>
      <circle cx="0" cy="-30" r="1.8" fill="rgba(0,0,0,0.55)"/>
      <circle cx="0" cy="30" r="6.5" ${LINE} stroke-width="0.9"/>`,
  },
  other: {
    vw: 20,
    h: 40,
    body: `<path d="M0,-56 C6,-40 7,-20 7,0 L7,54 L-7,54 L-7,0 C-7,-20 -6,-40 0,-56 Z" fill="white" ${EDGE}/>`,
  },
};

/** Which glyph a ship gets, from its type and, for amphibs, its hull prefix. */
export function iconKey(ship) {
  const type = String(ship?.type || '').toLowerCase();
  const hull = String(ship?.hull || '').toUpperCase();
  if (type === 'amphib') return /^(LHD|LHA)/.test(hull) ? 'lhd' : 'dock';
  if (type in GLYPHS) return type;
  return 'other';
}

/** On-screen billboard size, in CSS pixels, before distance scaling. */
export function iconSize(key) {
  const g = GLYPHS[key] || GLYPHS.other;
  return { width: widthOf(g), height: g.h };
}

const _uri = new Map();

/** SVG data URI for a glyph, rendered at 4x its on-screen size. */
export function iconUri(key) {
  const k = GLYPHS[key] ? key : 'other';
  if (_uri.has(k)) return _uri.get(k);
  const g = GLYPHS[k];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(widthOf(g) * 4)}" ` +
    `height="${g.h * 4}" ${box(g.vw)} preserveAspectRatio="xMidYMid meet">${g.body}</svg>`;
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' '))}`;
  _uri.set(k, uri);
  return uri;
}

export const ICON_KEYS = Object.freeze(Object.keys(GLYPHS));
