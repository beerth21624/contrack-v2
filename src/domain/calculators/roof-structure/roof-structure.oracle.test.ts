// Differential test: roof-structure compute() + BOQ section 15 vs the real Excel v5 formulas (evaluated by the
// oracle) on ~50 seeded random roof frames. The Roofing sheet is driven too (plan area K5 + pitch K6 → slope area K7,
// which E14/E15 link to). Guide: docs/rebuild/ORACLE_TESTS.md.
import { beforeAll, describe, expect, it } from 'vitest';
import { isOracleError, loadV5Oracle, type ExcelOracle, type OracleCellInput } from '../../../test-utils/excel-oracle';
import { boqItem, expectBoqRow, expectClose, seededRandom, type Random } from '../../../test-utils/oracle-helpers';
import { ROOFING_SHEET, roofingExcelInputs } from '../../../test-utils/oracle-roof-walls';
import { computeProject, createProject, type ProjectResult } from '../../project';
import { roofing, type RoofingInput } from '../roofing';
import {
    DOUBLE_C_OPTIONS, ROOF_FACTOR_OPTIONS, partTotal, roofStructure,
    type AreaMember, type KingPostPart, type LengthMember, type RoofStructureInput,
} from '.';

const SHEET = 'โครงสร้างหลังคา Roof Structure';
const BOQ = 'BOQ (Home)';
const cell = (ref: string) => `${SHEET}!${ref}`;
/** ดั้ง sub-rows 7–11 (5 rows; the app's list is unlimited, D5). */
const PART_ROWS = [7, 8, 9, 10, 11];
/** BOQ (Home) section 15: R152–R157 = J5, J6, J12–J15; R158 งานทาสีกันสนิม (typed 1); R159 = E15. */
const BOQ_ROWS = [152, 153, 154, 155, 156, 157, 158, 159] as const;

interface Case { input: RoofStructureInput; roof: RoofingInput }

// ─── Input mapping ──────────────────────────────────────────────────────────
const sumFormula = (lengths: number[]): OracleCellInput => ({ formula: lengths.length === 0 ? null : `=${lengths.join('+')}` });

/** The cells a user would type: the member table (rows 5–15) and the Roofing size / pitch. */
function excelInputs({ input, roof }: Case): Record<string, OracleCellInput> {
    if (input.kingPosts.parts.length > PART_ROWS.length) throw new Error(`Excel has ${PART_ROWS.length} ดั้ง rows`);
    const out: Record<string, OracleCellInput> = { ...roofingExcelInputs(roof) };
    const length = (row: number, m: LengthMember) => {
        out[cell(`B${row}`)] = m.desc;
        out[cell(`C${row}`)] = m.c;
        out[cell(`G${row}`)] = sumFormula(m.lengths);   // G5 `=12.5+11+…`
        out[cell(`H${row}`)] = m.count;
    };
    length(5, input.wallPlate);
    out[cell('B6')] = input.kingPosts.desc;
    PART_ROWS.forEach((row, i) => {
        const p = input.kingPosts.parts[i];
        out[cell(`B${row}`)] = p?.desc ?? null;
        out[cell(`C${row}`)] = p?.c ?? null;
        out[cell(`G${row}`)] = p?.length ?? null;
        out[cell(`H${row}`)] = p?.count ?? null;
    });
    length(12, input.ridge);
    const v = input.valley;
    out[cell('B13')] = v.desc;
    out[cell('C13')] = v.c;
    out[cell('G13')] = { formula: `=(SQRT((${v.runA}^2)+(${v.runB}^2)))/COS(RADIANS(${v.deg}))` };   // the sample's typed formula
    out[cell('H13')] = v.count;
    const area = (row: number, m: AreaMember) => {
        out[cell(`B${row}`)] = m.desc;
        out[cell(`C${row}`)] = m.c;
        out[cell(`D${row}`)] = m.factor;
        // E14/E15 hold the link `='มุงหลังคา_Roofing'!K7`; a typed area replaces it
        out[cell(`E${row}`)] = { formula: m.area === null ? `='${ROOFING_SHEET}'!K7` : `=${m.area}` };
        out[cell(`F${row}`)] = m.spacing;
    };
    area(14, input.rafter);
    area(15, input.purlin);
    return out;
}

// ─── Output mapping ─────────────────────────────────────────────────────────
const DIRECT: Record<string, string> = {
    linkedSlopeArea: `${ROOFING_SHEET}!K7`,
    'wallPlate.length': cell('G5'), 'wallPlate.total': cell('I5'),
    'kingPosts.total': cell('I6'),
    'ridge.length': cell('G12'), 'ridge.total': cell('I12'),
    'valley.length': cell('G13'), 'valley.total': cell('I13'),
    'rafter.area': cell('E14'), 'rafter.total': cell('I14'),
    'purlin.area': cell('E15'), 'purlin.total': cell('I15'),
    R152: cell('J5'), R153: cell('J6'), R154: cell('J12'), R155: cell('J13'), R156: cell('J14'), R157: cell('J15'),
    R159: `${BOQ}!E159`,
};

/** The Excel value an output key stands for (undefined = unmapped: the test fails, so new outputs get mapped). */
function excelValueOf(key: string, o: ExcelOracle): number | undefined {
    const ref = DIRECT[key];
    if (ref) return o.num(ref);
    const part = /^kingPosts\.part\.(\d+)$/.exec(key);
    if (part?.[1]) {
        const row = PART_ROWS[Number(part[1])];
        return row === undefined ? undefined : o.num(cell(`I${row}`));
    }
    return undefined;
}

// ─── Random but plausible roof frames ───────────────────────────────────────
const lengths = (rng: Random, min: number, max: number) =>
    Array.from({ length: rng.chance(0.06) ? 0 : rng.int(min, max) }, () => rng.step(1, 13, 0.05));

function randomCase(seed: number): Case {
    const rng = seededRandom(seed);
    const roof: RoofingInput = { ...roofing.defaults(), planArea: rng.step(30, 320, 0.5), slopeDeg: rng.chance(0.05) ? 0 : rng.step(10, 45, 1) };
    const c = () => rng.pick(DOUBLE_C_OPTIONS);
    const part = (i: number): KingPostPart => ({ desc: `- ดั้ง-${i + 1}`, c: c(), length: rng.step(0.5, 3.6, 0.05), count: rng.int(rng.chance(0.05) ? 0 : 1, 8) });
    const areaMember = (desc: string, spacings: readonly number[]): AreaMember => ({
        desc, c: c(), factor: rng.pick(ROOF_FACTOR_OPTIONS),
        area: rng.chance(0.7) ? null : rng.step(rng.chance(0.1) ? 0 : 20, 320, 0.5),
        spacing: rng.pick(spacings),
    });
    return {
        roof,
        input: {
            wallPlate: { desc: rng.pick(['อะเส 2-C 150x50x20x3.2 มม. ', 'อะเส C 150x50x20x3.2 มม.']), c: c(), lengths: lengths(rng, 1, 14), count: rng.int(rng.chance(0.05) ? 0 : 1, 3) },
            kingPosts: { desc: 'ดั้ง 2-C 100x50x20x2.3 มม. ', parts: Array.from({ length: rng.pick([0, 1, 2, 3, 4, 5, 5]) }, (_, i) => part(i)) },
            ridge: { desc: 'อกไก่ 2-C 100x50x20x2.3 มม.', c: c(), lengths: lengths(rng, 1, 8), count: rng.int(1, 2) },
            valley: {
                desc: 'ตะเข้ราง C 100x50x20x2.3 มม.', c: c(), runA: rng.step(0, 5, 0.05), runB: rng.step(0, 5, 0.05),
                deg: rng.chance(0.5) ? roof.slopeDeg : rng.step(0, 50, 1), count: rng.int(0, 6),
            },
            rafter: areaMember('จันทัน C 100x50x20x2.3 มม.', [0.6, 0.8, 1, 1.2, 1.5]),
            purlin: areaMember('แปสำเร็จรูป GZ หนา 0.7 มม.', [0.3, 0.32, 0.34, 0.36, 0.4]),
        },
    };
}

const sample: Case = { input: roofStructure.defaults(), roof: roofing.defaults() };
const blank: Case = { input: roofStructure.blank?.() ?? sample.input, roof: roofing.blank?.() ?? sample.roof };
const CASES: [string, Case][] = [
    ['Excel sample', sample],
    ['blank project (roofing blank too: slope area 0)', blank],
    ['blank frame on the sample roof', { ...blank, roof: sample.roof }],
    ['typed rafter / purlin areas (E14/E15 not linked)', { ...sample, input: { ...sample.input, rafter: { ...sample.input.rafter, area: 120 }, purlin: { ...sample.input.purlin, area: 99.5 } } }],
    ['typed area 0 on the rafter row, valley at 0°', { ...sample, input: { ...sample.input, rafter: { ...sample.input.rafter, area: 0 }, valley: { ...sample.input.valley, deg: 0 } } }],
    ['single C everywhere, factor 1.00, pitch 25°', {
        roof: { ...sample.roof, slopeDeg: 25 },
        input: {
            ...sample.input,
            wallPlate: { ...sample.input.wallPlate, c: 1 }, ridge: { ...sample.input.ridge, c: 1 },
            kingPosts: { ...sample.input.kingPosts, parts: sample.input.kingPosts.parts.map(p => ({ ...p, c: 1 })) },
            rafter: { ...sample.input.rafter, factor: 1 }, purlin: { ...sample.input.purlin, factor: 1 },
        },
    }],
    ...Array.from({ length: 50 }, (_, k): [string, Case] => [`random #${k} (seed ${22_000 + k})`, randomCase(22_000 + k)]),
];

function appResult({ input, roof }: Case): ProjectResult {
    const p = createProject();
    p.calculators.roofing = roof;
    p.calculators['roof-structure'] = input;
    return computeProject(p);
}

describe('โครงสร้างหลังคา Roof Structure vs Excel formulas (oracle)', () => {
    let oracle: ExcelOracle;
    beforeAll(async () => { oracle = await loadV5Oracle(); }, 120_000);

    it('every compared Excel cell is evaluated live (no frozen fallback behind it)', () => {
        oracle.reset();
        const refs = [
            ...Object.values(DIRECT), ...PART_ROWS.map(r => cell(`I${r}`)),
            ...BOQ_ROWS.flatMap(r => ['D', 'E', 'H', 'J', 'L', 'M'].map(c => `${BOQ}!${c}${r}`)),
            `${BOQ}!J160`, `${BOQ}!L160`, `${BOQ}!M160`,
        ];
        for (const ref of refs) expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
    });

    it('the cases cover linked and typed areas, every ซีคู่ / factor / king-post count, zero counts and empty lengths', () => {
        const all = CASES.map(([, c]) => c.input);
        const has = (p: (i: RoofStructureInput) => boolean) => all.filter(p).length;
        const members = (i: RoofStructureInput) => [i.wallPlate, i.ridge, i.valley, i.rafter, i.purlin, ...i.kingPosts.parts];
        expect(has(i => i.rafter.area === null && i.purlin.area === null)).toBeGreaterThan(10);
        expect(has(i => i.rafter.area !== null || i.purlin.area !== null)).toBeGreaterThan(10);
        expect(has(i => i.rafter.area === 0 || i.purlin.area === 0)).toBeGreaterThan(0);
        for (const c of DOUBLE_C_OPTIONS) expect(has(i => members(i).some(m => m.c === c)), `C=${c}`).toBeGreaterThan(10);
        for (const f of ROOF_FACTOR_OPTIONS) expect(has(i => i.rafter.factor === f || i.purlin.factor === f), `D=${f}`).toBeGreaterThan(3);
        for (let n = 0; n <= PART_ROWS.length; n++) expect(has(i => i.kingPosts.parts.length === n), `${n} ดั้ง`).toBeGreaterThan(1);
        expect(has(i => i.wallPlate.lengths.length === 0 || i.ridge.lengths.length === 0)).toBeGreaterThan(2);
        expect(has(i => i.valley.count === 0 || i.wallPlate.count === 0)).toBeGreaterThan(2);
        expect(has(i => i.valley.deg === 0)).toBeGreaterThan(1);
        expect(CASES.filter(([, c]) => c.roof.slopeDeg === 0 || c.roof.planArea === 0).length).toBeGreaterThan(2);
    });

    it.each(CASES)('%s', (_name, c) => {
        oracle.replaceInputs(excelInputs(c));
        const res = appResult(c);
        const out = res.calcOutputs['roof-structure'] ?? {};

        // 1. every output of compute() (unmapped keys fail); the unused ดั้ง rows stay 0
        for (const [key, v] of Object.entries(out)) {
            const excel = excelValueOf(key, oracle);
            if (excel === undefined) expect.fail(`output ${key} has no Excel mapping — add it to excelValueOf`);
            else expectClose(v, excel, `output ${key}`);
        }
        c.input.kingPosts.parts.forEach((p, i) => expectClose(partTotal(p), oracle.num(cell(`I${PART_ROWS[i] ?? 0}`)), `I${PART_ROWS[i] ?? 0}`));
        for (const r of PART_ROWS.slice(c.input.kingPosts.parts.length)) expect(oracle.num(cell(`I${r}`)), `unused I${r}`).toBe(0);
        // cross-sheet: the linked slope area is Roofing K7 = the roofing output
        expectClose(out.linkedSlopeArea, res.calcOutputs.roofing?.slopeArea ?? NaN, 'linkedSlopeArea = roofing slopeArea');

        // 2. BOQ (Home) section 15: E, H (ROUNDUP), J, L, M of R152–R159, descriptions D152–D157 = B, subtotal row 160
        for (const r of BOQ_ROWS) expectBoqRow(oracle, res.boq, `R${r}`, r);
        for (const r of [152, 153, 154, 155, 156, 157]) expect(boqItem(res.boq, `R${r}`)?.desc, `D${r}`).toBe(oracle.get(`${BOQ}!D${r}`));
        const s15 = res.boq.sections.find(s => s.no === 15);
        expectClose(s15?.matTotal, oracle.num(`${BOQ}!J160`), 'section 15 J160');
        expectClose(s15?.labTotal, oracle.num(`${BOQ}!L160`), 'section 15 L160');
        expectClose(s15?.total, oracle.num(`${BOQ}!M160`), 'section 15 M160');
    });

    it('D1: no spacing on the rafter row — Excel I14 = (E14/0)·D·C is #DIV/0! (and so J14, BOQ R156, the section), the app 0', () => {
        // areaTotal(): "an empty spacing gives 0 (Excel: #DIV/0!)".
        const c: Case = { ...sample, input: { ...sample.input, rafter: { ...sample.input.rafter, spacing: 0 } } };
        oracle.replaceInputs(excelInputs(c));
        const res = appResult(c);
        const out = res.calcOutputs['roof-structure'] ?? {};
        for (const ref of [cell('I14'), cell('J14'), `${BOQ}!E156`, `${BOQ}!M156`, `${BOQ}!M160`]) {
            const v = oracle.get(ref);
            expect(isOracleError(v) && v.error, ref).toBe('#DIV/0!');
        }
        expect(out['rafter.total']).toBe(0);
        expect(out.R156).toBe(0);
        expect(boqItem(res.boq, 'R156')?.total).toBe(0);
        const others = BOQ_ROWS.filter(r => r !== 156);
        for (const r of others) expectBoqRow(oracle, res.boq, `R${r}`, r, 'D1 ÷0');
        expectClose(res.boq.sections.find(s => s.no === 15)?.total, others.reduce((s, r) => s + oracle.num(`${BOQ}!M${r}`), 0), 'app section 15 = Excel rows without R156');
    });

    it('D5: more than 5 ดั้ง rows — Excel I6 = SUM(I7:I11) has room for 5; the app counts every row', () => {
        const extra: KingPostPart[] = [{ desc: '- ดั้ง-6', c: 2, length: 2.2, count: 4 }, { desc: '- ดั้ง-7', c: 1, length: 1.35, count: 3 }];
        const c: Case = { ...sample, input: { ...sample.input, kingPosts: { ...sample.input.kingPosts, parts: [...sample.input.kingPosts.parts, ...extra] } } };
        // Excel holds the first five rows; the app the same five plus the extra ones
        oracle.replaceInputs(excelInputs({ ...c, input: sample.input }));
        const res = appResult(c);
        const out = res.calcOutputs['roof-structure'] ?? {};
        const extraTotal = extra.reduce((s, p) => s + partTotal(p), 0);
        expectClose((out['kingPosts.total'] ?? NaN) - oracle.num(cell('I6')), extraTotal, 'I6 delta = Σ extra rows');
        expectClose(out.R153, Math.ceil((oracle.num(cell('I6')) + extraTotal) / 6), 'J6 over every row');
        const row = boqItem(res.boq, 'R153');
        expectClose(row?.grossQty ?? NaN, Math.ceil((row?.qty ?? NaN) * (1 + oracle.num(`${BOQ}!G153`))), 'H153 = ROUNDUP(E×(1+G))');
        expectClose(row?.total, oracle.num(`${BOQ}!I153`) * (row?.grossQty ?? NaN), 'M153 = I×H');
        for (const r of BOQ_ROWS.filter(x => x !== 153)) expectBoqRow(oracle, res.boq, `R${r}`, r, 'D5');
        expectClose((res.boq.sections.find(s => s.no === 15)?.total ?? NaN) - oracle.num(`${BOQ}!M160`),
            (row?.total ?? NaN) - oracle.num(`${BOQ}!M153`), 'section 15 delta = R153 delta');
    });
});
