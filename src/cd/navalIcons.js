/**
 * @module cd/navalIcons
 * @description Full-colour top-down US Navy ship renders for the CD naval
 * layer.
 *
 * Unlike the aircraft glyphs these are not white-for-tinting: they are
 * shaded overhead renders in Navy haze gray, with nonskid flight decks, white
 * and yellow deck markings, parked aircraft, missile cells, gun mounts, radar
 * faces and the ship's own hull number painted on its deck, the way it reads
 * from above. Selection is shown with a separate bracket sprite and staleness
 * with a darkening billboard.color, so the paintwork is never recoloured.
 *
 * Drawn in a 128-unit-long frame (bow at -64, origin at the centre). Each
 * class declares its own viewBox width (vw: beam plus margin for the shadow)
 * so every hull fills its billboard; on-screen width is h * vw / 128. SVG is
 * rasterised at 6x the on-screen size so it stays sharp when the camera
 * closes in and distance scaling enlarges it.
 */

const VH = 128;
const RASTER = 6;

// Navy haze gray and deck tones.
const HULL_LIGHT = '#a3abb3';
const HULL_MID = '#878f97';
const HULL_DARK = '#5e666e';
const DECK = '#3d4249';
const DECK_EDGE = '#262a2f';
const SUPER_LIGHT = '#b9c0c7';
const SUPER_DARK = '#737b83';
const MARK_W = '#f1f3f5';
const MARK_Y = '#f2c94c';
const CELL = '#2c3137';
const GLASS = '#1d2a36';

const DEFS = `
<defs>
  <filter id="sh" x="-40%" y="-8%" width="180%" height="116%">
    <feDropShadow dx="1.4" dy="2.2" stdDeviation="1.3" flood-color="#000" flood-opacity="0.6"/>
  </filter>
  <linearGradient id="hull" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="${HULL_DARK}"/><stop offset="0.28" stop-color="${HULL_MID}"/>
    <stop offset="0.55" stop-color="${HULL_LIGHT}"/><stop offset="1" stop-color="${HULL_DARK}"/>
  </linearGradient>
  <linearGradient id="sup" x1="0" x2="1" y1="0" y2="1">
    <stop offset="0" stop-color="${SUPER_LIGHT}"/><stop offset="1" stop-color="${SUPER_DARK}"/>
  </linearGradient>
  <linearGradient id="deck" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="#33383e"/><stop offset="0.5" stop-color="${DECK}"/><stop offset="1" stop-color="#30353a"/>
  </linearGradient>
  <pattern id="ns" width="3" height="3" patternUnits="userSpaceOnUse">
    <rect width="3" height="3" fill="url(#deck)"/><circle cx="1" cy="1" r="0.35" fill="#4a5058"/>
  </pattern>
</defs>`;

// Small aircraft silhouettes, drawn nose toward -Y around the origin.
const JET =
  'M0,-3.4 L0.7,-1.4 L0.75,-0.4 L2.6,0.9 L2.6,1.6 L0.7,1.1 L0.55,2.5 L1.5,3.2 ' +
  'L1.5,3.7 L0,3.3 L-1.5,3.7 L-1.5,3.2 L-0.55,2.5 L-0.7,1.1 L-2.6,1.6 L-2.6,0.9 ' +
  'L-0.75,-0.4 L-0.7,-1.4 Z';
const jet = (x, y, rot, s = 1) =>
  `<path d="${JET}" transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" ` +
  `fill="#c8ced4" stroke="#1c2024" stroke-width="0.25"/>`;
// Tiltrotor/helicopter: fuselage plus two (or one) rotor discs.
const rotor = (x, y, rot, twin = true) =>
  `<g transform="translate(${x} ${y}) rotate(${rot})">` +
  (twin
    ? '<circle cx="-2.8" cy="-0.6" r="2.3" fill="#c8ced4" fill-opacity="0.28"/>' +
      '<circle cx="2.8" cy="-0.6" r="2.3" fill="#c8ced4" fill-opacity="0.28"/>'
    : '<circle cx="0" cy="-0.8" r="3" fill="#c8ced4" fill-opacity="0.28"/>') +
  '<rect x="-0.8" y="-3" width="1.6" height="6" rx="0.7" fill="#c8ced4" stroke="#1c2024" stroke-width="0.25"/>' +
  '</g>';

/** Grid of missile cells with lids. */
function vls(x, y, cols, rows, s = 1.7, g = 0.45) {
  let out = `<rect x="${x - 0.5}" y="${y - 0.5}" width="${cols * (s + g) - g + 1}" height="${rows * (s + g) - g + 1}" fill="${CELL}" rx="0.3"/>`;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out += `<rect x="${(x + c * (s + g)).toFixed(2)}" y="${(y + r * (s + g)).toFixed(2)}" width="${s}" height="${s}" fill="#4b525a"/>`;
  return out;
}

/** Gun mount with barrel; dir -1 points forward, +1 aft. */
const gun = (x, y, r = 2.4, dir = -1) =>
  `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + dir * (r + 4.5)}" stroke="#4b525a" stroke-width="0.9" stroke-linecap="round"/>` +
  `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#sup)" stroke="#40474e" stroke-width="0.4"/>`;

/** Helicopter landing spot: white circle, yellow lineup line. */
const spot = (x, y, r = 4.6) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${MARK_W}" stroke-width="0.6"/>` +
  `<line x1="${x}" y1="${y - r - 2}" x2="${x}" y2="${y + r + 2}" stroke="${MARK_Y}" stroke-width="0.45"/>`;

/** Hull number painted on deck, readable from above. */
const number = (n, x, y, size, rot = 0) =>
  n
    ? `<text x="${x}" y="${y}" transform="rotate(${rot} ${x} ${y})" text-anchor="middle" ` +
      `dominant-baseline="central" font-family="Arial Black, Arial, Helvetica, sans-serif" ` +
      `font-weight="900" font-size="${size}" fill="${MARK_W}" fill-opacity="0.9">${n}</text>`
    : '';

const GLYPHS = {
  // Nimitz class: nonskid flight deck with the angled landing area to port,
  // four elevators, bow and waist catapults, island to starboard, an air wing
  // parked along the bow and fantail, hull number on the bow.
  carrier: {
    vw: 44,
    h: 78,
    draw: (n) => `
      <g filter="url(#sh)">
        <path d="M-5,-61 L5,-61 L10.5,-51 L12,54 L9.5,61 L-9,61 L-11.4,51 L-17.5,43
                 L-19.6,6 L-14.6,-8 L-10.4,-18 L-10.4,-51 Z" fill="url(#ns)" stroke="${DECK_EDGE}" stroke-width="0.8"/>
        <rect x="11.6" y="-4" width="3.4" height="8" fill="${DECK}" stroke="${DECK_EDGE}" stroke-width="0.5"/>
        <rect x="11.8" y="24" width="3.4" height="7.5" fill="${DECK}" stroke="${DECK_EDGE}" stroke-width="0.5"/>
        <rect x="11.8" y="34" width="3.4" height="7.5" fill="${DECK}" stroke="${DECK_EDGE}" stroke-width="0.5"/>
        <rect x="-21.4" y="19" width="3.4" height="8.5" fill="${DECK}" stroke="${DECK_EDGE}" stroke-width="0.5"/>
      </g>
      <path d="M-4.6,58 L-18.6,30 M8.8,56 L-6.2,-12" stroke="${MARK_W}" stroke-width="0.55" fill="none"/>
      <path d="M2.2,57 L-12.6,-8" stroke="${MARK_W}" stroke-width="0.7" stroke-dasharray="2.6 2" fill="none"/>
      <path d="M-3.4,-57 L-3.4,-24 M3.6,-57 L3.6,-30" stroke="#8a9198" stroke-width="0.6"/>
      <path d="M-8.6,-12 L-15.6,10 M-6.4,-14 L-12.8,8" stroke="#8a9198" stroke-width="0.6"/>
      <path d="M-3.4,-24 L-3.4,-21 M3.6,-30 L3.6,-27" stroke="${MARK_Y}" stroke-width="0.8"/>
      <path d="M-9.4,56 L9.4,56" stroke="${MARK_W}" stroke-width="0.5" stroke-dasharray="1.4 1.2"/>
      <g filter="url(#sh)">
        <path d="M6.6,4 L11.2,4 L11.2,21 L6.6,21 Z" fill="url(#sup)" stroke="#4d545b" stroke-width="0.4"/>
        <rect x="7.4" y="7.5" width="3" height="3.2" fill="${GLASS}"/>
        <rect x="7.6" y="13" width="2.6" height="1.4" fill="#5b636b"/>
        <circle cx="8.9" cy="17.4" r="1.1" fill="#d5dade" stroke="#4d545b" stroke-width="0.3"/>
      </g>
      ${jet(8, -44, -135)}${jet(8, -37, -135)}${jet(8, -30, -135)}${jet(-7.5, -46, 140)}
      ${jet(-7.5, -39, 140)}${jet(8.4, 31, -60)}${jet(8.4, 38, -60)}${jet(8.4, 45, -60)}
      ${jet(-7, 47, 45)}${jet(-2.5, 51, 20)}${jet(-15.2, 18, 160, 0.95)}
      ${rotor(9, 50, 30, false)}
      ${number(n, 0, -45, 10)}`,
  },
  // Wasp / America: straight nonskid deck, spots down the port side,
  // island amidships to starboard, tiltrotors and jump jets parked aft.
  lhd: {
    vw: 34,
    h: 68,
    draw: (n) => `
      <g filter="url(#sh)">
        <path d="M-7,-59 L7,-59 L12.4,-46 L12.8,59 L-12.8,59 L-12.8,-46 Z" fill="url(#ns)" stroke="${DECK_EDGE}" stroke-width="0.8"/>
        <rect x="12.6" y="18" width="3" height="9" fill="${DECK}" stroke="${DECK_EDGE}" stroke-width="0.5"/>
      </g>
      <path d="M-5.6,-50 L-5.6,56" stroke="${MARK_W}" stroke-width="0.6" stroke-dasharray="2.4 2"/>
      <path d="M-12,-46 L-12,57 M10.6,-44 L10.6,-12 M10.6,26 L10.6,57" stroke="${MARK_W}" stroke-width="0.35"/>
      ${[-40, -24, -8, 8, 24, 40].map((y, i) => `<circle cx="-5.6" cy="${y}" r="3" fill="none" stroke="${MARK_W}" stroke-width="0.5"/><text x="-9.6" y="${y}" font-family="Arial, sans-serif" font-size="3" fill="${MARK_W}" dominant-baseline="central" text-anchor="middle">${i + 1}</text>`).join('')}
      <g filter="url(#sh)">
        <path d="M6.4,-10 L11.6,-10 L11.6,14 L6.4,14 Z" fill="url(#sup)" stroke="#4d545b" stroke-width="0.4"/>
        <rect x="7.2" y="-6.5" width="3.6" height="3.4" fill="${GLASS}"/>
        <circle cx="9" cy="3" r="1.2" fill="#d5dade" stroke="#4d545b" stroke-width="0.3"/>
        <rect x="7.4" y="7" width="3.2" height="3.4" fill="#5b636b"/>
      </g>
      ${rotor(5, 32, -30)}${rotor(5, 41, -30)}${rotor(5, 50, -30)}
      ${jet(5.5, 21, -40, 0.95)}${jet(-1, -48, 0, 0.9)}
      ${number(n, 1, -32, 10)}${number(n, 0.5, 51, 6)}`,
  },
  // San Antonio / Whidbey Island: forecastle, big superstructure forward,
  // well-deck roof and flight deck aft.
  dock: {
    vw: 26,
    h: 58,
    draw: (n) => `
      <g filter="url(#sh)">
        <path d="M0,-60 C6.2,-50 9.6,-36 10,-22 L10,58 L-10,58 L-10,-22 C-9.6,-36 -6.2,-50 0,-60 Z" fill="url(#hull)" stroke="${DECK_EDGE}" stroke-width="0.7"/>
        <rect x="-8.6" y="4" width="17.2" height="52" fill="url(#ns)"/>
      </g>
      <circle cx="0" cy="-48" r="1.2" fill="${CELL}"/>
      <path d="M-3,-44 L3,-44" stroke="${CELL}" stroke-width="0.6"/>
      <g filter="url(#sh)">
        <path d="M-7.6,-34 L7.6,-34 L8.2,2 L-8.2,2 Z" fill="url(#sup)" stroke="#4d545b" stroke-width="0.4"/>
        <rect x="-5.6" y="-31.5" width="11.2" height="3.2" fill="${GLASS}"/>
        <rect x="-3" y="-22" width="6" height="9" rx="1" fill="#99a1a8" stroke="#5b636b" stroke-width="0.3"/>
        <circle cx="0" cy="-8" r="1.6" fill="#d5dade" stroke="#4d545b" stroke-width="0.3"/>
      </g>
      ${spot(0, 22, 4.8)}${spot(0, 42, 4.8)}
      <path d="M-8.6,55 L8.6,55" stroke="${MARK_W}" stroke-width="0.4" stroke-dasharray="1.2 1"/>
      ${number(n, 0, 32, 6.5)}`,
  },
  // Ticonderoga: two 5-inch mounts, Mk 41 cells fore and aft, the forward and
  // aft deckhouses with their radar faces, twin stacks, flight deck aft.
  cruiser: {
    vw: 24,
    h: 58,
    draw: (n) => `
      <g filter="url(#sh)">
        <path d="M0,-61 C6.2,-49 8.4,-31 8.4,-12 L8.4,53 L6.4,59 L-6.4,59 L-8.4,53 L-8.4,-12 C-8.4,-31 -6.2,-49 0,-61 Z" fill="url(#hull)" stroke="${DECK_EDGE}" stroke-width="0.7"/>
      </g>
      ${gun(0, -44, 2.6)}${vls(-4.2, -37, 4, 4)}
      <g filter="url(#sh)">
        <path d="M-6.4,-26 L6.4,-26 L6.6,-8 L-6.6,-8 Z" fill="url(#sup)" stroke="#4d545b" stroke-width="0.4"/>
        <rect x="-4.6" y="-24.2" width="9.2" height="2.6" fill="${GLASS}"/>
        <path d="M-6.4,-20 L-7.6,-17 L-7.6,-12 L-6.4,-10 M6.4,-20 L7.6,-17 L7.6,-12 L6.4,-10" stroke="#3e454c" stroke-width="0.8" fill="none"/>
        <rect x="-2.4" y="-6" width="4.8" height="4.2" fill="#3a4047"/>
        <path d="M-6,0 L6,0 L6.2,14 L-6.2,14 Z" fill="url(#sup)" stroke="#4d545b" stroke-width="0.4"/>
        <rect x="-2.4" y="15" width="4.8" height="4" fill="#3a4047"/>
        <circle cx="0" cy="-15" r="1.4" fill="#d5dade" stroke="#4d545b" stroke-width="0.3"/>
      </g>
      ${vls(-4.2, 21.5, 4, 4)}${gun(0, 34, 2.4, -1)}
      <rect x="-7.4" y="40" width="14.8" height="16" fill="url(#ns)"/>
      ${spot(0, 46, 3.6)}${number(n, 0, 53.6, 3.8)}`,
  },
  // Arleigh Burke: flared bow, 5-inch gun, forward Mk 41 block, the
  // deckhouse with its four SPY faces and mast, twin stacks, aft block and
  // hangars, flight deck with the hull number.
  destroyer: {
    vw: 22,
    h: 54,
    draw: (n) => `
      <g filter="url(#sh)">
        <path d="M0,-61 C6,-49 7.8,-31 7.8,-12 L7.8,53 L5.8,59 L-5.8,59 L-7.8,53 L-7.8,-12 C-7.8,-31 -6,-49 0,-61 Z" fill="url(#hull)" stroke="${DECK_EDGE}" stroke-width="0.7"/>
      </g>
      ${gun(0, -43, 2.4)}${vls(-4.4, -35, 4, 4, 1.75, 0.45)}
      <g filter="url(#sh)">
        <path d="M-6,-22 L6,-22 L6.4,4 L-6.4,4 Z" fill="url(#sup)" stroke="#4d545b" stroke-width="0.4"/>
        <rect x="-4.4" y="-20.4" width="8.8" height="2.6" fill="${GLASS}"/>
        <path d="M-6,-15 L-7.4,-12.5 L-7.4,-7.5 L-6,-5 M6,-15 L7.4,-12.5 L7.4,-7.5 L6,-5" stroke="#3e454c" stroke-width="0.9" fill="none"/>
        <circle cx="0" cy="-10" r="1.5" fill="#d5dade" stroke="#4d545b" stroke-width="0.3"/>
        <rect x="-2.6" y="-1.5" width="5.2" height="3.6" fill="#3a4047"/>
        <rect x="-2.6" y="8" width="5.2" height="3.6" fill="#3a4047"/>
      </g>
      ${vls(-4.4, 15, 4, 4, 1.75, 0.45)}
      <rect x="-6" y="25" width="12" height="9" fill="url(#sup)" stroke="#4d545b" stroke-width="0.35"/>
      <rect x="-7" y="35" width="14" height="21" fill="url(#ns)"/>
      ${spot(0, 43, 3.8)}${number(n, 0, 52.6, 4)}`,
  },
  // Lewis B. Puller ESB: tanker-derived slab, bridge right forward, open
  // mission deck and a long flight deck with four spots.
  esb: {
    vw: 34,
    h: 66,
    draw: (n) => `
      <g filter="url(#sh)">
        <path d="M-5.4,-61 L5.4,-61 L13,-48 L13.4,59 L-13.4,59 L-13,-48 Z" fill="url(#hull)" stroke="${DECK_EDGE}" stroke-width="0.7"/>
        <rect x="-11.4" y="-30" width="22.8" height="86" fill="url(#ns)"/>
      </g>
      <g filter="url(#sh)">
        <path d="M-10.6,-52 L10.6,-52 L11,-36 L-11,-36 Z" fill="url(#sup)" stroke="#4d545b" stroke-width="0.4"/>
        <rect x="-8.6" y="-50" width="17.2" height="3" fill="${GLASS}"/>
        <circle cx="0" cy="-42" r="1.6" fill="#d5dade" stroke="#4d545b" stroke-width="0.3"/>
      </g>
      <rect x="-9.4" y="-26" width="18.8" height="22" fill="none" stroke="${MARK_Y}" stroke-width="0.45" stroke-dasharray="1.6 1.2"/>
      ${spot(0, 6, 4.4)}${spot(0, 22, 4.4)}${spot(0, 38, 4.4)}${spot(0, 52, 4.4)}
      ${rotor(-6, 22, 0, false)}${number(n, 6.5, -14, 8)}`,
  },
  // Independence LCS: aluminium trimaran, angular wave-piercing bow, small
  // deckhouse, the very large flight deck that spans all three hulls.
  lcs: {
    vw: 30,
    h: 46,
    draw: (n) => `
      <g filter="url(#sh)">
        <path d="M0,-60 L6,-38 L12,-2 L12.4,58 L-12.4,58 L-12,-2 L-6,-38 Z" fill="url(#hull)" stroke="${DECK_EDGE}" stroke-width="0.7"/>
        <rect x="-11.4" y="12" width="22.8" height="44" fill="url(#ns)"/>
      </g>
      ${gun(0, -36, 1.8)}
      <g filter="url(#sh)">
        <path d="M-6,-26 L6,-26 L8.4,8 L-8.4,8 Z" fill="url(#sup)" stroke="#4d545b" stroke-width="0.4"/>
        <rect x="-4.4" y="-24" width="8.8" height="3" fill="${GLASS}"/>
        <circle cx="0" cy="-10" r="1.6" fill="#d5dade" stroke="#4d545b" stroke-width="0.3"/>
      </g>
      ${spot(0, 32, 7)}${number(n, 0, 49, 6)}`,
  },
  other: {
    vw: 22,
    h: 44,
    draw: () => `
      <g filter="url(#sh)">
        <path d="M0,-58 C6,-42 7.6,-22 7.6,0 L7.6,56 L-7.6,56 L-7.6,0 C-7.6,-22 -6,-42 0,-58 Z" fill="url(#hull)" stroke="${DECK_EDGE}" stroke-width="0.7"/>
        <rect x="-5" y="-16" width="10" height="20" fill="url(#sup)" stroke="#4d545b" stroke-width="0.4"/>
      </g>`,
  },
};

/** Which render a ship gets, from its type and, for amphibs, its hull prefix. */
export function iconKey(ship) {
  const type = String(ship?.type || '').toLowerCase();
  const hull = String(ship?.hull || '').toUpperCase();
  if (type === 'amphib') return /^(LHD|LHA)/.test(hull) ? 'lhd' : 'dock';
  if (Object.prototype.hasOwnProperty.call(GLYPHS, type)) return type;
  return 'other';
}

/** The number painted on deck: "CVN-73" -> "73". Empty when there is none. */
export function hullNumber(ship) {
  const m = String(ship?.hull || '').match(/(\d{1,3})\s*$/);
  return m ? String(Number(m[1])) : '';
}

const widthOf = (g) => Math.round(((g.h * g.vw) / VH) * 10) / 10;

/** On-screen billboard size, in CSS pixels, before distance scaling. */
export function iconSize(key) {
  const g = GLYPHS[key] || GLYPHS.other;
  return { width: widthOf(g), height: g.h };
}

const _uri = new Map();

/**
 * SVG data URI for a ship render. Pass the hull number to paint it on deck;
 * omit it for a generic render (legend, list).
 */
export function iconUri(key, num = '') {
  const k = GLYPHS[key] ? key : 'other';
  const n = String(num || '')
    .replace(/[^0-9]/g, '')
    .slice(0, 3);
  const memo = `${k}|${n}`;
  if (_uri.has(memo)) return _uri.get(memo);
  const g = GLYPHS[k];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(widthOf(g) * RASTER)}" ` +
    `height="${g.h * RASTER}" viewBox="${-g.vw / 2} ${-VH / 2} ${g.vw} ${VH}" ` +
    `preserveAspectRatio="xMidYMid meet">${DEFS}${g.draw(n)}</svg>`;
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' '))}`;
  _uri.set(memo, uri);
  return uri;
}

/** Billboard sizing for a ship's selection brackets: its icon plus a margin. */
export function selectionSize(key) {
  const { width, height } = iconSize(key);
  return { width: width + 14, height: height + 14 };
}

/**
 * HUD-style targeting brackets in the accent colour, as a data URI. Drawn
 * for a given box so the corners keep their size on long and short hulls.
 */
export function selectionUri(width, height) {
  const w = Math.round(width * 4);
  const h = Math.round(height * 4);
  const L = Math.round(Math.min(w, h) * 0.34);
  const s = 7;
  const c = '#00d4ff';
  const p = (d) =>
    `<path d="${d}" fill="none" stroke="${c}" stroke-width="${s}" stroke-linecap="square"/>`;
  const i = s / 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect x="${s * 2}" y="${s * 2}" width="${w - s * 4}" height="${h - s * 4}" rx="${s}" fill="${c}" fill-opacity="0.06"/>` +
    p(`M${i},${L} L${i},${i} L${L},${i}`) +
    p(`M${w - L},${i} L${w - i},${i} L${w - i},${L}`) +
    p(`M${w - i},${h - L} L${w - i},${h - i} L${w - L},${h - i}`) +
    p(`M${L},${h - i} L${i},${h - i} L${i},${h - L}`) +
    '</svg>';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const ICON_KEYS = Object.freeze(Object.keys(GLYPHS));
