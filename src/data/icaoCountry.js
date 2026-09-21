/**
 * @module data/icaoCountry
 * @description Country of registration from an ICAO 24-bit aircraft address.
 *
 * CD addition, not upstream. States are allocated contiguous blocks of the
 * 24-bit address space by ICAO (Annex 10, Volume III, Part I, Chapter 9), so
 * the block an address falls in names the state of registry. This table is
 * written from that allocation, not copied from any other project's file.
 *
 * It answers "state of registry", which is not always "who operates it": a
 * leased airliner carries its lessor's registration. The pane shows it beside
 * the operator for exactly that reason.
 *
 * Blocks are [start, end, ISO 3166-1 alpha-2, name], sorted by start and
 * non-overlapping, so lookup is a binary search.
 */

const BLOCKS = [
  [0x004000, 0x0043ff, 'ZW', 'Zimbabwe'],
  [0x006000, 0x006fff, 'MZ', 'Mozambique'],
  [0x008000, 0x00ffff, 'ZA', 'South Africa'],
  [0x010000, 0x017fff, 'EG', 'Egypt'],
  [0x018000, 0x01ffff, 'LY', 'Libya'],
  [0x020000, 0x027fff, 'MA', 'Morocco'],
  [0x028000, 0x02ffff, 'TN', 'Tunisia'],
  [0x030000, 0x0303ff, 'BW', 'Botswana'],
  [0x032000, 0x032fff, 'BI', 'Burundi'],
  [0x034000, 0x034fff, 'CM', 'Cameroon'],
  [0x035000, 0x0353ff, 'KM', 'Comoros'],
  [0x036000, 0x036fff, 'CG', 'Congo'],
  [0x038000, 0x038fff, 'CI', "Côte d'Ivoire"],
  [0x03e000, 0x03efff, 'GA', 'Gabon'],
  [0x040000, 0x040fff, 'ET', 'Ethiopia'],
  [0x042000, 0x042fff, 'GQ', 'Equatorial Guinea'],
  [0x044000, 0x044fff, 'GH', 'Ghana'],
  [0x046000, 0x046fff, 'GN', 'Guinea'],
  [0x048000, 0x0483ff, 'GW', 'Guinea-Bissau'],
  [0x04a000, 0x04a3ff, 'LS', 'Lesotho'],
  [0x04c000, 0x04cfff, 'KE', 'Kenya'],
  [0x050000, 0x050fff, 'LR', 'Liberia'],
  [0x054000, 0x054fff, 'MG', 'Madagascar'],
  [0x058000, 0x058fff, 'MW', 'Malawi'],
  [0x05a000, 0x05a3ff, 'MV', 'Maldives'],
  [0x05c000, 0x05cfff, 'ML', 'Mali'],
  [0x05e000, 0x05e3ff, 'MR', 'Mauritania'],
  [0x060000, 0x0603ff, 'MU', 'Mauritius'],
  [0x062000, 0x062fff, 'NE', 'Niger'],
  [0x064000, 0x064fff, 'NG', 'Nigeria'],
  [0x068000, 0x068fff, 'UG', 'Uganda'],
  [0x06a000, 0x06a3ff, 'QA', 'Qatar'],
  [0x06c000, 0x06cfff, 'CF', 'Central African Republic'],
  [0x06e000, 0x06efff, 'RW', 'Rwanda'],
  [0x070000, 0x070fff, 'SN', 'Senegal'],
  [0x074000, 0x0743ff, 'SC', 'Seychelles'],
  [0x076000, 0x0763ff, 'SL', 'Sierra Leone'],
  [0x078000, 0x078fff, 'SO', 'Somalia'],
  [0x07a000, 0x07a3ff, 'SZ', 'Eswatini'],
  [0x07c000, 0x07cfff, 'SD', 'Sudan'],
  [0x080000, 0x080fff, 'TZ', 'Tanzania'],
  [0x084000, 0x084fff, 'TD', 'Chad'],
  [0x088000, 0x088fff, 'TG', 'Togo'],
  [0x08a000, 0x08afff, 'ZM', 'Zambia'],
  [0x08c000, 0x08cfff, 'CD', 'DR Congo'],
  [0x090000, 0x090fff, 'AO', 'Angola'],
  [0x094000, 0x0943ff, 'BJ', 'Benin'],
  [0x096000, 0x0963ff, 'CV', 'Cabo Verde'],
  [0x098000, 0x0983ff, 'DJ', 'Djibouti'],
  [0x09a000, 0x09afff, 'GM', 'Gambia'],
  [0x09c000, 0x09cfff, 'BF', 'Burkina Faso'],
  [0x09e000, 0x09e3ff, 'ST', 'São Tomé and Príncipe'],
  [0x0a0000, 0x0a7fff, 'DZ', 'Algeria'],
  [0x0a8000, 0x0a8fff, 'BS', 'Bahamas'],
  [0x0aa000, 0x0aa3ff, 'BB', 'Barbados'],
  [0x0ab000, 0x0ab3ff, 'BZ', 'Belize'],
  [0x0ac000, 0x0acfff, 'CO', 'Colombia'],
  [0x0ae000, 0x0aefff, 'CR', 'Costa Rica'],
  [0x0b0000, 0x0b0fff, 'CU', 'Cuba'],
  [0x0b2000, 0x0b2fff, 'SV', 'El Salvador'],
  [0x0b4000, 0x0b4fff, 'GT', 'Guatemala'],
  [0x0b6000, 0x0b6fff, 'GY', 'Guyana'],
  [0x0b8000, 0x0b8fff, 'HT', 'Haiti'],
  [0x0ba000, 0x0bafff, 'HN', 'Honduras'],
  [0x0bc000, 0x0bc3ff, 'VC', 'Saint Vincent and the Grenadines'],
  [0x0be000, 0x0befff, 'JM', 'Jamaica'],
  [0x0c0000, 0x0c0fff, 'NI', 'Nicaragua'],
  [0x0c2000, 0x0c2fff, 'PA', 'Panama'],
  [0x0c4000, 0x0c4fff, 'DO', 'Dominican Republic'],
  [0x0c6000, 0x0c6fff, 'TT', 'Trinidad and Tobago'],
  [0x0c8000, 0x0c8fff, 'SR', 'Suriname'],
  [0x0ca000, 0x0ca3ff, 'AG', 'Antigua and Barbuda'],
  [0x0cc000, 0x0cc3ff, 'GD', 'Grenada'],
  [0x0d0000, 0x0d7fff, 'MX', 'Mexico'],
  [0x0d8000, 0x0dffff, 'VE', 'Venezuela'],
  [0x100000, 0x1fffff, 'RU', 'Russia'],
  [0x201000, 0x2013ff, 'NA', 'Namibia'],
  [0x202000, 0x2023ff, 'ER', 'Eritrea'],
  [0x300000, 0x33ffff, 'IT', 'Italy'],
  [0x340000, 0x37ffff, 'ES', 'Spain'],
  [0x380000, 0x3bffff, 'FR', 'France'],
  [0x3c0000, 0x3fffff, 'DE', 'Germany'],
  [0x400000, 0x43ffff, 'GB', 'United Kingdom'],
  [0x440000, 0x447fff, 'AT', 'Austria'],
  [0x448000, 0x44ffff, 'BE', 'Belgium'],
  [0x450000, 0x457fff, 'BG', 'Bulgaria'],
  [0x458000, 0x45ffff, 'DK', 'Denmark'],
  [0x460000, 0x467fff, 'FI', 'Finland'],
  [0x468000, 0x46ffff, 'GR', 'Greece'],
  [0x470000, 0x477fff, 'HU', 'Hungary'],
  [0x478000, 0x47ffff, 'NO', 'Norway'],
  [0x480000, 0x487fff, 'NL', 'Netherlands'],
  [0x488000, 0x48ffff, 'PL', 'Poland'],
  [0x490000, 0x497fff, 'PT', 'Portugal'],
  [0x498000, 0x49ffff, 'CZ', 'Czechia'],
  [0x4a0000, 0x4a7fff, 'RO', 'Romania'],
  [0x4a8000, 0x4affff, 'SE', 'Sweden'],
  [0x4b0000, 0x4b7fff, 'CH', 'Switzerland'],
  [0x4b8000, 0x4bffff, 'TR', 'Türkiye'],
  [0x4c0000, 0x4c7fff, 'RS', 'Serbia'],
  [0x4c8000, 0x4c83ff, 'CY', 'Cyprus'],
  [0x4ca000, 0x4cafff, 'IE', 'Ireland'],
  [0x4cc000, 0x4ccfff, 'IS', 'Iceland'],
  [0x4d0000, 0x4d03ff, 'LU', 'Luxembourg'],
  // Malta: the original 1K allocation ends at 4D23FF, but live Maltese
  // aircraft (a large leasing registry) transmit up to at least 4D2528. Set to
  // the smallest aligned block that covers every address observed, and no
  // further: an unassigned address shows no country, which beats a wrong one.
  [0x4d2000, 0x4d2fff, 'MT', 'Malta'],
  [0x4d4000, 0x4d43ff, 'MC', 'Monaco'],
  [0x500000, 0x5003ff, 'SM', 'San Marino'],
  [0x501000, 0x5013ff, 'AL', 'Albania'],
  [0x501c00, 0x501fff, 'HR', 'Croatia'],
  [0x502c00, 0x502fff, 'LV', 'Latvia'],
  [0x503c00, 0x503fff, 'LT', 'Lithuania'],
  [0x504c00, 0x504fff, 'MD', 'Moldova'],
  [0x505c00, 0x505fff, 'SK', 'Slovakia'],
  [0x506c00, 0x506fff, 'SI', 'Slovenia'],
  [0x507c00, 0x507fff, 'UZ', 'Uzbekistan'],
  [0x508000, 0x50ffff, 'UA', 'Ukraine'],
  [0x510000, 0x5103ff, 'BY', 'Belarus'],
  [0x511000, 0x5113ff, 'EE', 'Estonia'],
  [0x512000, 0x5123ff, 'MK', 'North Macedonia'],
  [0x513000, 0x5133ff, 'BA', 'Bosnia and Herzegovina'],
  [0x514000, 0x5143ff, 'GE', 'Georgia'],
  [0x515000, 0x5153ff, 'TJ', 'Tajikistan'],
  [0x516000, 0x5163ff, 'ME', 'Montenegro'],
  [0x600000, 0x6003ff, 'AM', 'Armenia'],
  [0x600800, 0x600bff, 'AZ', 'Azerbaijan'],
  [0x601000, 0x6013ff, 'KG', 'Kyrgyzstan'],
  [0x601800, 0x601bff, 'TM', 'Turkmenistan'],
  [0x680000, 0x6803ff, 'BT', 'Bhutan'],
  [0x681000, 0x6813ff, 'FM', 'Micronesia'],
  [0x682000, 0x6823ff, 'MN', 'Mongolia'],
  [0x683000, 0x6833ff, 'KZ', 'Kazakhstan'],
  [0x684000, 0x6843ff, 'PW', 'Palau'],
  [0x700000, 0x700fff, 'AF', 'Afghanistan'],
  [0x702000, 0x702fff, 'BD', 'Bangladesh'],
  [0x704000, 0x704fff, 'MM', 'Myanmar'],
  [0x706000, 0x706fff, 'KW', 'Kuwait'],
  [0x708000, 0x708fff, 'LA', 'Laos'],
  [0x70a000, 0x70afff, 'NP', 'Nepal'],
  [0x70c000, 0x70c3ff, 'OM', 'Oman'],
  [0x70e000, 0x70efff, 'KH', 'Cambodia'],
  [0x710000, 0x717fff, 'SA', 'Saudi Arabia'],
  [0x718000, 0x71ffff, 'KR', 'South Korea'],
  [0x720000, 0x727fff, 'KP', 'North Korea'],
  [0x728000, 0x72ffff, 'IQ', 'Iraq'],
  [0x730000, 0x737fff, 'IR', 'Iran'],
  [0x738000, 0x73ffff, 'IL', 'Israel'],
  [0x740000, 0x747fff, 'JO', 'Jordan'],
  [0x748000, 0x74ffff, 'LB', 'Lebanon'],
  [0x750000, 0x757fff, 'MY', 'Malaysia'],
  [0x758000, 0x75ffff, 'PH', 'Philippines'],
  [0x760000, 0x767fff, 'PK', 'Pakistan'],
  [0x768000, 0x76ffff, 'SG', 'Singapore'],
  [0x770000, 0x777fff, 'LK', 'Sri Lanka'],
  [0x778000, 0x77ffff, 'SY', 'Syria'],
  [0x780000, 0x7bffff, 'CN', 'China'],
  [0x7c0000, 0x7fffff, 'AU', 'Australia'],
  [0x800000, 0x83ffff, 'IN', 'India'],
  [0x840000, 0x87ffff, 'JP', 'Japan'],
  [0x880000, 0x887fff, 'TH', 'Thailand'],
  [0x888000, 0x88ffff, 'VN', 'Vietnam'],
  [0x890000, 0x890fff, 'YE', 'Yemen'],
  [0x894000, 0x894fff, 'BH', 'Bahrain'],
  [0x895000, 0x8953ff, 'BN', 'Brunei'],
  [0x896000, 0x896fff, 'AE', 'United Arab Emirates'],
  [0x897000, 0x8973ff, 'SB', 'Solomon Islands'],
  [0x898000, 0x898fff, 'PG', 'Papua New Guinea'],
  [0x899000, 0x8993ff, 'TW', 'Taiwan'],
  [0x8a0000, 0x8a7fff, 'ID', 'Indonesia'],
  [0x900000, 0x9003ff, 'MH', 'Marshall Islands'],
  [0x901000, 0x9013ff, 'CK', 'Cook Islands'],
  [0x902000, 0x9023ff, 'WS', 'Samoa'],
  [0xa00000, 0xafffff, 'US', 'United States'],
  [0xc00000, 0xc3ffff, 'CA', 'Canada'],
  [0xc80000, 0xc87fff, 'NZ', 'New Zealand'],
  [0xc88000, 0xc88fff, 'FJ', 'Fiji'],
  [0xc8a000, 0xc8a3ff, 'NR', 'Nauru'],
  [0xc8c000, 0xc8c3ff, 'LC', 'Saint Lucia'],
  [0xc8d000, 0xc8d3ff, 'TO', 'Tonga'],
  [0xc8e000, 0xc8e3ff, 'KI', 'Kiribati'],
  [0xc90000, 0xc903ff, 'VU', 'Vanuatu'],
  [0xe00000, 0xe3ffff, 'AR', 'Argentina'],
  [0xe40000, 0xe7ffff, 'BR', 'Brazil'],
  [0xe80000, 0xe80fff, 'CL', 'Chile'],
  [0xe84000, 0xe84fff, 'EC', 'Ecuador'],
  [0xe88000, 0xe88fff, 'PY', 'Paraguay'],
  [0xe8c000, 0xe8cfff, 'PE', 'Peru'],
  [0xe90000, 0xe90fff, 'UY', 'Uruguay'],
  [0xe94000, 0xe94fff, 'BO', 'Bolivia'],
];

/** Every block, for tests and the allocation audit. Frozen: shared, not owned. */
export const ICAO_BLOCKS = Object.freeze(BLOCKS.map((b) => Object.freeze(b)));

/**
 * Flag emoji for an ISO 3166-1 alpha-2 code: two regional-indicator symbols.
 * Windows does not draw these as flags; it shows the two letters. That is why
 * the pane always prints the country name beside it.
 * @param {string} iso
 * @returns {string}
 */
export function flagEmoji(iso) {
  const code = String(iso || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    ...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

/**
 * Country of registry for an ICAO 24-bit address.
 * @param {string} hex Six hex digits; case and surrounding space ignored.
 *   Non-ICAO addresses (adsb.lol prefixes them with "~") return null.
 * @returns {{iso:string,name:string,flag:string}|null}
 */
export function countryForHex(hex) {
  const text = String(hex || '')
    .trim()
    .toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(text)) return null;
  const value = parseInt(text, 16);
  let lo = 0;
  let hi = BLOCKS.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [start, end, iso, name] = BLOCKS[mid];
    if (value < start) hi = mid - 1;
    else if (value > end) lo = mid + 1;
    else return { iso, name, flag: flagEmoji(iso) };
  }
  return null;
}
