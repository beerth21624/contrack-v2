// Differential test: electrical-pipe compute() + BOQ section 17 rows 185–186 (and the cable sheet that reads the
// circuit lengths, BOQ section 18) vs the real Excel v5 formulas (evaluated by the oracle) on ~50 seeded random circuit
// tables + named edge cases. Guide: docs/rebuild/ORACLE_TESTS.md.
//
// Excel sheet 08 has 24 circuit rows (6–29) but the I = SUM(E:H) formula only on rows 6–19, so I4 = SUM(I6:I29) adds
// the first 14 circuits only (spec 05 D6). The app sums every circuit (index.ts compute: "Excel has no I formula on
// rows 20–29 — D1/D6"). That is the only delta, asserted exactly: Σ (E+F+G+H) of circuits 15–24.
// The cable sheet stays at its sample wiring on both sides: circuits get ids c1…cN, the ids the cable defaults key
// rows 6–19 by, so the app's wiring of circuit i is Excel's cable row 6 + i.
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle, type OracleInput } from '../../../test-utils/excel-oracle';
import { boqItem, expectBoqRow, expectClose, seededRandom, type Random } from '../../../test-utils/oracle-helpers';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { BREAKER_SIZES, PIPE_TYPES, circuitKey, electricalPipe, pipeTypeKey, type Circuit, type ElectricalPipeInput } from '.';

const SHEET = 'ท่อร้อยสายไฟ_Electrical Pipe';
const CABLE = 'สายไฟ_Electrical Cable';
const BOQ = 'BOQ (Home)';
/** Excel circuit rows 6–29; only rows 6–19 have the I formula (and a cable-sheet link). */
const FIRST_ROW = 6;
const EXCEL_ROWS = 24;
const SUMMED_ROWS = 14;
const at = (col: string, i: number) => `${SHEET}!${col}${FIRST_ROW + i}`;

// ─── Input mapping: Circuit field → yellow / dropdown column of the row ──────
const INPUT_COLUMNS: readonly [keyof Circuit, string][] = [
    ['name', 'B'], ['breaker', 'C'], ['pipeType', 'D'], ['mainH', 'E'], ['deviceH', 'F'], ['mainV', 'G'], ['deviceV', 'H'],
];

function excelInputs(input: ElectricalPipeInput): Record<string, OracleInput> {
    if (input.circuits.length > EXCEL_ROWS) throw new Error(`Excel has ${EXCEL_ROWS} circuit rows`);
    const out: Record<string, OracleInput> = {};
    for (let i = 0; i < EXCEL_ROWS; i++) {
        const c = input.circuits[i];
        for (const [field, col] of INPUT_COLUMNS) {
            const v = c?.[field];
            out[at(col, i)] = v === undefined || v === '' ? null : v;
        }
    }
    return out;
}

/** E + F + G + H of a circuit, from the input (first principles). */
const lengthOf = (c: Circuit) => c.mainH + c.deviceH + c.mainV + c.deviceV;
/** D6 delta: the circuits past Excel row 19, which I4 leaves out. */
const d6Delta = (input: ElectricalPipeInput) => input.circuits.slice(SUMMED_ROWS).reduce((s, c) => s + lengthOf(c), 0);

// ─── Output mapping ─────────────────────────────────────────────────────────
const NOT_IN_EXCEL = new Set(['circuit.count']);   // = number of circuits (checked below)

function excelValueOf(key: string, o: ExcelOracle, input: ElectricalPipeInput): number | undefined {
    const n = (ref: string) => o.num(ref);
    const ev = (f: string) => { const v = o.evaluate(f, SHEET); return typeof v === 'number' ? v : NaN; };
    if (key === 'total' || key === 'R185') return n(`${SHEET}!I4`) + d6Delta(input);
    const circuit = /^circuit\|(.+)\|(main|device|total)$/.exec(key);
    if (circuit?.[1] && circuit[2]) {
        const i = input.circuits.findIndex(c => c.id === circuit[1]);
        if (i < 0) return undefined;
        const r = FIRST_ROW + i;
        if (i < SUMMED_ROWS) {
            // I r; the cable sheet's G r = E + G and H r = F + H (its only link to this sheet)
            return n(circuit[2] === 'total' ? at('I', i) : `${CABLE}!${circuit[2] === 'main' ? 'G' : 'H'}${r}`);
        }
        // D6: rows 20–29 have neither the I formula nor a cable link — the formula Excel would need:
        return ev(circuit[2] === 'total' ? `=SUM(E${r}:H${r})` : circuit[2] === 'main' ? `=E${r}+G${r}` : `=F${r}+H${r}`);
    }
    const byType = /^pipe\|(.*)$/.exec(key);
    if (byType) {
        // no Excel cell (I4 sums every pipe type, spec 05 D3): Σ I of the rows of this D, SUM(E:H) past row 19 (D6)
        let s = 0;
        for (let i = 0; i < EXCEL_ROWS; i++) {
            const d = o.get(at('D', i));
            if ((typeof d === 'string' ? d.trim() : '') !== byType[1]) continue;
            s += i < SUMMED_ROWS ? n(at('I', i)) : ev(`=SUM(E${FIRST_ROW + i}:H${FIRST_ROW + i})`);
        }
        return s;
    }
    return undefined;
}

// ─── Random but plausible circuit tables ────────────────────────────────────
const SAMPLE = electricalPipe.defaults();
const NAMES = SAMPLE.circuits.map(c => c.name);
const withIds = (circuits: Omit<Circuit, 'id'>[]): ElectricalPipeInput =>
    ({ circuits: circuits.map((c, i) => ({ ...c, id: `c${i + 1}` })) });

function randomCircuit(rng: Random): Omit<Circuit, 'id'> {
    const kind = rng.pick(['light', 'socket', 'appliance', 'appliance'] as const);
    return {
        name: rng.chance(0.9) ? rng.pick(NAMES) : '',
        breaker: rng.chance(0.9) ? (kind === 'light' ? '16A.' : rng.pick(BREAKER_SIZES)) : '',
        pipeType: rng.chance(0.75) ? 'PVC 1/2"' : rng.chance(0.8) ? 'PVC 3/4"' : '',
        mainH: rng.step(0, 30, 0.1),
        deviceH: kind === 'light' && rng.chance(0.6) ? rng.step(0, 30, 0.1) : rng.chance(0.1) ? rng.step(0, 10, 0.1) : 0,
        mainV: kind === 'appliance' ? rng.pick([3, 2.4, 1.8, 4.4]) : rng.chance(0.9) ? 1.5 : 0,
        // H is typed as "points × drop" in Excel (=7*2.3): the same double
        deviceV: kind === 'appliance' ? 0 : rng.int(0, 12) * (kind === 'light' ? 2.3 : 3.2),
    };
}

function randomInput(seed: number): ElectricalPipeInput {
    const rng = seededRandom(seed);
    const r = rng.next();
    const n = r < 0.08 ? EXCEL_ROWS : r < 0.28 ? rng.int(SUMMED_ROWS + 1, EXCEL_ROWS - 1) : r < 0.33 ? SUMMED_ROWS : rng.int(1, SUMMED_ROWS - 1);
    return withIds(Array.from({ length: n }, () => randomCircuit(rng)));
}

const blankCircuit = { name: '', breaker: '', pipeType: '', mainH: 0, deviceH: 0, mainV: 0, deviceV: 0 };
const CASES: [string, ElectricalPipeInput][] = [
    ['Excel sample', SAMPLE],
    ['no circuits', { circuits: [] }],
    ['exactly 14 circuits (Excel rows 6–19, all summed)', randomInput(5_014)],
    ['D6: 15 circuits (sample + one on row 20, which Excel does not sum)', withIds([...SAMPLE.circuits, { ...blankCircuit, name: 'วงจร 15', breaker: '20A.', pipeType: 'PVC 1/2"', mainH: 9.5, mainV: 1.5, deviceV: 2 * 3.2 }])],
    ['D6: full table, 24 circuits', withIds(Array.from({ length: EXCEL_ROWS }, (_, i) => ({ ...SAMPLE.circuits[i % SUMMED_ROWS] ?? blankCircuit })))],
    ['every circuit PVC 3/4" (I4 sums every pipe type — spec 05 D3)', withIds(SAMPLE.circuits.map(c => ({ ...c, pipeType: 'PVC 3/4"' })))],
    ['blank circuit rows (like Excel rows 20–29)', withIds([blankCircuit, ...SAMPLE.circuits.slice(0, 3), blankCircuit])],
    ...Array.from({ length: 50 }, (_, k): [string, ElectricalPipeInput] => [`random #${k} (seed ${18_500 + k})`, randomInput(18_500 + k)]),
];

function appResult(input: ElectricalPipeInput): ProjectResult {
    const p = createProject();
    p.calculators['electrical-pipe'] = input;
    return computeProject(p);
}

describe('ท่อร้อยสายไฟ_Electrical Pipe vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            `${SHEET}!I4`, at('I', 0), at('I', SUMMED_ROWS - 1), `${CABLE}!G6`, `${CABLE}!H19`,
            ...['I4', 'J4', 'K4', 'L4'].map(c => `${CABLE}!${c}`),
            ...[185, 186, 187, 193, 194, 195, 196, 197].flatMap(r => ['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('Excel rows 20–29 have no I formula (the D6 rows)', () => {
        for (let i = SUMMED_ROWS; i < EXCEL_ROWS; i++) expect(oracle.formula(at('I', i)), at('I', i)).toBeUndefined();
        expect(oracle.formula(at('I', SUMMED_ROWS - 1))).toBe('SUM(E19:H19)');
    });

    it('the cases cover every branch (no / ≤14 / exactly 14 / >14 (D6) / 24 circuits, pipe types, breakers, device runs)', () => {
        const seen = new Set<string>();
        for (const [, input] of CASES) {
            const n = input.circuits.length;
            seen.add(n === 0 ? 'none' : n < SUMMED_ROWS ? '1–13' : n === SUMMED_ROWS ? '14' : n < EXCEL_ROWS ? '15–23 (D6)' : '24 (D6)');
            for (const c of input.circuits) {
                seen.add(`pipe ${c.pipeType || 'blank'}`);
                seen.add(`breaker ${c.breaker || 'blank'}`);
                if (c.deviceH > 0) seen.add('horizontal device run');
                if (lengthOf(c) === 0) seen.add('zero-length circuit');
                if (c.name === '') seen.add('blank name');
            }
        }
        expect([...seen].sort()).toEqual([
            '1–13', '14', '15–23 (D6)', '24 (D6)', 'blank name', 'breaker 16A.', 'breaker 20A.', 'breaker 32A.',
            'breaker 40A.', 'breaker blank', 'horizontal device run', 'none', ...PIPE_TYPES.map(t => `pipe ${t}`), 'pipe blank',
            'zero-length circuit',
        ].sort());
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.replaceInputs(excelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs['electrical-pipe'] ?? {};
        const d6 = d6Delta(input);

        // 1. per circuit (I / cable G / H, or the Excel formula they lack past row 19); unused rows 0 / blank
        for (const [key, v] of Object.entries(out)) {
            if (NOT_IN_EXCEL.has(key)) continue;
            const excel = excelValueOf(key, oracle, input);
            if (excel === undefined) expect.fail(`output ${key} has no Excel mapping — add it to excelValueOf or NOT_IN_EXCEL`);
            else expectClose(v, excel, `output ${key}`);
        }
        expect(out['circuit.count']).toBe(input.circuits.length);
        for (const c of input.circuits) expect(out[circuitKey(c.id, 'total')], c.id).toBeDefined();
        for (const c of input.circuits) expect(out[pipeTypeKey(c.pipeType)], c.pipeType).toBeDefined();
        for (let i = input.circuits.length; i < SUMMED_ROWS; i++) expect(oracle.num(at('I', i)), `unused row ${FIRST_ROW + i}`).toBe(0);

        // 2. BOQ R185 (E = I4, labour on gross), R186 (15 % consumables), section 17 subtotal (J/L/M187)
        if (d6 === 0) {
            for (const r of [185, 186]) expectBoqRow(oracle, res.boq, `R${r}`, r);
        } else {
            // D6: E185 − Excel = the circuits past row 19; same G / I / K as Excel.
            const g = oracle.num(`${BOQ}!G185`);
            const row = boqItem(res.boq, 'R185');
            expectClose((row?.qty ?? NaN) - oracle.num(`${BOQ}!E185`), d6, 'E185 − D6 delta');
            expectClose(row?.grossQty ?? NaN, (row?.qty ?? NaN) * (1 + g), 'H185 = E × (1 + G)');
            expectClose((row?.matTotal ?? NaN) - oracle.num(`${BOQ}!J185`), oracle.num(`${BOQ}!I185`) * d6 * (1 + g), 'J185 delta = I × Δ × (1+G)');
            expectClose((row?.labTotal ?? NaN) - oracle.num(`${BOQ}!L185`), oracle.num(`${BOQ}!K185`) * d6 * (1 + g), 'L185 delta = K × Δ × (1+G)');
        }
        const dJ185 = oracle.num(`${BOQ}!I185`) * d6 * (1 + oracle.num(`${BOQ}!G185`));
        const dL185 = oracle.num(`${BOQ}!K185`) * d6 * (1 + oracle.num(`${BOQ}!G185`));
        const dM186 = 0.15 * (dJ185 + dL185);
        expectClose((boqItem(res.boq, 'R186')?.total ?? NaN) - oracle.num(`${BOQ}!M186`), dM186, 'M186 − 15 % of the D6 delta');
        const s17 = res.boq.sections.find(s => s.no === 17);
        expectClose((s17?.matTotal ?? NaN) - oracle.num(`${BOQ}!J187`), dJ185 + dM186, 'section 17 J187 − D6 delta');
        expectClose((s17?.labTotal ?? NaN) - oracle.num(`${BOQ}!L187`), dL185, 'section 17 L187 − D6 delta');
        expectClose((s17?.total ?? NaN) - oracle.num(`${BOQ}!M187`), dJ185 + dL185 + dM186, 'section 17 M187 − D6 delta');

        // 3. the cable sheet follows the conduit lengths (sample wiring; circuits past row 19 have none on both sides)
        for (const r of [193, 194, 195, 196]) expectBoqRow(oracle, res.boq, `R${r}`, r);
        const s18 = res.boq.sections.find(s => s.no === 18);
        expectClose(s18?.matTotal, oracle.num(`${BOQ}!J197`), 'section 18 J197');
        expectClose(s18?.labTotal, oracle.num(`${BOQ}!L197`), 'section 18 L197');
        expectClose(s18?.total, oracle.num(`${BOQ}!M197`), 'section 18 M197');
    });
});
