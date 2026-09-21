// Audit src/data/icaoCountry.js against live traffic.
//
// Two independent sources for the same fact: the ICAO 24-bit address block an
// aircraft transmits from, and the nationality prefix of its registration
// (ITU call-sign series: N = US, G- = UK, D- = Germany ...). Both name the
// state of registry, so wherever they disagree one of them is wrong -- and
// since registrations are painted on the aircraft, it is usually the table.
//
//   node scripts/audit-icao-country.mjs <hex_reg.json>
//
// Input is {hex: registration}. Military serials ("05-5146") carry no
// nationality prefix and are skipped rather than counted.
import { readFileSync } from 'node:fs';
import { countryForHex } from '../src/data/icaoCountry.js';

// Longest prefix wins. Territories that register under the United Kingdom's
// ICAO allocation (Bermuda, Cayman, Isle of Man, Guernsey ...) map to GB,
// because the state holding the block is what the table answers.
const PREFIX = {
  N: 'US',
  'C-': 'CA',
  'CF-': 'CA',
  'G-': 'GB',
  'M-': 'GB',
  '2-': 'GB',
  'VP-B': 'GB',
  'VQ-B': 'GB',
  'VP-C': 'GB',
  'VP-A': 'GB',
  'VP-M': 'GB',
  'VQ-T': 'GB',
  'VP-F': 'GB',
  'D-': 'DE',
  'F-': 'FR',
  'I-': 'IT',
  'EC-': 'ES',
  'PH-': 'NL',
  'OO-': 'BE',
  'OE-': 'AT',
  'HB-': 'CH',
  'SE-': 'SE',
  'LN-': 'NO',
  'OY-': 'DK',
  'OH-': 'FI',
  'EI-': 'IE',
  'EJ-': 'IE',
  'SX-': 'GR',
  'TC-': 'TR',
  'SP-': 'PL',
  'OK-': 'CZ',
  'HA-': 'HU',
  'YR-': 'RO',
  'LZ-': 'BG',
  '9A-': 'HR',
  'S5-': 'SI',
  'OM-': 'SK',
  'YL-': 'LV',
  'LY-': 'LT',
  'ES-': 'EE',
  'UR-': 'UA',
  'EW-': 'BY',
  'RA-': 'RU',
  'RF-': 'RU',
  '4X-': 'IL',
  'A6-': 'AE',
  'A7-': 'QA',
  'A9C-': 'BH',
  'HZ-': 'SA',
  '9K-': 'KW',
  'A4O-': 'OM',
  JA: 'JP',
  HL: 'KR',
  'VH-': 'AU',
  'ZK-': 'NZ',
  'VT-': 'IN',
  '9V-': 'SG',
  '9M-': 'MY',
  'HS-': 'TH',
  'PK-': 'ID',
  'RP-': 'PH',
  'VN-': 'VN',
  'AP-': 'PK',
  'PR-': 'BR',
  'PP-': 'BR',
  'PT-': 'BR',
  'PS-': 'BR',
  'PU-': 'BR',
  'LV-': 'AR',
  'LQ-': 'AR',
  'CC-': 'CL',
  'HK-': 'CO',
  'OB-': 'PE',
  'XA-': 'MX',
  'XB-': 'MX',
  'XC-': 'MX',
  'ZS-': 'ZA',
  'ZT-': 'ZA',
  'ZU-': 'ZA',
  'SU-': 'EG',
  'CN-': 'MA',
  '5Y-': 'KE',
  'ET-': 'ET',
  '5N-': 'NG',
  '7T-': 'DZ',
  'TS-': 'TN',
  'EP-': 'IR',
  'YI-': 'IQ',
  'JY-': 'JO',
  'OD-': 'LB',
  'EK-': 'AM',
  '4K-': 'AZ',
  '4L-': 'GE',
  'UP-': 'KZ',
  'EX-': 'KG',
  'UK-': 'UZ',
  '9H-': 'MT',
  '5B-': 'CY',
  'LX-': 'LU',
  'CS-': 'PT',
  'TF-': 'IS',
  'YU-': 'RS',
  'Z3-': 'MK',
  'T9-': 'BA',
  'E7-': 'BA',
  '4O-': 'ME',
  'ER-': 'MD',
  'ZA-': 'AL',
  'D2-': 'AO',
  '9G-': 'GH',
  '3B-': 'MU',
  'S2-': 'BD',
  '4R-': 'LK',
  '9N-': 'NP',
  'XY-': 'MM',
  'XZ-': 'MM',
  'XU-': 'KH',
  'HI-': 'DO',
  'YV-': 'VE',
  'HP-': 'PA',
  'TG-': 'GT',
  'HR-': 'HN',
  'YS-': 'SV',
  'TI-': 'CR',
  'CU-': 'CU',
  '6Y-': 'JM',
  '8P-': 'BB',
  'C6-': 'BS',
  'V3-': 'BZ',
  '8R-': 'GY',
  'PZ-': 'SR',
  '9Y-': 'TT',
  'HC-': 'EC',
  'ZP-': 'PY',
  'CX-': 'UY',
  'CP-': 'BO',
};
const KEYS = Object.keys(PREFIX).sort((a, b) => b.length - a.length);

function isoFromRegistration(reg) {
  // "B-": mainland China and Hong Kong fly in China's block; Taiwan's
  // five-digit B- registrations fly in Taiwan's own.
  if (/^B-\d{5}$/.test(reg)) return 'TW';
  if (reg.startsWith('B-')) return 'CN';
  // US N-numbers are N followed by a digit, never a hyphen.
  if (/^N\d/.test(reg)) return 'US';
  for (const key of KEYS) {
    if (key === 'N') continue;
    if (reg.startsWith(key)) return PREFIX[key];
  }
  // Japanese and Korean marks carry no hyphen: JA1234, HL7700.
  if (/^JA[0-9A-Z]{4}$/.test(reg)) return 'JP';
  if (/^HL\d{4}$/.test(reg)) return 'KR';
  return null;
}

const pairs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let checked = 0;
let agree = 0;
let skipped = 0;
let unmapped = 0;
const wrong = [];
const byIso = new Map();
for (const [hex, raw] of Object.entries(pairs)) {
  const reg = String(raw).toUpperCase();
  const expected = isoFromRegistration(reg);
  if (!expected) {
    skipped += 1;
    continue;
  }
  checked += 1;
  const got = countryForHex(hex);
  byIso.set(expected, (byIso.get(expected) || 0) + 1);
  if (!got) {
    unmapped += 1;
    wrong.push([hex, reg, expected, '(no block)']);
  } else if (got.iso === expected) {
    agree += 1;
  } else {
    wrong.push([hex, reg, expected, got.iso]);
  }
}
console.log(
  `pairs ${Object.keys(pairs).length}, checked ${checked}, ` +
    `skipped ${skipped} (no nationality prefix, e.g. military serials)`,
);
console.log(
  `agree ${agree}/${checked} = ${((100 * agree) / checked).toFixed(2)}%   ` +
    `unmapped ${unmapped}`,
);
console.log(`countries exercised: ${byIso.size}`);
console.log(
  [...byIso]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${v}`)
    .join(' '),
);
if (wrong.length) {
  console.log('\ndisagreements  hex     registration  reg-says  table-says');
  for (const [hex, reg, exp, got] of wrong.slice(0, 60))
    console.log(
      `               ${hex}  ${reg.padEnd(12)}  ${exp.padEnd(8)}  ${got}`,
    );
}
