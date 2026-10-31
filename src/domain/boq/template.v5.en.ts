// ─── English overlay of the v5 BOQ template (docs/erp/03-i18n.md §6) ───
// Keyed by the template line key (`R<excelRow>`, item and heading rows, slot fallback rows included) and by section
// number. Used when a quotation is built from a BOQ (desc_en of each line; the user can edit it) and later by the
// BOQ page in English (I-08). Pure data + lookups; the Thai template (template.v5.ts) stays the source of truth.
import { BOQ_TEMPLATE_V5 } from './template.v5';

export const BOQ_SECTION_TITLES_EN: Readonly<Record<number, string>> = {
    0: 'Site investigation',
    1: 'Site preparation',
    2: 'Temporary water and electricity',
    3: 'Site facilities',
    4: 'Setting out / staking',
    5: 'Piling works',
    6: 'Foundation works',
    7: 'Pedestal works',
    8: 'Ground beam works',
    9: 'Cast-in-place slab works',
    10: 'Precast slab works',
    11: 'Ground floor column works',
    12: 'Roof deck beam and slab works',
    13: 'Stair structure works',
    14: 'Column head plate works',
    15: 'Roof structure works',
    16: 'Roofing works',
    17: 'Masonry works',
    18: 'Plastering works',
    19: 'Ceiling works',
    20: 'Floor tiling works',
    21: 'Bathroom tiling works',
    22: 'Wall finishing works',
    23: 'Primer painting works',
    24: 'Aluminium doors and windows',
    25: 'Finish painting, first coat',
    26: 'Electrical fixtures installation',
    27: 'Sanitary system works',
    28: 'Miscellaneous works',
    29: 'Sanitary ware',
    30: 'Wooden doors and windows',
    31: 'Final coat painting',
};

const REBAR = (size: string) => `- Rebar ${size}`;
const TIE_WIRE = '- Tie wire';
const FORMWORK = 'Concrete formwork';
const FORM_TIMBER = '- Formwork timber';
const FORM_BRACING = '- Formwork bracing timber';
const FORM_NAILS = '- Formwork nails';
const STRUCT_CONCRETE = 'Structural concrete (240 ksc cube)';
const LEAN_CONCRETE = 'Lean concrete (1:3:5)';
const REINFORCEMENT = 'Reinforcement';
const CONSUMABLES = '- Materials, accessories and consumables';
const SHORING = 'Timber shoring';

/** Painting rows (sections 23, 25 and 31 list the same eight surfaces). */
const PAINT = {
    wallOut: 'Wall painting - exterior',
    wallIn: 'Wall painting - interior',
    ceilOut: 'Ceiling painting - exterior',
    ceilIn: 'Ceiling painting - interior',
    ceilBatten: 'Ceiling painting - battens',
    wallBatten: 'Wall painting - battens',
    moulding: 'Wall painting - mouldings',
    fascia: 'Wall painting - fascia',
};

/** English description of every template line (item, heading and slot fallback rows). */
export const BOQ_LINES_EN: Readonly<Record<string, { desc: string }>> = Object.fromEntries(Object.entries({
    // 0
    R9: 'Site investigation fee',
    // 1
    R12: 'Demolition',
    R13: 'Fill (to specification) and compaction',
    // 2
    R16: 'Temporary water and electrical supply',
    // 3
    R19: "Workers' quarters",
    R20: "Workers' toilet",
    R21: 'Shower room',
    R22: 'Storage room',
    R23: 'Cement store',
    R24: 'Temporary work area (rebar bending)',
    R25: 'Temporary fence',
    R26: 'Site entrance and exit gate',
    R27: 'Dust protection sheeting',
    R28: 'Material stockpile area',
    R29: 'Waste disposal area',
    // 4
    R32: 'Setting out / staking',
    // 5
    R35: 'Piles',
    // 6
    R38: 'Excavation',
    R39: 'Pile head cutting',
    R40: 'Coarse sand',
    R41: LEAN_CONCRETE,
    R42: 'Reinforcement - ***footings',
    R43: REBAR('RB9'),
    R44: REBAR('DB12'),
    R45: TIE_WIRE,
    R46: 'Reinforcement - ***pedestals',
    R47: REBAR('RB6'),
    R48: REBAR('DB12'),
    R49: TIE_WIRE,
    R50: 'Reinforcement - ***ground floor columns',
    R51: REBAR('RB6'),
    R52: REBAR('DB12'),
    R53: TIE_WIRE,
    R54: FORMWORK,
    R55: FORM_TIMBER,
    R56: FORM_BRACING,
    R57: FORM_NAILS,
    R58: STRUCT_CONCRETE,
    // 7
    R61: FORMWORK,
    R62: FORM_TIMBER,
    R63: FORM_BRACING,
    R64: FORM_NAILS,
    R65: STRUCT_CONCRETE,
    // 8
    R68: 'Backfill',
    R69: LEAN_CONCRETE,
    R70: REINFORCEMENT,
    R71: REBAR('RB6'),
    R72: REBAR('DB12'),
    R73: TIE_WIRE,
    R74: 'Precast slab end locking bars',
    R75: REBAR('RB6'),
    R76: FORMWORK,
    R77: FORM_TIMBER,
    R78: FORM_BRACING,
    R79: FORM_NAILS,
    R80: STRUCT_CONCRETE,
    // 9
    R83: 'Waste pipes',
    R84: 'Toilet waste pipe PVC 4"',
    R85: 'Waste pipe ØW ØFD PVC 2"',
    R86: 'Septic tank vent pipe PVC 1"',
    R87: CONSUMABLES,
    R88: 'Backfill',
    R89: 'Coarse sand',
    R90: 'Damp-proof plastic sheet',
    R91: REINFORCEMENT,
    R92: REBAR('RB9'),
    R93: TIE_WIRE,
    R94: STRUCT_CONCRETE,
    // 10
    R97: 'Precast slab (LL 250 kg/sq.m)',
    R98: `- ${SHORING}`,
    R99: 'Wire mesh 4 mm @ 20 cm',
    R100: FORMWORK,
    R101: FORM_TIMBER,
    R102: FORM_BRACING,
    R103: FORM_NAILS,
    R104: STRUCT_CONCRETE,
    // 11
    R107: FORMWORK,
    R108: FORM_TIMBER,
    R109: FORM_BRACING,
    R110: FORM_NAILS,
    R111: STRUCT_CONCRETE,
    // 12
    R114: 'Roof deck beams',
    R115: REINFORCEMENT,
    R116: REBAR('RB6'),
    R117: REBAR('DB12'),
    R118: TIE_WIRE,
    R119: SHORING,
    R120: FORMWORK,
    R121: FORM_TIMBER,
    R122: FORM_BRACING,
    R123: FORM_NAILS,
    R124: STRUCT_CONCRETE,
    R125: 'Roof deck slab',
    R126: REINFORCEMENT,
    R127: REBAR('RB9'),
    R128: TIE_WIRE,
    R129: SHORING,
    R130: FORMWORK,
    R131: FORM_TIMBER,
    R132: FORM_BRACING,
    R133: FORM_NAILS,
    R134: STRUCT_CONCRETE,
    // 13
    R137: REINFORCEMENT,
    R138: REBAR('RB9'),
    R139: TIE_WIRE,
    R140: SHORING,
    R141: FORMWORK,
    R142: FORM_TIMBER,
    R143: FORM_BRACING,
    R144: FORM_NAILS,
    R145: STRUCT_CONCRETE,
    // 14
    R148: 'Square steel base plate, 9 mm thick, 8 x 8 in.',
    R149: 'Non-shrink grout',
    // 15
    R152: 'Wall plate 2-C 150x50x20x3.2 mm',
    R153: 'King post 2-C 100x50x20x2.3 mm',
    R154: 'Ridge beam 2-C 100x50x20x2.3 mm',
    R155: 'Valley rafter C 100x50x20x2.3 mm',
    R156: 'Rafter C 100x50x20x2.3 mm',
    R157: 'Prefabricated GZ purlin, 0.7 mm thick',
    R158: 'Anti-rust painting',
    R159: 'Steel structure labour (incl. welding rods and cutting discs)',
    // 16
    R162: 'CPAC Monier roof tiles',
    R163: 'Curved ridge cap',
    R164: 'Gable verge cap',
    R165: 'Wall abutment cap',
    R166: 'Eave closure cap',
    R167: 'Gable end cap',
    R168: 'Two-way curved ridge cap',
    R169: 'DRYTECH dry ridge system set',
    R170: 'Wall abutment cap set',
    R171: 'Valley gutter',
    R172: 'Bird stop',
    R173: 'Fascia board',
    R174: 'Heat-reflective foil (1.25 x 60 m per roll)',
    R175: 'Roofing labour',
    R176: 'Fascia board installation labour',
    // 17
    R179: 'Clay brick wall (half brick)',
    R180: 'Clay brick wall (full brick)',
    R181: 'Lightweight concrete block wall (half block)',
    R182: 'Lightweight concrete block wall (full block)',
    R183: 'Stiffener columns and lintels',
    R184: 'Electrical conduit',
    R185: '- Electrical conduit PVC 1/2"',
    R186: CONSUMABLES,
    // 18
    R189: 'Wall plastering (exterior)',
    R190: 'Wall plastering (interior)',
    R191: 'Timber door frames',
    R192: 'Electrical wiring',
    R193: '- THW wire 1.5 sq.mm, total',
    R194: '- THW wire 2.5 sq.mm, total',
    R195: '- THW wire 4 sq.mm, total',
    R196: CONSUMABLES,
    // 19
    R199: 'Gypsum board ceiling on C-line frame, 9 mm thick',
    R200: 'Moisture-resistant gypsum board ceiling on C-line frame, 9 mm thick',
    R201: 'Fibre cement ceiling, 4 mm thick',
    R202: 'Fibre cement board batten ceiling, 4 in. wide, 9 mm thick',
    // 20
    R205: 'Granito floor tiling',
    R206: 'Anti-slip granito floor tiling (terraces and stairs)',
    R207: 'Levelling and waterproofing (RC roof deck)',
    // 21
    R210: 'Anti-slip granito floor tiling',
    R211: 'Granito wall tiling',
    R212: 'Water supply system - supply pipes',
    R213: 'External main pipe PVC 3/4"',
    R214: 'Internal branch pipe (bathrooms) PVC 1/2"',
    R215: CONSUMABLES,
    // 22
    R218: 'Decorative wall moulding, 0.3 m, 0.1 m thick',
    R219: 'Decorative wall moulding, 0.1 m, 0.1 m thick',
    R220: 'Fibre cement board batten wall cladding, 4 in. wide, 9 mm thick',
    // 23
    R223: PAINT.wallOut,
    R224: PAINT.wallIn,
    R225: PAINT.ceilOut,
    R226: PAINT.ceilIn,
    R227: PAINT.ceilBatten,
    R228: PAINT.wallBatten,
    R229: PAINT.moulding,
    R230: PAINT.fascia,
    R231: 'Skim coat - total',
    // 24
    R234: 'D1 - Double sliding door with fixed light, 2.6 x 2.05 m',
    R235: 'D2 - Sliding door, 1.5 x 2.05 m',
    R236: 'D6 - Sliding door, 1.6 x 2.05 m',
    R237: 'D7 - Sliding door with fixed light, 1.65 x 2.65 m',
    R238: 'D8 - Casement door, 0.6 x 2.65 m',
    R239: 'D9 - Sliding door, 2.4 x 2.05 m',
    R240: 'W1 - Sliding window, 1.3 x 1.2 m',
    R241: 'W2 - Casement window with fixed light, 0.6 x 1.8 m',
    R242: 'W3 - Awning window, 1.8 x 0.5 m',
    // 25
    R245: PAINT.wallOut,
    R246: PAINT.wallIn,
    R247: PAINT.ceilOut,
    R248: PAINT.ceilIn,
    R249: PAINT.ceilBatten,
    R250: PAINT.wallBatten,
    R251: PAINT.moulding,
    R252: PAINT.fascia,
    // 26
    R255: 'Electrical distribution board',
    R256: 'Consumer unit, 18 ways',
    R257: 'Main circuit breaker 100 A',
    R258: 'Branch circuit breaker (CB) 16 A',
    R259: 'Branch circuit breaker (CB) 20 A',
    R260: 'Earth leakage circuit breaker (ELCB) 20 A',
    R261: 'THW main power cable 25 sq.mm',
    R262: 'Copper ground rod 5/8", 2.40 m long',
    R263: 'THW ground wire 10 sq.mm',
    R264: 'Electrical fixtures',
    R265: 'Downlight',
    R266: 'Round ceiling lamp',
    R267: 'Waterproof fluorescent lamp',
    R268: 'One-way switch (with cover plate)',
    R269: 'Double socket outlet with ground (with cover plate)',
    R270: 'Waterproof double socket outlet with ground (with cover plate)',
    // 27
    R273: 'Grease trap, 20 litres',
    R274: 'Prefabricated septic tank, 600 litres',
    R275: 'Prefabricated drainage inspection chamber, 40 x 40 cm',
    R276: 'AC drain pipe Dia. 8"',
    // 28
    R279: 'Glass balustrade, terraces 1 and 2',
    // 29
    R282: 'Floor-mounted toilet',
    R283: 'Bidet spray',
    R284: 'Washbasin',
    R285: 'Basin tap',
    R286: 'Mirror',
    R287: 'Toilet paper holder',
    R288: 'Towel rail',
    R289: 'Floor drain with odour trap',
    R290: 'Soap holder',
    R291: 'Shower set',
    // 30
    R294: 'D3 - Single swing door, 0.8 x 2 m',
    R295: 'D4 - Single swing door, 0.8 x 2 m',
    R296: 'D5 - Single swing door with ventilation louvres, 0.7 x 2 m',
    R297: 'W4 - Round fixed window, Dia. 1.1 m',
    // 31
    R300: PAINT.wallOut,
    R301: PAINT.wallIn,
    R302: PAINT.ceilOut,
    R303: PAINT.ceilIn,
    R304: PAINT.ceilBatten,
    R305: PAINT.wallBatten,
    R306: PAINT.moulding,
    R307: PAINT.fascia,
}).map(([key, desc]) => [key, { desc }]));

/** Thai text compared without stray spaces (like the pick lists' matchKey). */
const norm = (s: string): string => s.trim().replace(/\s+/g, ' ');

/** Template Thai description by line key, and English by Thai description (first template line wins). */
const TEMPLATE_DESC = new Map<string, string>();
const EN_BY_THAI = new Map<string, string>();
for (const section of BOQ_TEMPLATE_V5) {
    for (const line of section.lines) {
        const rows = line.type === 'slot' ? line.fallback : [line];
        for (const row of rows) {
            TEMPLATE_DESC.set(row.key, norm(row.desc));
            const en = BOQ_LINES_EN[row.key]?.desc;
            if (en !== undefined && !EN_BY_THAI.has(norm(row.desc))) EN_BY_THAI.set(norm(row.desc), en);
        }
    }
}

// Door / window names typed on the schedule ("D1-บานเลื่อนคู่ และช่องแสงติดตาย ขนาด 2.6 x 2.05 ม.").
const OPENING_KINDS: readonly [string, string][] = [
    ['บานเลื่อนคู่', 'Double sliding'],
    ['บานเลื่อนสลับ', 'Sliding'],
    ['บานเลื่อน', 'Sliding'],
    ['บานกระทุ้งข้าง', 'Casement'],
    ['บานกระทุ้งล่าง', 'Awning'],
    ['บานกระทุ้ง', 'Awning'],
    ['บานเปิดเดี่ยว', 'Single swing'],
    ['บานเปิดคู่', 'Double swing'],
    ['บานเปิด', 'Swing'],
    ['บานวงกลม', 'Round'],
    ['บานติดตาย', 'Fixed'],
];
const THAI = /[\u0E00-\u0E7F]/;

/** English name of a door/window schedule row, or '' when part of it is not understood. */
function openingEn(descTh: string): string {
    const m = /^\s*([A-Za-z]{1,3}\d*[A-Za-z]?)\s*-\s*(.*)$/.exec(descTh);
    const code = m?.[1] ?? '';
    let rest = norm(m?.[2] ?? descTh);
    let size = '';
    const at = rest.indexOf('ขนาด');
    if (at >= 0) {
        size = rest.slice(at + 'ขนาด'.length).trim().replace(/\s*ม\.\s*$/, ' m').replace(/^Dia\.\s*/i, 'Dia. ');
        rest = rest.slice(0, at).trim();
    }
    const kind = OPENING_KINDS.find(([th]) => rest.startsWith(th));
    if (kind === undefined) return '';
    rest = rest.slice(kind[0].length).trim();
    const noun = /^D/i.test(code) ? 'door' : /^W/i.test(code) ? 'window' : '';
    let fixed = false;
    const tail: string[] = [];
    for (const word of rest.replace(/และ\s*ช่องแสงติดตาย/g, ' +light ').split(' ').filter(w => w !== '')) {
        if (word === '+light') tail.push('with fixed light');
        else if (word === 'ช่องแสงติดตาย') fixed = true;
        else if (word === 'มีเกล็ดระบายอากาศ') tail.push('with ventilation louvres');
        else return '';
    }
    const text = [kind[1], fixed ? 'fixed' : '', noun, ...tail].filter(w => w !== '').join(' ');
    const out = `${code !== '' ? `${code} - ` : ''}${text}${size !== '' ? `, ${size}` : ''}`;
    return THAI.test(out) ? '' : out;
}

/**
 * English description of a slot row supplied by a calculator (key `${calc}:${slot}:${rowKey}`): rebar and tie-wire
 * rows, pick-list items that are in the template, door/window names. '' when it cannot be translated.
 */
export function slotLineEn(lineKey: string, descTh: string): string {
    const d = norm(descTh);
    const rebar = /^(-\s*)?เหล็ก(?:เส้น)?\s*((?:RB|DB)\d+)$/.exec(d);
    if (rebar) return `${rebar[1] !== undefined ? '- ' : ''}Rebar ${rebar[2]}`;
    if (/^-?\s*ลวดผูกเหล็ก$/.test(d)) return d.startsWith('-') ? TIE_WIRE : 'Tie wire';
    const known = EN_BY_THAI.get(d);
    if (known !== undefined) return known;
    if (lineKey.startsWith('door-window:')) return openingEn(d);
    return '';
}

/**
 * English description of a BOQ line. A template line whose Thai text is still the template's gets the overlay; any
 * other line (text changed by a calculator or the user, slot rows) is matched by its Thai text, then by slot rules.
 * '' when nothing fits (the user types it on the quotation).
 */
export function boqLineEn(lineKey: string, descTh: string): string {
    // boqVersionLines suffixes a repeated key with `#n`.
    const key = lineKey.replace(/#\d+$/, '');
    const d = norm(descTh);
    const overlay = BOQ_LINES_EN[key]?.desc;
    if (overlay !== undefined && TEMPLATE_DESC.get(key) === d) return overlay;
    return EN_BY_THAI.get(d) ?? slotLineEn(key, d);
}
