// Differential test of the BOQ (Home) sheet itself: the user's edits on the BOQ page (typed net qty E, waste G,
// unit prices I and K) are typed into the real Excel v5 workbook (evaluated by the oracle) and applied to the app
// as `boqOverrides`; every computed column (E H I J K L M), every section subtotal, M310 and section 0 must agree.
// ~50 seeded random edit sets + named edge cases. Guide: docs/rebuild/ORACLE_TESTS.md.
//
// Documented differences, asserted exactly:
// - D1 concrete (engine.ts): H = MAX(1, CEILING(E·(1+G), 0.25)) orders 1 m³ in Excel with no concrete; the app 0.
// - D1 short SUM ranges (00-rebuild-design.md D1 "SUM ไม่ครอบทุกแถว"; engine.ts): the app's subtotals sum every
//   row of the section. Excel: J95/L95 skip the pipes R84–R87, J216/L216 skip R213–R215, L243 skips L234:L235, and
//   J14/L14/M14 skip R12 (งานรื้อถอน — not in engine.ts's list, it is 0 in the sample).
// - D2: section 0 is left out of M310; the app reports it as preConstructionTotal.
// - Calculator-side decisions (D3 R16 price, D1 R121 roof-beam formwork, D1 R218/R219 moulding swap, D1 roof-beam
//   rebar waste G116/G117) are pinned to Excel's value here (as if typed on the BOQ page) so the BOQ formulas are
//   compared on the same inputs; the pins are asserted to be exactly those decisions (KNOWN_DELTAS in
//   src/domain/__tests__/project-golden.test.ts) in their own test below.
import { beforeAll, describe, expect, it } from 'vitest';
import { closeTo, loadV5Oracle, type ExcelOracle, type OracleInput } from '../../../test-utils/excel-oracle';
import { expectClose, seededRandom, type Random } from '../../../test-utils/oracle-helpers';
import { roofBeam, roofBeamTotals } from '../../calculators/roof-beam';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { REBAR_WASTE, isRebarSize } from '../slots';
import { BOQ_TEMPLATE_V5 } from '../template.v5';
import type { BoqItemRow, BoqItemTemplate, BoqLineOverride, BoqResult } from '../types';

const BOQ = 'BOQ (Home)';
const ref = (col: string, row: number) => `${BOQ}!${col}${row}`;
const COMPARED = ['E', 'H', 'I', 'J', 'K', 'L', 'M'] as const;
type Col = typeof COMPARED[number];
const appValue = (r: BoqItemRow, col: Col): number => {
    switch (col) {
        case 'E': return r.qty;
        case 'H': return r.grossQty ?? 0;
        case 'I': return r.matUnit;
        case 'J': return r.matTotal;
        case 'K': return r.labUnit;
        case 'L': return r.labTotal;
        case 'M': return r.total;
    }
};

// ─── App rows ↔ Excel rows ──────────────────────────────────────────────────
interface MappedRow { section: number; row: BoqItemRow; excelRow: number }

/** Excel rows reserved for each slot (`${calc}.${slot}` → first row, row count). */
const SLOT_RANGES = new Map<string, { first: number; size: number }>();
for (const s of BOQ_TEMPLATE_V5) for (const l of s.lines) if (l.type === 'slot') SLOT_RANGES.set(`${l.calc}:${l.slot}`, { first: l.excelRow, size: l.fallback.length });

/** Template rows (incl. the slots' Excel fallback rows) by Excel row. */
const TEMPLATE_ROWS = new Map<number, BoqItemTemplate>();
for (const s of BOQ_TEMPLATE_V5) {
    for (const l of s.lines) {
        if (l.type === 'item') TEMPLATE_ROWS.set(l.excelRow, l);
        if (l.type === 'slot') for (const f of l.fallback) if (f.type === 'item') TEMPLATE_ROWS.set(f.excelRow, f);
    }
}

/** Template rows keep their Excel row; slot rows (`calc:slot:key`) fill the slot's Excel rows in order. */
function mapRows(boq: BoqResult): MappedRow[] {
    const out: MappedRow[] = [];
    const used = new Map<string, number>();
    for (const s of boq.sections) {
        for (const row of s.rows) {
            if (row.type !== 'item') continue;
            if (/^R\d+$/.test(row.key)) { out.push({ section: s.no, row, excelRow: row.excelRow }); continue; }
            const slot = row.key.split(':').slice(0, 2).join(':');
            const range = SLOT_RANGES.get(slot);
            const k = used.get(slot) ?? 0;
            used.set(slot, k + 1);
            if (!range || k >= range.size) throw new Error(`slot ${slot}: more app rows than Excel rows (${row.key})`);
            out.push({ section: s.no, row, excelRow: range.first + k });
        }
    }
    return out;
}

/** Excel slot rows the app has no row for (they must be empty in Excel). */
function unusedSlotRows(mapped: MappedRow[]): number[] {
    const used = new Set(mapped.map(m => m.excelRow));
    return [...SLOT_RANGES.values()].flatMap(r => Array.from({ length: r.size }, (_, k) => r.first + k)).filter(r => !used.has(r));
}

// ─── Editable cells (yellow inputs of the BOQ page) ─────────────────────────
type EditCol = 'E' | 'G' | 'I' | 'K';
const FIELD: Record<EditCol, keyof Pick<BoqLineOverride, 'qty' | 'waste' | 'mat' | 'lab'>> = { E: 'qty', G: 'waste', I: 'mat', K: 'lab' };

interface EditCell { col: EditCol; excelRow: number; key: string; base: number; section: number }
type Edits = (readonly [EditCell, number])[];

/** A formula that reads no cell (e.g. I234 `=2.6*2.05*3000`) is a typed constant. */
const readsCells = (f: string | undefined) => f !== undefined && /[A-Z]{1,3}\$?\d|!|:/.test(f.replace(/"[^"]*"/g, ''));

function editableCells(oracle: ExcelOracle, mapped: MappedRow[]): EditCell[] {
    const cells: EditCell[] = [];
    for (const { row, excelRow, section } of mapped) {
        const h = oracle.formula(ref('H', excelRow)) ?? '';
        for (const col of ['E', 'G', 'I', 'K'] as const) {
            const f = oracle.formula(ref(col, excelRow));
            const v = oracle.get(ref(col, excelRow));
            if (readsCells(f) || typeof v !== 'number') continue;          // a formula, or a blank cell
            if (col === 'E' && f !== undefined) continue;
            if (col === 'G' && !h.includes(`G${excelRow}`)) continue;     // G not used by this row's H
            cells.push({ col, excelRow, key: row.key, base: v, section });
        }
    }
    return cells;
}

// ─── Random but plausible edits ─────────────────────────────────────────────
const WASTES = [0, 0.03, 0.05, 0.06, 0.09, 0.1, 0.12, 0.15, 0.2, 0.3];

function randomValue(rng: Random, c: EditCell): number {
    switch (c.col) {
        case 'E': return c.excelRow === 158   // ROUNDUP row: fractional quantities
            ? rng.step(0, 6, 0.05)
            : rng.chance(0.15) ? 0 : rng.chance(0.5) ? rng.int(1, 30) : rng.step(0, 60, 0.25);
        case 'G': return rng.chance(0.7) ? rng.pick(WASTES) : rng.step(0, 0.35, 0.01);
        case 'I':
        case 'K':
            if (rng.chance(0.1)) return 0;
            return c.base > 0 ? Number((c.base * rng.step(0.1, 3, 0.05)).toFixed(2)) : rng.step(0, 5000, 5);
    }
}

function randomEdits(seed: number, cells: EditCell[]): Edits {
    const rng = seededRandom(seed);
    const p: Record<EditCol, number> = { E: 0.5, G: 0.25, I: 0.25, K: 0.25 };
    return cells.filter(c => rng.chance(p[c.col])).map(c => [c, randomValue(rng, c)] as const);
}

const at = (cells: EditCell[], col: EditCol, row: number): EditCell => {
    const c = cells.find(x => x.col === col && x.excelRow === row);
    if (!c) throw new Error(`${col}${row} is not an editable BOQ cell`);
    return c;
};
const allOf = (cells: EditCell[], col: EditCol, v: (c: EditCell) => number): Edits => cells.filter(c => c.col === col).map(c => [c, v(c)] as const);

interface CaseSpec {
    edits: (cells: EditCell[]) => Edits;
    /** Calculator inputs changed on both sides (Excel cells + app input). */
    calculators?: { excel: Record<string, OracleInput>; app: Record<string, unknown> };
}

/** Clears the roof-beam, roof-slab and stair tables (→ no concrete on BOQ R124/R134/R145). */
function emptyStructureCalculators(): NonNullable<CaseSpec['calculators']> {
    const excel: Record<string, OracleInput> = {};
    const clear = (sheet: string, rows: [number, number], cols: string[]) => {
        for (let r = rows[0]; r <= rows[1]; r++) for (const c of cols) excel[`${sheet}!${c}${r}`] = null;
    };
    clear('คานดาดฟ้า_RoofBeam', [8, 21], ['B', 'C', 'D', 'E', 'G', 'H', 'L', 'M']);
    clear('พื้นดาดฟ้า_RoofSlab', [8, 24], ['B', 'C', 'D', 'E', 'G', 'H', 'I']);
    clear('บันได_Stair', [8, 17], ['B', 'C', 'D', 'E', 'F', 'H', 'I', 'J', 'L', 'M', 'Q', 'R', 'V', 'W', 'AA', 'AB']);
    return { excel, app: { 'roof-beam': { rows: [] }, 'roof-slab': { rows: [] }, stair: { rows: [] } } };
}

const RANDOM_SEEDS = Array.from({ length: 50 }, (_, k) => 20_261_100 + k);
const CASES: [string, CaseSpec][] = [
    ['Excel sample (no edits)', { edits: () => [] }],
    ['every typed quantity 0', { edits: cells => allOf(cells, 'E', () => 0) }],
    ['every waste 0', { edits: cells => allOf(cells, 'G', () => 0) }],
    ['every waste 35 %', { edits: cells => allOf(cells, 'G', () => 0.35) }],
    ['every price doubled (consumables % and ×2 rows follow)', { edits: cells => [...allOf(cells, 'I', c => 2 * c.base), ...allOf(cells, 'K', c => 2 * c.base)] }],
    ['ROUNDUP: 10 × 1.1 = 11.000000000000002 → 11 (R158)', { edits: cells => [[at(cells, 'E', 158), 10], [at(cells, 'G', 158), 0.1]] }],
    ['ROUNDUP: 0.25 × 1.2 = 0.3 → 1 (R158)', { edits: cells => [[at(cells, 'E', 158), 0.25], [at(cells, 'G', 158), 0.2]] }],
    ['ROUNDUP: calc rows at 34.1 / 14.3 … with waste 0.07', { edits: cells => cells.filter(c => c.col === 'G' && c.excelRow >= 152 && c.excelRow <= 176).map(c => [c, 0.07] as const) }],
    ['labour on gross qty (pipes, cables, door frames, tie wire)', {
        edits: cells => [84, 85, 86, 185, 191, 193, 194, 195, 213, 214, 45, 118].flatMap(r => [
            [at(cells, 'K', r), 75] as const, ...cells.filter(c => c.col === 'G' && c.excelRow === r).map(c => [c, 0.2] as const),
        ]),
    }],
    ['D1 short range: demolition R12 typed (J14/L14/M14 skip R12)', { edits: cells => [[at(cells, 'E', 12), 1], [at(cells, 'I', 12), 12_000], [at(cells, 'K', 12), 3_000]] }],
    ['D1 short range: aluminium labour (L243 skips L234:L235)', { edits: cells => [[at(cells, 'K', 234), 500], [at(cells, 'K', 235), 300], [at(cells, 'K', 236), 200]] }],
    ['D1: no roof beam, roof slab or stair — Excel still orders 1 m³ on R134/R145', { edits: cells => randomEdits(77, cells), calculators: emptyStructureCalculators() }],
    ['D1: empty structure calculators, no edits', { edits: () => [], calculators: emptyStructureCalculators() }],
    ...RANDOM_SEEDS.map((seed, k): [string, CaseSpec] => [`random #${k} (seed ${seed})`, { edits: cells => randomEdits(seed, cells) }]),
];

// ─── Pins: calculator decisions set to Excel's value, as if typed on the BOQ page ──
interface Pin { key: string; field: keyof BoqLineOverride; ref: string; decision: string }

function pinsFor(baseline: MappedRow[]): Pin[] {
    const pins: Pin[] = [
        { key: 'R16', field: 'mat', ref: ref('I', 16), decision: 'D3: น้ำไฟชั่วคราว links C30 (6,469) where Excel I16 is typed 6,500' },
        { key: 'R121', field: 'qty', ref: ref('E', 121), decision: 'D1: roof-beam formwork 2·D·E + C·E (Excel 2·D·E + C)' },
        { key: 'R218', field: 'qty', ref: ref('E', 218), decision: 'D1: บัว 0.3 / 0.1 SUMIF criteria swapped in Excel' },
        { key: 'R219', field: 'qty', ref: ref('E', 219), decision: 'D1: บัว 0.3 / 0.1 SUMIF criteria swapped in Excel' },
    ];
    for (const m of baseline) {
        if (m.row.key.startsWith('roof-beam:rebar:') && isRebarSize(m.row.key.split(':')[2] ?? '')) {
            pins.push({ key: m.row.key, field: 'waste', ref: ref('G', m.excelRow), decision: 'D1: roof-beam rebar waste per size (Excel G116/G117 swapped)' });
        }
    }
    return pins;
}

function runCase(oracle: ExcelOracle, cells: EditCell[], spec: CaseSpec, opts: { pins: boolean } = { pins: true }): { res: ProjectResult; edits: Edits } {
    const edits = spec.edits(cells);
    oracle.replaceInputs({ ...spec.calculators?.excel, ...Object.fromEntries(edits.map(([c, v]) => [ref(c.col, c.excelRow), v])) });
    const project = createProject();
    Object.assign(project.calculators, spec.calculators?.app ?? {});
    const overrides: Record<string, BoqLineOverride> = {};
    for (const [c, v] of edits) overrides[c.key] = { ...overrides[c.key], [FIELD[c.col]]: v };
    if (opts.pins) {
        const first = mapRows(computeProject(project).boq);
        for (const pin of pinsFor(first)) {
            if (overrides[pin.key]?.[pin.field] !== undefined) continue;   // the user typed it: same value on both sides
            overrides[pin.key] = { ...overrides[pin.key], [pin.field]: oracle.num(pin.ref) };
        }
    }
    project.boqOverrides = overrides;
    return { res: computeProject(project), edits };
}

// ─── Subtotals and M310 ─────────────────────────────────────────────────────
interface Subtotal { section: number; row: number; included: Record<'J' | 'L' | 'M', Set<number>> }

/** Rows a `=SUM(J88:J94)` / `=sum(J148:J149)` / `=SUM(J9)` formula adds up. */
function sumRows(formula: string | undefined, col: string): Set<number> {
    expect(formula, `subtotal ${col}`).toMatch(/^SUM\(/i);
    const rows = new Set<number>();
    for (const m of (formula ?? '').matchAll(/\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?/g)) {
        expect([m[1], m[3] ?? m[1]], formula).toEqual([col, col]);
        const a = Number(m[2]);
        const b = Number(m[4] ?? m[2]);
        for (let r = a; r <= b; r++) rows.add(r);
    }
    return rows;
}

function findSubtotals(oracle: ExcelOracle): Subtotal[] {
    const out: Subtotal[] = [];
    let section: number | undefined;
    for (let r = 5; r <= 320; r++) {
        const b = oracle.get(ref('B', r));
        if (typeof b === 'number') section = b;
        if (oracle.get(ref('D', r)) === 'รวม >>' && section !== undefined) {
            out.push({
                section, row: r,
                included: { J: sumRows(oracle.formula(ref('J', r)), 'J'), L: sumRows(oracle.formula(ref('L', r)), 'L'), M: sumRows(oracle.formula(ref('M', r)), 'M') },
            });
            section = undefined;
        }
    }
    return out;
}

/** D1: the subtotal ranges that leave rows of their section out (section:col → Excel rows left out). */
const DOCUMENTED_SHORT_RANGES: Record<string, number[]> = {
    '1:J': [12], '1:L': [12], '1:M': [12],
    '9:J': [84, 85, 86, 87], '9:L': [84, 85, 86, 87],
    '21:J': [213, 214, 215], '21:L': [213, 214, 215],
    '24:L': [234, 235],
};

const SUB_COLS = [['J', 'matTotal'], ['L', 'labTotal'], ['M', 'total']] as const;

describe('BOQ (Home) vs Excel formulas, driven by BOQ-page edits (oracle)', () => {
    let oracle: ExcelOracle;
    let baseline: MappedRow[];
    let cells: EditCell[];
    let subtotals: Subtotal[];

    beforeAll(async () => {
        oracle = await loadV5Oracle();
        oracle.reset();
        baseline = mapRows(computeProject(createProject()).boq);
        cells = editableCells(oracle, baseline);
        subtotals = findSubtotals(oracle);
    }, 120_000);

    it('nothing is frozen: every BOQ formula and M310 are evaluated live', () => {
        expect(oracle.fallbacks).toEqual([]);
        expect(oracle.frozenPrecedents(ref('M', 310))).toEqual([]);
        expect(oracle.frozenPrecedents(ref('M', 10))).toEqual([]);
    });

    it('the app has one row per Excel item row, and the slots fill exactly Excel\'s rows at the sample', () => {
        const excelItemRows = [...TEMPLATE_ROWS.keys()].sort((a, b) => a - b);
        expect(baseline.map(m => m.excelRow).sort((a, b) => a - b)).toEqual(excelItemRows);
        expect(unusedSlotRows(baseline)).toEqual([]);
        expect(subtotals.map(s => s.section)).toEqual(Array.from({ length: 32 }, (_, i) => i));
    });

    it('the template rules are the Excel formulas of each row (qty kind, gross rule, price rule, J/L basis)', () => {
        const seen = new Set<string>();
        for (const [r, t] of TEMPLATE_ROWS) {
            const f = (col: string) => oracle.formula(ref(col, r));
            const e = f('E');
            const qtyKind = e === undefined ? (oracle.get(ref('E', r)) === null ? 'none' : 'input')
                : /^E\d+$|^[\d.]+\*E\d+$|^E\d+\*[\d.]+$/.test(e) ? 'line' : /^SUM\(E\d+:E\d+\)$/.test(e) ? 'sumLines' : 'calc';
            expect(t.qty.kind, `R${r} qty (=${e ?? ''})`).toBe(qtyKind);
            const h = f('H') ?? '';
            const gross = h === '' ? 'none' : h.startsWith('MAX(1,CEILING(') ? 'concrete' : h.startsWith('ROUNDUP(') ? 'ceilInt'
                : h.endsWith('*0.03') ? 'tieWire' : h === `E${r}*(100%+G${r})` ? 'std' : `?${h}`;
            expect(typeof t.gross === 'object' ? 'tieWire' : t.gross, `R${r} gross (=${h})`).toBe(gross);
            expect(t.materialBasis, `R${r} J`).toBe(f('J') === `I${r}*E${r}` ? 'net' : 'gross');
            expect(f('J'), `R${r} J`).toMatch(new RegExp(`^I${r}\\*[EH]${r}$`));
            expect(t.labourBasis, `R${r} L`).toBe(f('L') === `K${r}*H${r}` ? 'gross' : 'net');
            expect(f('L'), `R${r} L`).toMatch(new RegExp(`^K${r}\\*[EH]${r}$`));
            for (const [col, rule] of [['I', t.mat], ['K', t.lab]] as const) {
                const pf = f(col);
                const kind = typeof rule === 'number' ? 'number' : rule.kind;
                expect(kind, `R${r} ${col} (=${pf ?? ''})`).toBe(!readsCells(pf) ? 'number' : /^SUM\(.*\)\*\d+%$/.test(pf ?? '') ? 'consumables' : 'linePrice');
                seen.add(`price:${kind}`);
            }
            seen.add(`qty:${qtyKind}`);
            seen.add(`gross:${gross}`);
            seen.add(`labour:${t.labourBasis}`);
            seen.add(`material:${t.materialBasis}`);
        }
        expect([...seen].sort()).toEqual([
            'gross:ceilInt', 'gross:concrete', 'gross:none', 'gross:std', 'gross:tieWire', 'labour:gross', 'labour:net',
            'material:gross', 'material:net', 'price:consumables', 'price:linePrice', 'price:number',
            'qty:calc', 'qty:input', 'qty:line', 'qty:none', 'qty:sumLines',
        ]);
    });

    it('the pins are exactly the documented calculator decisions (KNOWN_DELTAS: section 2 −31, 12 +4,191.90522, 22 +684)', () => {
        const { res } = runCase(oracle, cells, { edits: () => [] }, { pins: false });
        const row = (key: string) => res.boq.sections.flatMap(s => s.rows).find((r): r is BoqItemRow => r.type === 'item' && r.key === key);
        // D3: R16 material from the temp-utilities calculator instead of the retyped 6,500
        expect(oracle.num(ref('I', 16))).toBe(6500);
        expectClose(row('R16')?.matUnit, res.calcOutputs['temp-utilities']?.total ?? NaN, 'R16 I = temp-utilities total');
        expectClose((row('R16')?.matUnit ?? NaN) - oracle.num(ref('I', 16)), -31, 'R16 I delta');
        // D1: roof-beam formwork Σ(2·D·E + C·E) instead of Σ(2·D·E + C)
        const beam = roofBeamTotals(roofBeam.defaults());
        expectClose(oracle.num(ref('E', 121)), beam.formworkExcel, 'E121 = Excel T6');
        expectClose((row('R121')?.qty ?? NaN) - oracle.num(ref('E', 121)), beam.formwork - beam.formworkExcel, 'R121 E delta');
        // D1: moulding quantities swapped back
        expectClose(row('R218')?.qty, oracle.num(ref('E', 219)), 'app R218 = Excel E219');
        expectClose(row('R219')?.qty, oracle.num(ref('E', 218)), 'app R219 = Excel E218');
        // D1: roof-beam rebar waste per size; Excel's slot rows are swapped
        expect([oracle.get(ref('D', 116)), oracle.num(ref('G', 116)), oracle.get(ref('D', 117)), oracle.num(ref('G', 117))])
            .toEqual(['- เหล็ก RB6', 0.12, '- เหล็ก DB12', 0.06]);
        expect([row('roof-beam:rebar:RB6')?.waste, row('roof-beam:rebar:DB12')?.waste]).toEqual([REBAR_WASTE.RB6, REBAR_WASTE.DB12]);
        // … and nothing else differs: per section, app − Excel = KNOWN_DELTAS
        const known: Record<number, number> = { 2: -31, 12: 4191.90522, 22: 684 };
        for (const st of subtotals) {
            const s = res.boq.sections.find(x => x.no === st.section);
            expectClose((s?.total ?? NaN) - oracle.num(ref('M', st.row)), known[st.section] ?? 0, `section ${st.section} M${st.row}`);
        }
    });

    it('the subtotal ranges that skip rows are exactly the documented D1 short ranges; M310 leaves out section 0 (D2)', () => {
        const short: Record<string, number[]> = {};
        for (const st of subtotals) {
            const rows = baseline.filter(m => m.section === st.section).map(m => m.excelRow);
            for (const col of ['J', 'L', 'M'] as const) {
                const left = rows.filter(r => !st.included[col].has(r)).sort((a, b) => a - b);
                if (left.length) short[`${st.section}:${col}`] = left;
            }
        }
        expect(short).toEqual(DOCUMENTED_SHORT_RANGES);
        const terms = [...(oracle.formula(ref('M', 310)) ?? '').matchAll(/M(\d+)/g)].map(m => Number(m[1]));
        expect(terms.sort((a, b) => a - b)).toEqual(subtotals.filter(s => s.section !== 0).map(s => s.row));
        expect(BOQ_TEMPLATE_V5.filter(s => !s.inConstructionTotal).map(s => s.no)).toEqual([0]);
    });

    it('the cases cover every edit kind, rounding rule, price rule, gross-labour row, short range and the D1 concrete branch', () => {
        const all = CASES.map(([, spec]) => spec.edits(cells));
        const edited = (p: (c: EditCell, v: number) => boolean) => all.filter(e => e.some(([c, v]) => p(c, v))).length;
        const tpl = (c: EditCell) => TEMPLATE_ROWS.get(c.excelRow);
        const grossOf = (c: EditCell) => { const g = tpl(c)?.gross; return typeof g === 'object' ? 'tieWire' : g; };
        const randomOnly = all.slice(CASES.length - RANDOM_SEEDS.length);
        expect(randomOnly.every(e => e.length > 50)).toBe(true);
        for (const col of ['E', 'G', 'I', 'K'] as const) expect(edited(c => c.col === col), col).toBeGreaterThan(40);
        for (const g of ['std', 'ceilInt', 'concrete']) expect(edited((c, v) => c.col === 'G' && grossOf(c) === g && v > 0), `G on ${g}`).toBeGreaterThan(20);
        expect(edited(c => c.col === 'E' && grossOf(c) === 'ceilInt'), 'typed E on the ROUNDUP row').toBeGreaterThan(20);
        expect(edited(c => c.col === 'G' && c.key.includes(':rebar:')), 'rebar waste (tie wire follows)').toBeGreaterThan(20);
        expect(edited(c => c.col === 'K' && c.key.endsWith(':tie-wire')), 'tie-wire labour (K·H)').toBeGreaterThan(5);
        expect(edited(c => c.col === 'K' && tpl(c)?.labourBasis === 'gross' && !c.key.includes(':')), 'labour on gross rows').toBeGreaterThan(20);
        expect(edited(c => c.col === 'E' && c.excelRow === 35), 'R35 → R39 (line qty)').toBeGreaterThan(20);
        expect(edited(c => c.excelRow === 183), 'R183 (sumLines)').toBeGreaterThan(10);
        expect(edited(c => ['I', 'K'].includes(c.col) && (c.excelRow === 179 || c.excelRow === 181)), 'linePrice ×2 sources').toBeGreaterThan(10);
        for (const r of [84, 185, 193, 213]) expect(edited(c => ['I', 'K', 'G'].includes(c.col) && c.excelRow === r), `consumables source R${r}`).toBeGreaterThan(10);
        for (const r of [87, 186, 196, 215]) expect(edited(c => c.col === 'E' && c.excelRow === r), `consumables row E${r}`).toBeGreaterThan(10);
        expect(edited((c, v) => c.excelRow === 12 && c.col === 'E' && v > 0), 'R12 typed (section 1 short range)').toBeGreaterThan(10);
        expect(edited((c, v) => c.col === 'K' && (c.excelRow === 234 || c.excelRow === 235) && v > 0), 'K234/K235 (L243 short range)').toBeGreaterThan(5);
        expect(edited(c => c.section === 0), 'section 0').toBeGreaterThan(10);
        expect(CASES.filter(([, s]) => s.calculators).length).toBeGreaterThan(0);
        // MAX(1, CEILING(…)) with 0 < E·(1+G) < 1 (R65 = 0.63 m³; waste is edited up to 35 %)
        oracle.reset();
        expect(TEMPLATE_ROWS.get(65)?.gross).toBe('concrete');
        expect(oracle.num(ref('E', 65)) * 1.35).toBeLessThan(1);
    });

    it.each(CASES)('%s', (_name, spec) => {
        const { res } = runCase(oracle, cells, spec);
        const mapped = mapRows(res.boq);
        const rowDelta = new Map<number, Record<'J' | 'L' | 'M', number>>();

        // 1. every app row: E H I J K L M (H of a row without H = blank = 0)
        for (const { row, excelRow } of mapped) {
            const label = `R${excelRow} (${row.key})`;
            const h = oracle.formula(ref('H', excelRow)) ?? '';
            if (h.startsWith('MAX(1,CEILING(') && oracle.num(ref('E', excelRow)) <= 0) {
                // D1 (engine.ts): no concrete stays 0 in the app; Excel orders MAX(1, CEILING(0, 0.25)) = 1 m³
                const I = oracle.num(ref('I', excelRow));
                expect(oracle.num(ref('H', excelRow)), `${label} Excel H`).toBe(1);
                expect(row.grossQty, `${label} app H`).toBe(0);
                for (const col of ['E', 'I', 'K', 'L'] as const) expectClose(appValue(row, col), oracle.num(ref(col, excelRow)), `${label} ${col}`);
                expectClose(row.matTotal - oracle.num(ref('J', excelRow)), -I, `${label} J delta = −1 m³ × I`);
                expectClose(row.total - oracle.num(ref('M', excelRow)), -I, `${label} M delta = −1 m³ × I`);
                rowDelta.set(excelRow, { J: -I, L: 0, M: -I });
                continue;
            }
            for (const col of COMPARED) expectClose(appValue(row, col), oracle.num(ref(col, excelRow)), `${label} ${col}${excelRow}`);
        }
        // Excel slot rows the app has no row for (D5: the app only lists bar sizes that exist) are empty in Excel
        for (const r of unusedSlotRows(mapped)) for (const col of ['E', 'H', 'J', 'L', 'M']) expect(oracle.num(ref(col, r)), `unused slot ${col}${r}`).toBe(0);

        // 2. section subtotals: app − Excel = rows Excel's SUM range leaves out (D1) + D1 concrete row deltas
        const expectedSectionDelta = new Map<number, number>();
        for (const st of subtotals) {
            const s = res.boq.sections.find(x => x.no === st.section);
            const rows = mapped.filter(m => m.section === st.section);
            for (const [col, field] of SUB_COLS) {
                const left = rows.filter(m => !st.included[col].has(m.excelRow));
                const expected = left.reduce((sum, m) => sum + m.row[field], 0)
                    + rows.reduce((sum, m) => sum + (rowDelta.get(m.excelRow)?.[col] ?? 0), 0);
                expectClose((s?.[field] ?? NaN) - oracle.num(ref(col, st.row)), expected, `section ${st.section} ${col}${st.row}`);
                if (col === 'M') expectedSectionDelta.set(st.section, expected);
            }
        }

        // 3. M310 = Σ M subtotals of sections 1–31; section 0 is the app's preConstructionTotal (D2)
        const totalDelta = [...expectedSectionDelta].filter(([no]) => no !== 0).reduce((sum, [, d]) => sum + d, 0);
        expectClose(res.boq.constructionTotal - oracle.num(ref('M', 310)), totalDelta, 'M310');
        expectClose(res.boq.preConstructionTotal, oracle.num(ref('M', 10)) + (expectedSectionDelta.get(0) ?? NaN), 'section 0 (M10) outside M310');
        if (closeTo(totalDelta, 0)) expectClose(res.boq.constructionTotal, oracle.num(ref('M', 310)), 'M310 exact');
    });

    it('D1 concrete: with the roof slab and stair empty, Excel orders 1 m³ each (R134, R145) and the app 0', () => {
        const { res } = runCase(oracle, cells, { edits: () => [], calculators: emptyStructureCalculators() });
        const row = (key: string) => res.boq.sections.flatMap(s => s.rows).find((r): r is BoqItemRow => r.type === 'item' && r.key === key);
        for (const r of [134, 145]) {
            expect([oracle.num(ref('E', r)), oracle.num(ref('H', r))], `Excel E/H${r}`).toEqual([0, 1]);
            expect([row(`R${r}`)?.qty, row(`R${r}`)?.grossQty], `app E/H${r}`).toEqual([0, 0]);
        }
        // R124 (roof-beam concrete) is plain E·(1+G) in Excel: 0 on both sides
        expect([oracle.num(ref('H', 124)), row('R124')?.grossQty]).toEqual([0, 0]);
        expectClose(res.boq.constructionTotal - oracle.num(ref('M', 310)), -(oracle.num(ref('I', 134)) + oracle.num(ref('I', 145))), 'M310 delta = −(I134 + I145)');
        oracle.reset();
    });
});
