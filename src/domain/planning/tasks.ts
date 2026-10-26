// ─── The 32 planned tasks (S-Curve_Plan_Basic) and their Man-Day blocks (Man-Day_Basic O..U) ───
// Static structure of the three planning sheets of Excel v5. The values marked "sample" are the
// Excel sample inputs (yellow cells) and only seed the defaults (see ./index.ts).
// docs/excel-spec/06-manday-scurve-cashflow.md §1.4 (blocks) and §2.2 (task list).

/** Wage set of a Man-Day block: A = 800 skilled / 500 labourer, B = 1000 / 600 (Excel R formulas). */
export type WageSetId = 'A' | 'B';

/**
 * What the calculated days (Man-Day S) divide by the daily crew wage:
 * - 'labour'       : the block's labour total (BOQ L / Man-Day K), e.g. S37 = K59 / R37
 * - 'shareOfTotal' : a share (20 %) of the block's total, for sub-contracted work whose labour column is 0
 *                    (S233 = L243 × 0.2 / R233 aluminium, S278 = L280 × 0.2 / R278 เบ็ดเตล็ด)
 * - 'none'         : no calculation (piles, S34 is blank)
 */
export type ManDayLabourBasis = 'labour' | 'shareOfTotal' | 'none';

export interface ManDayBlockDef {
    /** Man-Day header row in Excel (the row holding O..U). */
    excelRow: number;
    /** Man-Day column B / C label. */
    title: string;
    /** BOQ (Home) section 0–31 whose rows the block reads. */
    section: number;
    /**
     * Only BOQ rows with `from ≤ excelRow < to` (Excel row numbers). Used where Excel splits one
     * BOQ section into two blocks: ก่ออิฐ items 1–5 (179–183) / ท่อร้อยสายไฟ (184–186) and
     * ฉาบปูน items 1–3 (189–191) / สายไฟ (192–196).
     */
    rows?: { from?: number; to?: number };
    labourBasis: ManDayLabourBasis;
}

export interface PlanTaskDef {
    /** Task number in S-Curve column B, also the stable id ("1.1" … "8.6"). */
    id: string;
    /** งวดที่ 1–8. */
    installment: number;
    /** S-Curve column C (trailing spaces of the Excel trimmed — the app links by id, not by name MATCH). */
    name: string;
    /** S-Curve PLAN row (the ACTUAL row is the next one). */
    excelRow: number;
    /** CashFlow_Basic Cash-OUT row. */
    cashflowRow: number;
    manday: ManDayBlockDef;
    sample: {
        skilled: number;      // Man-Day O
        labourers: number;    // Man-Day P
        wageSet: WageSetId;   // which constants the R formula uses
        days: number;         // Man-Day T (6.ประเมิน)
        start: string;        // S-Curve E (PLAN row)
    };
}

interface Row {
    id: string; inst: number; name: string; sc: number; cf: number;
    md: number; title: string; sec: number; rows?: { from?: number; to?: number }; basis?: ManDayLabourBasis;
    o: number; p: number; set: WageSetId; t: number; start: string;
}

const ROWS: Row[] = [
    { id: '1.1', inst: 1, name: 'งานน้ำ-ไฟชั่วคราว', sc: 14, cf: 21, md: 15, title: 'งานน้ำ-ไฟชั่วคราว', sec: 2, o: 1, p: 1, set: 'A', t: 1, start: '2026-01-10' },
    { id: '1.2', inst: 1, name: 'งานเตรียมพื้นที่หน้างาน', sc: 16, cf: 22, md: 18, title: 'งานเตรียมพื้นที่หน้างาน', sec: 3, o: 1, p: 5, set: 'A', t: 2, start: '2026-01-10' },
    { id: '1.3', inst: 1, name: 'งานวางผัง / ปักหมุด', sc: 18, cf: 23, md: 31, title: 'งานวางผัง / ปักหมุด', sec: 4, o: 1, p: 1, set: 'A', t: 1, start: '2026-01-12' },
    { id: '1.4', inst: 1, name: 'งานเสาเข็ม', sc: 20, cf: 24, md: 34, title: 'งานเสาเข็ม', sec: 5, basis: 'none', o: 0, p: 0, set: 'A', t: 1, start: '2026-01-13' },
    { id: '1.5', inst: 1, name: 'งานฐานราก', sc: 22, cf: 25, md: 37, title: 'งานฐานราก', sec: 6, o: 1, p: 5, set: 'A', t: 10, start: '2026-01-22' },
    { id: '1.6', inst: 1, name: 'งานเสาตอม่อ', sc: 24, cf: 26, md: 60, title: 'งานเสาตอม่อ', sec: 7, o: 1, p: 5, set: 'A', t: 1, start: '2026-01-24' },
    { id: '1.7', inst: 1, name: 'งานคานคอดิน', sc: 26, cf: 27, md: 67, title: 'งานคานคอดิน', sec: 8, o: 1, p: 5, set: 'A', t: 11, start: '2026-01-25' },
    { id: '2.1', inst: 2, name: 'งานพื้นหล่อในที่', sc: 29, cf: 28, md: 82, title: 'งานพื้นหล่อในที่', sec: 9, o: 1, p: 5, set: 'A', t: 4, start: '2026-02-05' },
    { id: '2.2', inst: 2, name: 'งานพื้นสำเร็จรูป', sc: 31, cf: 29, md: 96, title: 'งานพื้นสำเร็จรูป', sec: 10, o: 1, p: 5, set: 'A', t: 3, start: '2026-02-09' },
    { id: '2.3', inst: 2, name: 'งานเสาชั้น 1', sc: 33, cf: 30, md: 106, title: 'งานเสาชั้น 1', sec: 11, o: 1, p: 5, set: 'A', t: 4, start: '2026-02-12' },
    { id: '2.4', inst: 2, name: 'งานคาน + พื้นดาดฟ้า', sc: 35, cf: 31, md: 113, title: 'งานคาน + พื้นดาดฟ้า', sec: 12, o: 1, p: 5, set: 'A', t: 6, start: '2026-02-16' },
    { id: '2.5', inst: 2, name: 'งานโครงสร้างบันได', sc: 37, cf: 32, md: 136, title: 'งานโครงสร้างบันได', sec: 13, o: 1, p: 5, set: 'A', t: 2, start: '2026-02-22' },
    { id: '3.1', inst: 3, name: 'งานเพลทหัวเสา', sc: 40, cf: 33, md: 147, title: 'งานเพลทหัวเสา', sec: 14, o: 1, p: 1, set: 'A', t: 2, start: '2026-02-24' },
    { id: '3.2', inst: 3, name: 'งานโครงหลังคา', sc: 42, cf: 34, md: 151, title: 'งานโครงหลังคา', sec: 15, o: 4, p: 2, set: 'B', t: 5, start: '2026-02-25' },
    { id: '3.3', inst: 3, name: 'งานมุงหลังคา', sc: 44, cf: 35, md: 161, title: 'งานมุงหลังคา', sec: 16, o: 4, p: 2, set: 'B', t: 5, start: '2026-03-02' },
    { id: '4.1', inst: 4, name: 'งานก่ออิฐ', sc: 47, cf: 36, md: 178, title: 'งานก่ออิฐ', sec: 17, rows: { to: 184 }, o: 5, p: 3, set: 'A', t: 14, start: '2026-03-05' },
    { id: '4.2', inst: 4, name: 'งานติดตั้งท่อระบบไฟฟ้า', sc: 49, cf: 37, md: 184, title: 'ท่อร้อยสายไฟ', sec: 17, rows: { from: 184 }, o: 3, p: 1, set: 'B', t: 4, start: '2026-03-18' },
    { id: '5.1', inst: 5, name: 'งานฉาบปูน', sc: 52, cf: 38, md: 188, title: 'งานฉาบปูน', sec: 18, rows: { to: 192 }, o: 5, p: 3, set: 'A', t: 15, start: '2026-03-21' },
    { id: '5.2', inst: 5, name: 'งานร้อยสายไฟฟ้า', sc: 54, cf: 39, md: 193, title: 'สายไฟ', sec: 18, rows: { from: 192 }, o: 3, p: 1, set: 'B', t: 4, start: '2026-04-04' },
    { id: '6.1', inst: 6, name: 'งานฝ้าเพดาน', sc: 57, cf: 40, md: 198, title: 'งานฝ้าเพดาน', sec: 19, o: 2, p: 2, set: 'B', t: 8, start: '2026-04-05' },
    { id: '6.2', inst: 6, name: 'งานปูกระเบื้อง', sc: 59, cf: 41, md: 204, title: 'งานปูกระเบื้องพื้น', sec: 20, o: 2, p: 2, set: 'A', t: 12, start: '2026-04-13' },
    { id: '6.3', inst: 6, name: 'งานปูกระเบื้องห้องน้ำ', sc: 61, cf: 42, md: 209, title: 'งานปูกระเบื้องห้องน้ำ', sec: 21, o: 2, p: 2, set: 'A', t: 5, start: '2026-04-25' },
    { id: '6.4', inst: 6, name: 'งานตกแต่งผนัง', sc: 63, cf: 43, md: 217, title: 'งานตกแต่งผนัง', sec: 22, o: 1, p: 1, set: 'A', t: 4, start: '2026-04-30' },
    { id: '6.5', inst: 6, name: 'งานทาสีรองพื้น', sc: 65, cf: 44, md: 222, title: 'งานทาสีรองพื้น', sec: 23, o: 4, p: 2, set: 'B', t: 8, start: '2026-05-04' },
    { id: '7.1', inst: 7, name: 'งานประตู-หน้าต่างอลูมิเนียม', sc: 68, cf: 45, md: 233, title: 'งานประตู-หน้าต่างอลูมิเนียม', sec: 24, basis: 'shareOfTotal', o: 3, p: 1, set: 'B', t: 6, start: '2026-05-12' },
    { id: '7.2', inst: 7, name: 'งานทาสีจริง รอบที่ 1', sc: 70, cf: 46, md: 244, title: 'งานทาสีจริง รอบที่ 1', sec: 25, o: 4, p: 2, set: 'B', t: 4, start: '2026-05-18' },
    { id: '8.1', inst: 8, name: 'งานติดตั้งอุปกรณ์ไฟฟ้า', sc: 73, cf: 47, md: 254, title: 'งานติดตั้งอุปกรณ์ไฟฟ้า', sec: 26, o: 3, p: 1, set: 'B', t: 5, start: '2026-05-21' },
    { id: '8.2', inst: 8, name: 'งานระบบสุขาภิบาล', sc: 75, cf: 48, md: 272, title: 'งานระบบสุขาภิบาล', sec: 27, o: 3, p: 2, set: 'A', t: 4, start: '2026-05-21' },
    { id: '8.3', inst: 8, name: 'งานเบ็ดเตล็ด', sc: 77, cf: 49, md: 278, title: 'งานเบ็ดเตล็ด', sec: 28, basis: 'shareOfTotal', o: 3, p: 1, set: 'B', t: 2, start: '2026-05-21' },
    { id: '8.4', inst: 8, name: 'งานสุขภัณฑ์', sc: 79, cf: 50, md: 281, title: 'งานสุขภัณฑ์', sec: 29, o: 1, p: 1, set: 'A', t: 3, start: '2026-05-25' },
    { id: '8.5', inst: 8, name: 'งานประตู-หน้าต่างไม้', sc: 81, cf: 51, md: 293, title: 'งานประตู-หน้าต่างไม้', sec: 30, o: 1, p: 1, set: 'A', t: 4, start: '2026-05-21' },
    { id: '8.6', inst: 8, name: 'งานทาสีรอบสุดท้าย', sc: 83, cf: 52, md: 299, title: 'งานทาสีรอบสุดท้าย', sec: 31, o: 4, p: 2, set: 'B', t: 4, start: '2026-05-28' },
];

export const PLAN_TASKS: readonly PlanTaskDef[] = ROWS.map(r => ({
    id: r.id,
    installment: r.inst,
    name: r.name,
    excelRow: r.sc,
    cashflowRow: r.cf,
    manday: {
        excelRow: r.md, title: r.title, section: r.sec, labourBasis: r.basis ?? 'labour',
        ...(r.rows ? { rows: r.rows } : {}),
    },
    sample: { skilled: r.o, labourers: r.p, wageSet: r.set, days: r.t, start: r.start },
}));

/** Installment (งวด) header rows of the S-Curve: B = "1.0".."8.0", C = "งวดที่ N". */
export const INSTALLMENTS: readonly { no: number; label: string; excelRow: number }[] = [
    { no: 1, label: 'งวดที่ 1', excelRow: 13 },
    { no: 2, label: 'งวดที่ 2', excelRow: 28 },
    { no: 3, label: 'งวดที่ 3', excelRow: 39 },
    { no: 4, label: 'งวดที่ 4', excelRow: 46 },
    { no: 5, label: 'งวดที่ 5', excelRow: 51 },
    { no: 6, label: 'งวดที่ 6', excelRow: 56 },
    { no: 7, label: 'งวดที่ 7', excelRow: 67 },
    { no: 8, label: 'งวดที่ 8', excelRow: 72 },
];
