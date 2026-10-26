// Generates the BOQ (Home) template and its golden fixture from a parsed dump of the Excel v5 workbook.
//
//   node scripts/excel/gen-boq-template.mjs <boq_rows.json>
//
// <boq_rows.json> is produced from the workbook dump (one object per sheet row with the cell value
// in `X` and its formula in `Xf`, e.g. { row: 58, E: "4.536", Ef: "'ตารางสรุป…'!P6", Hf: "MAX(1,CEILING(…))" }).
// Outputs:
//   src/domain/boq/template.v5.ts        — section/line templates (rules derived from the formulas)
//   src/domain/boq/__tests__/golden.v5.json — the values Excel cached for every row, sub-total and M310
import fs from 'node:fs';
import path from 'node:path';

const [, , input] = process.argv;
if (!input) { console.error('usage: node gen-boq-template.mjs <boq_rows.json>'); process.exit(1); }
const rows = JSON.parse(fs.readFileSync(input, 'utf8')).sort((a, b) => a.row - b.row);
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', '..');

const SHEET_TO_CALC = {
    'ถมดิน': 'fill',
    'ฐานราก_Footing': 'footing',
    'ตารางสรุปวัสดุงานโครงสร้าง': 'structure-summary',
    'คานคอดิน_Beam': 'ground-beam',
    ' พื้นสำเร็จรูป_PS': 'precast-slab',
    'ท่อน้ำทิ้ง_Waste Pipe': 'waste-pipe',
    'โครงสร้างหลังคา Roof Structure': 'roof-structure',
    'มุงหลังคา_Roofing': 'roofing',
    'ก่ออิฐ_Brick': 'brick',
    'ท่อร้อยสายไฟ_Electrical Pipe': 'electrical-pipe',
    'ฉาบปูน_Plaster': 'plaster',
    'ประตู-หน้าต่าง_Door&Window': 'door-window',
    'สายไฟ_Electrical Cable': 'electrical-cable',
    'ฝ้าเพดาน_Ceiling': 'ceiling',
    'ปูกระเบื้องพื้น_Floor Tile': 'floor-tile',
    'ปูกระเบื้องห้องน้ำ_Toilet': 'toilet-tile',
    'ท่อน้ำดี_Water Pipe': 'water-pipe',
    'ตกแต่งผนัง_Wall Finishing': 'wall-finishing',
    'ทาสี_Paint ': 'paint',
    'ตู้ควบคุม_Load Center': 'load-center',
    'อุปกรณ์ไฟฟ้า_Equipment ': 'electrical-equipment',
    'ระบบสุขาภิบาล_Sanitary System': 'sanitary-system',
    'เบ็ดเตล็ด_Other': 'misc',
    'สุขภัณฑ์_Sanitary': 'sanitary-ware',
};

// Calculator pages each section links to (design doc §4).
const SECTION_CALCS = {
    0: ['land-inspection'], 1: ['demolition', 'fill'], 2: ['temp-utilities'], 3: ['site-camp'], 4: ['layout'],
    5: ['piles'], 6: ['footing', 'structure-summary'], 7: ['pedestal'], 8: ['ground-beam'], 9: ['slab-on-grade', 'waste-pipe'],
    10: ['precast-slab'], 11: ['column'], 12: ['roof-beam', 'roof-slab'], 13: ['stair'], 14: [],
    15: ['roof-structure'], 16: ['roofing'], 17: ['brick', 'electrical-pipe'], 18: ['plaster', 'door-window', 'electrical-cable'],
    19: ['ceiling'], 20: ['floor-tile'], 21: ['toilet-tile', 'water-pipe'], 22: ['wall-finishing'], 23: ['paint'],
    24: ['door-window'], 25: ['paint'], 26: ['load-center', 'electrical-equipment'], 27: ['sanitary-system'], 28: ['misc'],
    29: ['sanitary-ware'], 30: ['door-window'], 31: ['paint'],
};

// Runs of rows whose count depends on the calculator (bar sizes, doors, pick-lists): the calculator
// supplies them through `boqSlots`; these Excel rows are the fallback.
const SLOTS = [
    { from: 43, to: 45, calc: 'footing', slot: 'rebar' },
    { from: 47, to: 49, calc: 'pedestal', slot: 'rebar' },
    { from: 51, to: 53, calc: 'column', slot: 'rebar' },
    { from: 71, to: 73, calc: 'ground-beam', slot: 'rebar' },
    { from: 75, to: 75, calc: 'precast-slab', slot: 'shear-key' },
    { from: 92, to: 93, calc: 'slab-on-grade', slot: 'rebar' },
    { from: 116, to: 118, calc: 'roof-beam', slot: 'rebar' },
    { from: 127, to: 128, calc: 'roof-slab', slot: 'rebar' },
    { from: 138, to: 139, calc: 'stair', slot: 'rebar' },
    { from: 234, to: 242, calc: 'door-window', slot: 'aluminium' },
    { from: 256, to: 263, calc: 'load-center', slot: 'items' },
    { from: 265, to: 270, calc: 'electrical-equipment', slot: 'items' },
    { from: 273, to: 276, calc: 'sanitary-system', slot: 'items' },
    { from: 279, to: 279, calc: 'misc', slot: 'items' },
    { from: 282, to: 291, calc: 'sanitary-ware', slot: 'items' },
    { from: 294, to: 297, calc: 'door-window', slot: 'wood' },
];

const num = v => (v === undefined || v === '' ? undefined : Number(v));
const clean = s => (s ?? '').replace(/\s+$/u, '').replace(/^\s+/u, '');
const key = r => `R${r}`;
/** Formula body, unwrapping `SHARED(si=N, master X: f)` to the master formula shifted to this row. */
function body(f, row) {
    if (!f) return undefined;
    const m = /^SHARED\(si=\d+, master ([A-Z]+)(\d+): (.*)\)$/s.exec(f);
    if (!m) return f.trim();
    const shift = row - Number(m[2]);
    return m[3].replace(/(\$?)([A-Z]{1,2})(\$?)(\d+)/g, (all, d1, c, d2, n) => d2 ? all : `${d1}${c}${Number(n) + shift}`).trim();
}
const rangeKeys = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => key(a + i));

const sections = [];
const golden = { lines: {}, sections: {}, constructionTotal: undefined };
let cur = null;

for (const r of rows) {
    if (r.row === 310) { golden.constructionTotal = num(r.M); continue; }
    if (r.row > 308) continue;
    if (r.B !== undefined && r.B !== '' && !Number.isNaN(Number(r.B))) {
        cur = { no: Number(r.B), title: clean(r.C), lines: [] };
        sections.push(cur);
        continue;
    }
    if (!cur) continue;
    const desc = clean(r.D);
    if (desc === 'รวม >>') {
        golden.sections[cur.no] = { J: num(r.J), L: num(r.L), M: num(r.M), excelRow: r.row };
        continue;
    }
    const hasMath = r.Jf || r.Lf || r.Mf;
    if (!hasMath) {
        if (desc || clean(r.C)) cur.lines.push({ type: 'heading', key: key(r.row), excelRow: r.row, itemNo: clean(r.C) || undefined, desc });
        continue;
    }

    // ── quantity (E)
    const Ef = body(r.Ef, r.row);
    let qty;
    let m;
    const E = num(r.E);
    if (!Ef) qty = E === undefined ? { kind: 'none' } : { kind: 'input', value: E };
    else if ((m = /^([\d.]+)\*E(\d+)$/.exec(Ef))) qty = { kind: 'line', ref: key(+m[2]), factor: +m[1] };
    else if ((m = /^E(\d+)\*([\d.]+)$/.exec(Ef))) qty = { kind: 'line', ref: key(+m[1]), factor: +m[2] };
    else if ((m = /^E(\d+)$/.exec(Ef))) qty = { kind: 'line', ref: key(+m[1]), factor: 1 };
    else if ((m = /^SUM\(E(\d+):E(\d+)\)$/.exec(Ef))) qty = { kind: 'sumLines', refs: rangeKeys(+m[1], +m[2]) };
    else {
        const sheet = Object.keys(SHEET_TO_CALC).find(s => Ef.includes(`'${s}'!`) || Ef.includes(`${s}!`));
        // Google-Sheets spill cells (FILTER results beyond the first row) carry no sheet name:
        // they belong to the same calculator as the line that started the spill.
        const spillFrom = Ef.includes('COMPUTED_VALUE')
            ? [...cur.lines].reverse().find(l => l.type === 'item' && l.qty.kind === 'calc')
            : undefined;
        if (!sheet && !spillFrom) throw new Error(`Row ${r.row}: unknown E formula ${Ef}`);
        const calc = sheet ? SHEET_TO_CALC[sheet] : spillFrom.qty.calc;
        qty = { kind: 'calc', calc, output: key(r.row), fallback: E ?? 0 };
    }

    // ── gross (H)
    const Hf = body(r.Hf, r.row);
    let gross;
    if (!Hf) gross = 'none';
    else if (/^E\d+\*\(100%\+G\d+\)$/.test(Hf)) gross = 'std';
    else if (/^ROUNDUP\(\(E\d+\*\(100%\+G\d+\)\),0\)$/.test(Hf)) gross = 'ceilInt';
    else if (/^MAX\(1,CEILING\(E\d+\*\(1\+G\d+\),0\.25\)\)$/.test(Hf)) gross = 'concrete';
    else if ((m = /^\(([H\d+]+)\)\*([\d.]+)$/.exec(Hf.replace(/\s/g, '')))) {
        gross = { kind: 'tieWire', refs: m[1].split('+').map(h => key(+h.slice(1))), ratio: +m[2] };
    } else throw new Error(`Row ${r.row}: unknown H formula ${Hf}`);

    // ── prices (I, K)
    const priceRule = (val, f) => {
        const b = body(f, r.row);
        if (!b) return num(val) ?? 0;
        let p;
        if ((p = /^([IK])(\d+)\*2$/.exec(b))) return { kind: 'linePrice', ref: key(+p[2]), factor: 2 };
        if ((p = /^SUM\(J(\d+)(?::J(\d+))?,L\d+(?::L\d+)?\)\*(\d+)%$/.exec(b))) {
            return { kind: 'consumables', refs: rangeKeys(+p[1], p[2] ? +p[2] : +p[1]), pct: +p[3] / 100 };
        }
        if (/^[\d.*]+$/.test(b)) return num(val) ?? 0;   // e.g. 2.6*2.05*3000 (door size × rate; computed in P3)
        throw new Error(`Row ${r.row}: unknown price formula ${b}`);
    };
    const mat = priceRule(r.I, r.If);
    const lab = priceRule(r.K, r.Kf);

    const Jf = body(r.Jf, r.row) ?? '';
    const Lf = body(r.Lf, r.row) ?? '';
    const materialBasis = /^I\d+\*E\d+$/.test(Jf) ? 'net' : 'gross';
    const labourBasis = /^K\d+\*H\d+$/.test(Lf) ? 'gross' : 'net';

    const line = {
        type: 'item', key: key(r.row), excelRow: r.row,
        itemNo: clean(r.C) || undefined, desc, unit: clean(r.F),
        qty, waste: num(r.G) ?? 0, gross, mat, lab, materialBasis, labourBasis,
        note: clean(r.N) || undefined,
    };
    cur.lines.push(line);
    golden.lines[line.key] = { E: num(r.E), H: num(r.H), I: num(r.I), J: num(r.J), K: num(r.K), L: num(r.L), M: num(r.M) };
}

function withSlots(lines) {
    const result = [];
    for (const l of lines) {
        const def = SLOTS.find(s => l.excelRow >= s.from && l.excelRow <= s.to);
        if (!def) { result.push(l); continue; }
        const key = `S${def.from}`;
        let slot = result.find(x => x.type === 'slot' && x.key === key);
        if (!slot) {
            slot = { type: 'slot', key, excelRow: def.from, calc: def.calc, slot: def.slot, fallback: [] };
            result.push(slot);
        }
        slot.fallback.push(l);
    }
    return result;
}

const out = sections.map(s => ({
    no: s.no, title: s.title, calculators: SECTION_CALCS[s.no] ?? [], inConstructionTotal: s.no !== 0, lines: withSlots(s.lines),
}));

const ts = `// GENERATED by scripts/excel/gen-boq-template.mjs from Excel v5 "BOQ (Home)" — do not edit by hand.
// Rules (qty source, gross rounding, price formulas, labour/material basis) are derived from each row's formulas.
import type { BoqSectionTemplate } from './types';

export const BOQ_TEMPLATE_V5: BoqSectionTemplate[] = ${JSON.stringify(out, null, 2)};
`;
fs.writeFileSync(path.join(repo, 'src/domain/boq/template.v5.ts'), ts);
fs.mkdirSync(path.join(repo, 'src/domain/boq/__tests__'), { recursive: true });
fs.writeFileSync(path.join(repo, 'src/domain/boq/__tests__/golden.v5.json'), JSON.stringify(golden, null, 1));
const flat = out.flatMap(s => s.lines.flatMap(l => (l.type === 'slot' ? l.fallback : [l])));
const nItems = flat.filter(l => l.type === 'item').length;
const nSlots = out.reduce((s, x) => s + x.lines.filter(l => l.type === 'slot').length, 0);
console.log(`sections: ${out.length}, item lines: ${nItems}, slots: ${nSlots}, golden total: ${golden.constructionTotal}`);
const kinds = {};
for (const l of flat) if (l.type === 'item') kinds[l.qty.kind] = (kinds[l.qty.kind] ?? 0) + 1;
console.log('qty kinds:', kinds);
