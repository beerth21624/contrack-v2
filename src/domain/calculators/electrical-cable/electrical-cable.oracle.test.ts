// Differential test: electrical-cable compute() + BOQ section 18 rows 193–196 vs the real Excel v5 formulas (evaluated
// by the oracle) on ~50 seeded random circuit tables + wire settings and named edge cases. The cable sheet reads its
// lengths from the conduit sheet, so both are driven: circuits → sheet 08 rows 6–29, wire settings → sheet 09 D/E/F of
// the same row (the app keeps one circuit list, keyed by id — spec 05 D4). Guide: docs/rebuild/ORACLE_TESTS.md.
//
// Excel links cable G/H to the conduit sheet on rows 6–19 only (rows 20–28 are empty, and there is no row 29), so
// I4:L4 count the first 14 circuits. The app counts every circuit (index.ts compute: "Excel links G/H on rows 6–19
// only — D6"). That is the only delta, asserted exactly from first principles:
// Δ(size) = Σ over circuits 15–24 of IF(D=size, (E+G)·F) + IF(E=size, (F+H)·F).
// THW 6 (L4) has no BOQ row in Excel or in the app (spec 05 D7); a run with no size / conductor count is counted in no
// column on both sides and is reported by the app as `unassigned` (spec 05 D8).
import { beforeAll, describe, expect, it } from 'vitest';
import { loadV5Oracle, type ExcelOracle, type OracleInput } from '../../../test-utils/excel-oracle';
import { boqItem, expectBoqRow, expectClose, seededRandom, type Random } from '../../../test-utils/oracle-helpers';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { BREAKER_SIZES, electricalPipe, type Circuit, type ElectricalPipeInput } from '../electrical-pipe';
import {
    WIRE_BUCKETS, WIRE_SIZES, cableRows, electricalCable, sizeKey, type CircuitWiring, type ElectricalCableInput, type WireSize,
} from '.';

const PIPE = 'ท่อร้อยสายไฟ_Electrical Pipe';
const SHEET = 'สายไฟ_Electrical Cable';
const BOQ = 'BOQ (Home)';
const FIRST_ROW = 6;
/** Conduit rows 6–29, cable rows 6–28; only rows 6–19 are linked. */
const PIPE_ROWS = 24;
const CABLE_ROWS = 23;
const LINKED_ROWS = 14;
const pipeAt = (col: string, i: number) => `${PIPE}!${col}${FIRST_ROW + i}`;
const at = (col: string, i: number) => `${SHEET}!${col}${FIRST_ROW + i}`;

interface Case { pipe: ElectricalPipeInput; cable: ElectricalCableInput }

// ─── Input mapping ──────────────────────────────────────────────────────────
const PIPE_COLUMNS: readonly [keyof Circuit, string][] = [
    ['name', 'B'], ['breaker', 'C'], ['pipeType', 'D'], ['mainH', 'E'], ['deviceH', 'F'], ['mainV', 'G'], ['deviceV', 'H'],
];

function excelInputs({ pipe, cable }: Case): Record<string, OracleInput> {
    if (pipe.circuits.length > PIPE_ROWS) throw new Error(`Excel has ${PIPE_ROWS} conduit rows`);
    const out: Record<string, OracleInput> = {};
    const v = (x: string | number | undefined) => (x === undefined || x === '' ? null : x);
    for (let i = 0; i < PIPE_ROWS; i++) {
        const c = pipe.circuits[i];
        for (const [field, col] of PIPE_COLUMNS) out[pipeAt(col, i)] = v(c?.[field]);
        if (i >= CABLE_ROWS) continue;   // circuit 24 has no cable row (D6: never counted by Excel)
        const w = c ? cable.wiring[c.id] : undefined;
        out[at('B', i)] = v(c?.name);    // re-typed in Excel (not read by any formula)
        out[at('C', i)] = v(c?.breaker);
        out[at('D', i)] = v(w?.mainSize);
        out[at('E', i)] = v(w?.deviceSize);
        out[at('F', i)] = w && w.conductors !== 0 ? w.conductors : null;
    }
    return out;
}

// ─── First principles (the formula of row 6 applied to any circuit) ─────────
const wiringOf = (cable: ElectricalCableInput, c: Circuit): CircuitWiring =>
    cable.wiring[c.id] ?? { mainSize: '', deviceSize: '', conductors: 0 };
function bucket(c: Circuit, w: CircuitWiring, size: WireSize): number {
    const f = w.conductors;
    return (w.mainSize.trim() === size ? (c.mainH + c.mainV) * f : 0) + (w.deviceSize.trim() === size ? (c.deviceH + c.deviceV) * f : 0);
}
function unassignedOf(c: Circuit, w: CircuitWiring): number {
    const known = (s: string) => (WIRE_SIZES as readonly string[]).includes(s.trim());
    if (w.conductors === 0) return c.mainH + c.mainV + c.deviceH + c.deviceV;
    return (known(w.mainSize) ? 0 : c.mainH + c.mainV) + (known(w.deviceSize) ? 0 : c.deviceH + c.deviceV);
}
/** D6 delta per size: circuits past Excel row 19. */
const d6Delta = ({ pipe, cable }: Case, size: WireSize) =>
    pipe.circuits.slice(LINKED_ROWS).reduce((s, c) => s + bucket(c, wiringOf(cable, c), size), 0);

const SIZE_COLUMN: Record<WireSize, string> = Object.fromEntries(WIRE_BUCKETS.map(b => [b.size, b.column])) as Record<WireSize, string>;

// ─── Output mapping ─────────────────────────────────────────────────────────
const NOT_IN_EXCEL = new Set(['circuit.count']);   // = number of circuits (checked below)

function excelValueOf(key: string, o: ExcelOracle, input: Case): number | undefined {
    const size = WIRE_SIZES.find(s => key === sizeKey(s) || key === WIRE_BUCKETS.find(b => b.size === s)?.line);
    if (size) return o.num(`${SHEET}!${SIZE_COLUMN[size]}4`) + d6Delta(input, size);
    if (key === 'unassigned') {
        // no Excel cell (spec 05 D8): run length of linked rows 6–19 with no size or no conductor count, from
        // Excel's own G/H/D/E/F; past row 19 from first principles (D6)
        let s = 0;
        for (let i = 0; i < LINKED_ROWS; i++) {
            const text = (col: string) => { const t = o.get(at(col, i)); return typeof t === 'string' ? t : ''; };
            const w: CircuitWiring = { mainSize: text('D'), deviceSize: text('E'), conductors: o.num(at('F', i)) };
            const g = o.num(at('G', i));
            const h = o.num(at('H', i));
            s += unassignedOf({ id: '', name: '', breaker: '', pipeType: '', mainH: g, mainV: 0, deviceH: h, deviceV: 0 }, w);
        }
        return s + input.pipe.circuits.slice(LINKED_ROWS).reduce((t, c) => t + unassignedOf(c, wiringOf(input.cable, c)), 0);
    }
    return undefined;
}

// ─── Random but plausible circuits + wire settings ──────────────────────────
const SAMPLE: Case = { pipe: electricalPipe.defaults(), cable: electricalCable.defaults() };
const NAMES = SAMPLE.pipe.circuits.map(c => c.name);

function randomCircuit(rng: Random, id: string): Circuit {
    const kind = rng.pick(['light', 'socket', 'appliance', 'appliance'] as const);
    return {
        id,
        name: rng.chance(0.9) ? rng.pick(NAMES) : '',
        breaker: rng.chance(0.9) ? (kind === 'light' ? '16A.' : rng.pick(BREAKER_SIZES)) : '',
        pipeType: rng.chance(0.85) ? 'PVC 1/2"' : 'PVC 3/4"',
        mainH: rng.step(0, 30, 0.1),
        deviceH: kind === 'light' && rng.chance(0.6) ? rng.step(0, 30, 0.1) : 0,
        mainV: kind === 'appliance' ? rng.pick([3, 2.4, 1.8, 4.4]) : 1.5,
        deviceV: kind === 'appliance' ? (rng.chance(0.15) ? 2.3 : 0) : rng.int(0, 12) * (kind === 'light' ? 2.3 : 3.2),
    };
}

function randomWiring(rng: Random): CircuitWiring {
    const sizes = ['THW 1.5', 'THW 2.5', 'THW 2.5', 'THW 4', 'THW 4', 'THW 6'] as const;
    return {
        mainSize: rng.chance(0.88) ? rng.pick(sizes) : '',
        deviceSize: rng.chance(0.55) ? rng.pick(sizes) : '',
        conductors: rng.chance(0.92) ? rng.pick([2, 3]) : 0,
    };
}

function randomCase(seed: number): Case {
    const rng = seededRandom(seed);
    const r = rng.next();
    const n = r < 0.08 ? PIPE_ROWS : r < 0.28 ? rng.int(LINKED_ROWS + 1, PIPE_ROWS - 1) : r < 0.33 ? LINKED_ROWS : rng.int(1, LINKED_ROWS - 1);
    const circuits = Array.from({ length: n }, (_, i) => randomCircuit(rng, `c${i + 1}`));
    const wiring: Record<string, CircuitWiring> = {};
    for (const c of circuits) if (rng.chance(0.95)) wiring[c.id] = randomWiring(rng);
    return { pipe: { circuits }, cable: { wiring } };
}

const extra = (n: number, w: CircuitWiring): Case => {
    const circuits = Array.from({ length: n }, (_, i) => ({ ...(SAMPLE.pipe.circuits[i % LINKED_ROWS] ?? SAMPLE.pipe.circuits[0]), id: `c${i + 1}` } as Circuit));
    const wiring = Object.fromEntries(circuits.map((c, i) => [c.id, SAMPLE.cable.wiring[`c${(i % LINKED_ROWS) + 1}`] ?? w]));
    for (const c of circuits.slice(LINKED_ROWS)) wiring[c.id] = w;
    return { pipe: { circuits }, cable: { wiring } };
};
const mapWiring = (f: (w: CircuitWiring) => CircuitWiring): Case =>
    ({ pipe: SAMPLE.pipe, cable: { wiring: Object.fromEntries(Object.entries(SAMPLE.cable.wiring).map(([k, w]) => [k, f(w)])) } });

const CASES: [string, Case][] = [
    ['Excel sample', SAMPLE],
    ['no circuits', { pipe: { circuits: [] }, cable: { wiring: {} } }],
    ['every run THW 6 (L4, no BOQ row on either side — spec 05 D7)', mapWiring(w => ({ ...w, mainSize: 'THW 6', deviceSize: w.deviceSize ? 'THW 6' : '' }))],
    ['D8: device runs with no device cable size', mapWiring(w => ({ ...w, deviceSize: '' }))],
    ['no conductor count (F blank) on every row', mapWiring(w => ({ ...w, conductors: 0 }))],
    ['main and device run in the same size', mapWiring(w => ({ ...w, deviceSize: w.mainSize }))],
    ['no wire settings at all (circuits only)', { pipe: SAMPLE.pipe, cable: { wiring: {} } }],
    ['D6: 16 circuits, rows 20–21 wired', extra(16, { mainSize: 'THW 4', deviceSize: 'THW 2.5', conductors: 3 })],
    ['D6: full table, 24 circuits (the 24th has no cable row)', extra(PIPE_ROWS, { mainSize: 'THW 2.5', deviceSize: 'THW 1.5', conductors: 2 })],
    ...Array.from({ length: 50 }, (_, k): [string, Case] => [`random #${k} (seed ${19_300 + k})`, randomCase(19_300 + k)]),
];

function appResult({ pipe, cable }: Case): ProjectResult {
    const p = createProject();
    p.calculators['electrical-pipe'] = pipe;
    p.calculators['electrical-cable'] = cable;
    return computeProject(p);
}

describe('สายไฟ_Electrical Cable vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...['I4', 'J4', 'K4', 'L4', 'G6', 'H6', 'I6', 'L6', 'G19', 'H19', 'K19', 'I28', 'L28'].map(c => `${SHEET}!${c}`),
            ...[193, 194, 195, 196, 197].flatMap(r => ['E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('Excel links G/H to the conduit sheet on rows 6–19 only (the D6 rows have none)', () => {
        for (let i = 0; i < CABLE_ROWS; i++) {
            const g = oracle.formula(at('G', i));
            if (i < LINKED_ROWS) expect(g, at('G', i)).toBe(`'${PIPE}'!E${FIRST_ROW + i}+'${PIPE}'!G${FIRST_ROW + i}`);
            else expect(g, at('G', i)).toBeUndefined();
        }
    });

    it('the cases cover every branch (sizes, conductors, D6 / D7 / D8, full table)', () => {
        const seen = new Set<string>();
        for (const [, input] of CASES) {
            const n = input.pipe.circuits.length;
            seen.add(n === 0 ? 'none' : n <= LINKED_ROWS ? '1–14' : n < PIPE_ROWS ? '15–23 (D6)' : '24 (D6)');
            for (const c of input.pipe.circuits) {
                const w = input.cable.wiring[c.id];
                if (!w) { seen.add('no wiring entry'); continue; }
                seen.add(`main ${w.mainSize || 'blank'}`);
                seen.add(`device ${w.deviceSize || 'blank'}`);
                seen.add(`conductors ${w.conductors}`);
                if (w.mainSize !== '' && w.mainSize === w.deviceSize) seen.add('main = device size');
                if (unassignedOf(c, w) > 0) seen.add('unassigned run (D8)');
            }
        }
        expect([...seen].sort()).toEqual([
            '1–14', '15–23 (D6)', '24 (D6)', 'conductors 0', 'conductors 2', 'conductors 3', 'main = device size', 'none',
            'no wiring entry', 'unassigned run (D8)', ...['', ...WIRE_SIZES].flatMap(s => [`main ${s || 'blank'}`, `device ${s || 'blank'}`]),
        ].sort());
    });

    it.each(CASES)('%s', (_name, input) => {
        oracle.replaceInputs(excelInputs(input));
        const res = appResult(input);
        const out = res.calcOutputs['electrical-cable'] ?? {};
        const rows = cableRows(input.cable, { outputs: id => res.calcOutputs[id] });
        expect(rows.map(r => r.id)).toEqual(input.pipe.circuits.map(c => c.id));

        // 1. per circuit: G, H, I…L of the linked rows; past row 19 Excel's I…L stay 0 (D6) and the app applies
        //    the row-6 formula
        rows.forEach((r, i) => {
            const c = input.pipe.circuits[i];
            if (!c) return;
            const w = wiringOf(input.cable, c);
            if (i < LINKED_ROWS) {
                expectClose(r.main, oracle.num(at('G', i)), `G${FIRST_ROW + i}`);
                expectClose(r.device, oracle.num(at('H', i)), `H${FIRST_ROW + i}`);
                for (const b of WIRE_BUCKETS) expectClose(r.bySize[b.size], oracle.num(at(b.column, i)), `${b.column}${FIRST_ROW + i}`);
            } else {
                for (const b of WIRE_BUCKETS) {
                    if (i < CABLE_ROWS) expect(oracle.num(at(b.column, i)), `${b.column}${FIRST_ROW + i} (D6: no link)`).toBe(0);
                    expectClose(r.bySize[b.size], bucket(c, w, b.size), `circuit ${i + 1} ${b.size} (row-6 formula)`);
                }
            }
        });
        for (let i = rows.length; i < CABLE_ROWS; i++) {
            for (const b of WIRE_BUCKETS) expect(oracle.num(at(b.column, i)), `unused row ${FIRST_ROW + i}`).toBe(0);
        }

        // 2. every output of compute() (unmapped keys fail)
        for (const [key, v] of Object.entries(out)) {
            if (NOT_IN_EXCEL.has(key)) continue;
            const excel = excelValueOf(key, oracle, input);
            if (excel === undefined) expect.fail(`output ${key} has no Excel mapping — add it to excelValueOf or NOT_IN_EXCEL`);
            else expectClose(v, excel, `output ${key}`);
        }
        expect(out['circuit.count']).toBe(input.pipe.circuits.length);

        // 3. BOQ R193–R195 (labour on gross), R196 (15 % consumables), section 18 subtotal (J/L/M197)
        let dJ = 0;
        let dL = 0;
        for (const b of WIRE_BUCKETS) {
            if (!b.line) continue;
            const er = Number(b.line.slice(1));
            const d = d6Delta(input, b.size);
            if (d === 0) { expectBoqRow(oracle, res.boq, b.line, er); continue; }
            const g = oracle.num(`${BOQ}!G${er}`);
            const row = boqItem(res.boq, b.line);
            expectClose((row?.qty ?? NaN) - oracle.num(`${BOQ}!E${er}`), d, `E${er} − D6 delta`);
            expectClose(row?.grossQty ?? NaN, (row?.qty ?? NaN) * (1 + g), `H${er} = E × (1 + G)`);
            const dj = oracle.num(`${BOQ}!I${er}`) * d * (1 + g);
            const dl = oracle.num(`${BOQ}!K${er}`) * d * (1 + g);
            expectClose((row?.matTotal ?? NaN) - oracle.num(`${BOQ}!J${er}`), dj, `J${er} delta = I × Δ × (1+G)`);
            expectClose((row?.labTotal ?? NaN) - oracle.num(`${BOQ}!L${er}`), dl, `L${er} delta = K × Δ × (1+G)`);
            dJ += dj;
            dL += dl;
        }
        const dM196 = 0.15 * (dJ + dL);
        if (dM196 === 0) expectBoqRow(oracle, res.boq, 'R196', 196);
        else expectClose((boqItem(res.boq, 'R196')?.total ?? NaN) - oracle.num(`${BOQ}!M196`), dM196, 'M196 − 15 % of the D6 delta');
        const s18 = res.boq.sections.find(s => s.no === 18);
        expectClose((s18?.matTotal ?? NaN) - oracle.num(`${BOQ}!J197`), dJ + dM196, 'section 18 J197 − D6 delta');
        expectClose((s18?.labTotal ?? NaN) - oracle.num(`${BOQ}!L197`), dL, 'section 18 L197 − D6 delta');
        expectClose((s18?.total ?? NaN) - oracle.num(`${BOQ}!M197`), dJ + dL + dM196, 'section 18 M197 − D6 delta');
    });
});
