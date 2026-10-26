// Sheet "โครงสร้างหลังคา Roof Structure" (Excel v5 sheet 22) → BOQ (Home) section 15, rows 152–157 and 159.
// Spec: docs/excel-spec/03-roof-brick-plaster-doors.md §2.
// Counts 6 m steel sticks per roof member. The slope area of the area-based members (จันทัน, แป) comes from
// the Roofing sheet K7, like Excel's E14/E15 = 'มุงหลังคา_Roofing'!K7.
import { roundUp } from '../../boq/engine';
import { roofing, slopeArea } from '../roofing';
import { defineCalculator, type CalcContext } from '../types';

/** C ซีคู่ — Excel dropdown "1,2" (1 = single C, 2 = double C "2-C"). */
export const DOUBLE_C_OPTIONS = [1, 2] as const;
/** D Factor Roof — Excel dropdown "1.15,1.10,1.05,1.00". */
export const ROOF_FACTOR_OPTIONS = [1.15, 1.1, 1.05, 1] as const;
/** Stock length of one stick (Excel `ROUNDUP((I/6),0)`). */
export const STICK_LENGTH = 6;

/** A member counted by length: I = (H*G)*C. G is typed as a sum of plan segments (`=12.5+11+…`). */
export interface LengthMember {
    desc: string;        // B รายการ
    c: number;           // C ซีคู่
    lengths: number[];   // G ความยาว (ม.) = Σ segments
    count: number;       // H จำนวน (เส้น)
}

/** One sub-row of the ดั้ง group (Excel rows 7–11; unlimited here). I = (H*G)*C. */
export interface KingPostPart {
    desc: string;        // B "- ดั้ง-n"
    c: number;           // C ซีคู่
    length: number;      // G ความยาว (ม.)
    count: number;       // H จำนวน (เส้น)
}

/** The ดั้ง group row (Excel row 6): I6 = SUM(I7:I11), J6 = ROUNDUP(I6/6). */
export interface KingPostGroup {
    desc: string;
    parts: KingPostPart[];
}

/**
 * The valley member (Excel row 13). G13 = (SQRT((3.6^2)+(3.6^2)))/COS(RADIANS(40)): the plan diagonal of the
 * two runs divided by cos(pitch). Excel hard-codes 3.6 / 3.6 / 40° (oddities 14–15); they are inputs here.
 */
export interface ValleyMember {
    desc: string;
    c: number;
    runA: number;        // plan run 1 (ม.)
    runB: number;        // plan run 2 (ม.)
    deg: number;         // pitch (องศา) — not linked to Roofing K6, like Excel
    count: number;       // H จำนวน (เส้น)
}

/** A member counted by area: I = ((E/F)*D)*C. */
export interface AreaMember {
    desc: string;
    c: number;
    factor: number;      // D Factor Roof
    /** E พื้นที่หลังคา (ตร.ม.). null = linked to the Roofing sheet's slope area K7 (Excel's formula in the cell). */
    area: number | null;
    spacing: number;     // F ระยะห่าง (ม.)
}

export interface RoofStructureInput {
    wallPlate: LengthMember;   // row 5  อะเส      → BOQ R152
    kingPosts: KingPostGroup;  // row 6  ดั้ง       → BOQ R153
    ridge: LengthMember;       // row 12 อกไก่     → BOQ R154
    valley: ValleyMember;      // row 13 ตะเข้ราง  → BOQ R155
    rafter: AreaMember;        // row 14 จันทัน    → BOQ R156
    purlin: AreaMember;        // row 15 แป        → BOQ R157 (its E also → BOQ R159)
}

const num = (v: number) => (Number.isFinite(v) ? v : 0);
const cosDeg = (deg: number) => Math.cos((num(deg) * Math.PI) / 180);

export const sticks = (totalLength: number) => roundUp(num(totalLength) / STICK_LENGTH);
export const segmentSum = (lengths: number[]) => lengths.reduce((s, x) => s + num(x), 0);
export const partTotal = (p: KingPostPart) => (num(p.count) * num(p.length)) * num(p.c);
export const valleyLength = (v: ValleyMember) =>
    Math.sqrt(num(v.runA) ** 2 + num(v.runB) ** 2) / cosDeg(v.deg);

/** Slope area from the Roofing sheet (its own Excel sample when Roofing is not part of the project). */
export function linkedSlopeArea(ctx: CalcContext): number {
    return ctx.outputs('roofing')?.slopeArea ?? slopeArea(roofing.defaults());
}

export const resolvedArea = (m: AreaMember, linked: number) => m.area ?? linked;

/** ((E/F)*D)*C; an empty spacing gives 0 (Excel: #DIV/0!). */
export function areaTotal(m: AreaMember, linked: number): number {
    const f = num(m.spacing);
    if (f === 0) return 0;
    return ((num(resolvedArea(m, linked)) / f) * num(m.factor)) * num(m.c);
}

const lengthTotal = (m: LengthMember) => (num(m.count) * segmentSum(m.lengths)) * num(m.c);

export const roofStructure = defineCalculator<RoofStructureInput>({
    id: 'roof-structure',
    sheetName: 'โครงสร้างหลังคา Roof Structure',
    title: 'โปรแกรมถอดแบบ – งานโครงสร้างหลังคา Roof Structure',
    titleEn: 'Roof Structure',
    sections: [15],
    deps: ['roofing'],
    defaults: () => ({
        wallPlate: {
            desc: 'อะเส 2-C 150x50x20x3.2 มม.', c: 2,
            lengths: [12.5, 11, 4.5, 8, 9.2, 6, 10.6, 10, 10.6, 3.5, 3.5, 3.5], count: 1,
        },
        kingPosts: {
            desc: 'ดั้ง 2-C 100x50x20x2.3 มม.',
            parts: [
                { desc: '- ดั้ง-1', c: 2, length: 1.6, count: 2 },
                { desc: '- ดั้ง-2', c: 2, length: 1.8, count: 3 },
                { desc: '- ดั้ง-3', c: 2, length: 3.05, count: 4 },
                { desc: '- ดั้ง-4', c: 2, length: 2.65, count: 3 },
                { desc: '- ดั้ง-5', c: 2, length: 1.6, count: 6 },
            ],
        },
        ridge: { desc: 'อกไก่ 2-C 100x50x20x2.3 มม.', c: 2, lengths: [5, 7.5, 9.2, 4.6, 6.6, 5.6, 5.6], count: 1 },
        valley: { desc: 'ตะเข้ราง C 100x50x20x2.3 มม.', c: 1, runA: 3.6, runB: 3.6, deg: 40, count: 4 },
        rafter: { desc: 'จันทัน C 100x50x20x2.3 มม.', c: 1, factor: 1.15, area: null, spacing: 1 },
        purlin: { desc: 'แปสำเร็จรูป GZ หนา 0.7 มม.', c: 1, factor: 1.15, area: null, spacing: 0.34 },
    }),
    compute: (input, ctx) => {
        const linked = linkedSlopeArea(ctx);
        // I = ความยาวรวม (ม.), J = จำนวน (ท่อน) = ROUNDUP(I/6, 0)
        const wallPlate = lengthTotal(input.wallPlate);                                   // I5
        const kingPosts = input.kingPosts.parts.reduce((s, p) => s + partTotal(p), 0);   // I6 = SUM(I7:I11)
        const ridge = lengthTotal(input.ridge);                                           // I12
        const valleyG = valleyLength(input.valley);                                       // G13
        const valley = (num(input.valley.count) * valleyG) * num(input.valley.c);         // I13
        const rafterArea = resolvedArea(input.rafter, linked);                            // E14
        const purlinArea = resolvedArea(input.purlin, linked);                            // E15

        const out: Record<string, number> = {
            linkedSlopeArea: linked,
            'wallPlate.length': segmentSum(input.wallPlate.lengths),   // G5
            'wallPlate.total': wallPlate,
            'kingPosts.total': kingPosts,
            'ridge.length': segmentSum(input.ridge.lengths),           // G12
            'ridge.total': ridge,
            'valley.length': valleyG,
            'valley.total': valley,
            'rafter.area': rafterArea,
            'rafter.total': areaTotal(input.rafter, linked),           // I14
            'purlin.area': purlinArea,
            'purlin.total': areaTotal(input.purlin, linked),           // I15
            R152: sticks(wallPlate),                                   // J5
            R153: sticks(kingPosts),                                   // J6
            R154: sticks(ridge),                                       // J12
            R155: sticks(valley),                                      // J13
            R156: sticks(areaTotal(input.rafter, linked)),             // J14
            R157: sticks(areaTotal(input.purlin, linked)),             // J15
            // BOQ E159 ค่าแรงโครงสร้างเหล็ก = 'โครงสร้างหลังคา Roof Structure'!E15 (the purlin row's slope area).
            R159: purlinArea,
        };
        input.kingPosts.parts.forEach((p, i) => { out[`kingPosts.part.${i}`] = partTotal(p); }); // I7…I11
        return out;
    },
    boqLinks: (['R152', 'R153', 'R154', 'R155', 'R156', 'R157', 'R159'] as const)
        .map(line => ({ line, field: 'qty' as const, output: line })),
    // D152…D157 = B5, B6, B12, B13, B14, B15.
    boqText: (input) => {
        const desc: [string, string][] = [
            ['R152', input.wallPlate.desc], ['R153', input.kingPosts.desc], ['R154', input.ridge.desc],
            ['R155', input.valley.desc], ['R156', input.rafter.desc], ['R157', input.purlin.desc],
        ];
        const text: Record<string, { desc: string }> = {};
        for (const [line, d] of desc) if (d.trim() !== '') text[line] = { desc: d.trim() };
        return text;
    },
});
