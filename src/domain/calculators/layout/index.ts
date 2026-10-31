// External Google Sheet "STEP 04 : โปรแกรมคำนวณวางผัง / ปักหมุด" (rId3, linked from BOQ (Home) C31)
// → BOQ section 4, row 32 (วางผัง / ปักหมุด, 1 เหมา).
// The sheet was not supplied (decision D8): reconstructed from review deck p19.
// Spec: docs/excel-spec/01-boq-home-and-steps-00-05.md, Section 4.
import { roundUp } from '../../boq/engine';
import { defineCalculator } from '../types';

/** One row of the material table. */
export interface LayoutMaterialLine {
    item: string;         // รายการวัสดุ
    unit: string;         // หน่วย
    perPoint: number;     // ฐานต่อ 1 ผัง
    fixed: number;        // ฐานคงที่
    /** ฐานคงที่ = จำนวนไม้ปักหมุด (the ไม้ปักหมุด row); `fixed` is then ignored. */
    fixedFromStakes?: boolean;
    unitPrice: number;    // ราคาต่อหน่วย
}

export interface LayoutInput {
    points: number;       // จำนวนผัง (จุด)
    stakes: number;       // จำนวนไม้ปักหมุด (ต้น) — equals the pile count in the sample (21)
    waste: number;        // เผื่อวัสดุ (%) as a fraction
    labour: number;       // ค่าแรงวางผัง / ปักหมุด (บาท, lump sum)
    /** The 5 sheet rows plus any rows the user adds (D5). */
    materials: LayoutMaterialLine[];
}

/** Rows of the sheet whose label is fixed (rows added after them are free text). */
export const LAYOUT_FIXED_ROWS = 5;

/** LIVE PREVIEW lines that show a material row's order qty (row index in the default table). */
export const LAYOUT_LIVE_PREVIEW = [
    { row: 0, label: 'ไม้หน้าสาม', unit: 'ท่อน', output: 'orderBoards' },
    { row: 1, label: 'ไม้ยูคา', unit: 'ท่อน', output: 'orderEucalyptus' },
    { row: 2, label: 'ไม้ปักหมุด', unit: 'ต้น', output: 'orderStakes' },
] as const;

const num = (v: number) => (Number.isFinite(v) ? v : 0);

export interface LayoutLineResult {
    fixed: number;        // ฐานคงที่ (resolved)
    beforeWaste: number;  // จำนวนก่อนเผื่อ = ฐานต่อ 1 ผัง × จำนวนผัง + ฐานคงที่
    orderQty: number;     // จำนวนสั่งซื้อ = ROUNDUP(จำนวนก่อนเผื่อ × (1 + เผื่อ), 0)
    total: number;        // รวมราคา = จำนวนสั่งซื้อ × ราคาต่อหน่วย
}

export function layoutLine(line: LayoutMaterialLine, input: LayoutInput): LayoutLineResult {
    const fixed = line.fixedFromStakes ? num(input.stakes) : num(line.fixed);
    const beforeWaste = num(line.perPoint) * num(input.points) + fixed;
    const orderQty = roundUp(beforeWaste * (1 + num(input.waste)));
    return { fixed, beforeWaste, orderQty, total: orderQty * num(line.unitPrice) };
}

/** The 5 material rows of deck p19. */
function sampleMaterials(): LayoutMaterialLine[] {
    return [
        { item: 'ไม้หน้าสาม 1-1/2" x 3" ยาว 1 ม.', unit: 'ท่อน', perPoint: 1, fixed: 0, unitPrice: 0 },
        { item: 'ไม้ยูคา 3 นิ้ว x 3 ม.', unit: 'ท่อน', perPoint: 3, fixed: 0, unitPrice: 0 },
        { item: 'ไม้ปักหมุด', unit: 'ต้น', perPoint: 0, fixed: 0, fixedFromStakes: true, unitPrice: 0 },
        { item: 'ตะปู 1-1/2 x 14 (ถุง 1 กก.)', unit: 'กล่อง', perPoint: 0, fixed: 1, unitPrice: 0 },
        { item: 'สายเอ็น สีเขียว #60', unit: 'ม้วน', perPoint: 0, fixed: 1, unitPrice: 0 },
    ];
}

export const layout = defineCalculator<LayoutInput>({
    id: 'layout',
    // The real sheet name is unknown (external file, D8).
    sheetName: 'วางผัง / ปักหมุด',
    title: 'STEP 04 : โปรแกรมคำนวณวางผัง / ปักหมุด',
    titleEn: 'Layout / Setting-out',
    sections: [4],
    deps: [],
    defaults: () => ({
        points: 26,
        stakes: 21,
        waste: 0.05,
        labour: 0,
        materials: sampleMaterials(),
    }),
    // Counts read off the foundation plan (layout points, stakes) empty. Waste, labour and the material recipe
    // (per-point / fixed bases, prices) keep the sheet values. The BOQ row is not linked (see below), so the
    // Excel lump sum 4,000 + 1,500 stays in the BOQ whatever is typed here.
    blank: () => ({
        points: 0,
        stakes: 0,
        waste: 0.05,
        labour: 0,
        materials: sampleMaterials(),
    }),
    compute: (input) => {
        const lines = input.materials.map(l => layoutLine(l, input));
        const materialTotal = lines.reduce((s, l) => s + l.total, 0);   // รวมค่าวัสดุ
        const labour = num(input.labour);                              // ค่าแรง
        const out: Record<string, number> = {
            points: num(input.points),
            stakes: num(input.stakes),
            materialTotal,
            labour,
            total: materialTotal + labour,                             // รวม Step 04
        };
        for (const p of LAYOUT_LIVE_PREVIEW) out[p.output] = lines[p.row]?.orderQty ?? 0;
        return out;
    },
    // Not linked yet: the deck's sheet has all prices 0 while Excel BOQ I32 / K32 are typed 4,000 / 1,500,
    // so linking would zero the section. Once the real sheet is supplied (D8):
    //   [{ line: 'R32', field: 'mat', output: 'materialTotal' }, { line: 'R32', field: 'lab', output: 'labour' }]
    boqLinks: [],
});
