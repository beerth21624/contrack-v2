'use client';

import Link from 'next/link';
import {
    footing, footingRow, footingTotals, emptyFootingRow, FOOTING_BAR_SIZES, FOOTING_NAMES,
    type FootingRow, type RebarWeights,
} from '@/domain/calculators/footing';
import { footingBackfillKey, pedestal, remapPedestalFootings } from '@/domain/calculators/pedestal';
import { REBAR_SIZES } from '@/domain/boq/slots';
import { calculatorInput } from '@/domain/project';
import { useProjectStore } from '@/store/project-store';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { GROUP_COLORS, StructureTable, TotalValue, type StructColumn, type StructGroup } from './StructureTable';

const sizeOptions = FOOTING_BAR_SIZES.map(s => ({ value: s }));

/** The 5 columns of one bar group (ขนาด, จำนวน, ความยาว/เส้น, ความยาว รวม, น้ำหนัก) with sizes RB6…DB20 and their SUMIF totals above. */
function barGroup(
    prefix: string, lengthTitle: string, totals: RebarWeights,
    size: (r: FootingRow) => string, setSize: (r: FootingRow, v: string) => FootingRow,
    count: (r: FootingRow) => number, setCount: (r: FootingRow, v: number) => FootingRow,
    calc: (r: FootingRow) => { len: number; total: number; kg: number },
): StructColumn<FootingRow>[] {
    const cols: StructColumn<FootingRow>[] = [
        {
            kind: 'select', key: `${prefix}Size`, title: 'ขนาด', width: 84, options: sizeOptions, allowClear: true,
            get: size, set: (r, v) => setSize(r, typeof v === 'string' ? v : ''),
        },
        { kind: 'number', key: `${prefix}Count`, title: 'จำนวน (เส้น)', width: 64, digits: 0, get: count, set: setCount },
        { kind: 'calc', key: `${prefix}Len`, title: lengthTitle, get: r => calc(r).len },
        { kind: 'calc', key: `${prefix}Total`, title: 'ความยาว รวม (ม.)', get: r => calc(r).total },
        { kind: 'calc', key: `${prefix}Kg`, title: 'น้ำหนัก (กก.)', digits: 2, get: r => calc(r).kg },
    ];
    return cols.map((c, i) => {
        const s = REBAR_SIZES[i];
        return s === undefined ? c : { ...c, sub: s, total: <TotalValue value={totals[s]} /> };
    });
}

export default function FootingPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(footing);
    const t = footingTotals(input.rows);
    const ped = result.calcOutputs.pedestal;
    /** Column AI: the pedestal sheet subtracts its concrete (shown without it until that sheet is available). */
    const backfillOf = (r: FootingRow, i: number) => ped?.[footingBackfillKey(i)] ?? footingRow(r).backfillGross;
    const backfillTotal = ped?.backfill ?? t.backfillGross;
    const setCalculatorInput = useProjectStore(s => s.setCalculatorInput);
    /** Deleting a footing row shifts the rows below it: keep every pedestal on the footing it sat on (D13). */
    const onRowsChange = (rows: FootingRow[]) => {
        const moved = remapPedestalFootings(calculatorInput(useProjectStore.getState().project, pedestal), input.rows, rows);
        if (moved) setCalculatorInput(pedestal.id, moved);
        update({ rows });
    };

    const groups: StructGroup<FootingRow>[] = [
        {
            title: 'ข้อมูลงานฐานราก Footing', color: GROUP_COLORS.info,
            columns: [
                {
                    kind: 'select', key: 'name', title: 'ชื่อ ฐานราก', width: 76,
                    options: FOOTING_NAMES.map(n => ({ value: n })), allowClear: true,
                    get: r => r.name, set: (r, v) => ({ ...r, name: typeof v === 'string' ? v : '' }),
                },
                { kind: 'number', key: 'count', title: 'จำนวน ฐานราก (ฐาน)', width: 70, digits: 0, get: r => r.count, set: (r, v) => ({ ...r, count: v }) },
                { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 64, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 64, get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                { kind: 'number', key: 'depth', title: 'ลึก (ม.)', width: 64, get: r => r.depth, set: (r, v) => ({ ...r, depth: v }) },
            ],
        },
        {
            band: 'วัสดุรองพื้น', title: 'ดินขุด (ลบ.ม.)', color: GROUP_COLORS.base, total: <TotalValue value={t.excavation} />,
            columns: [
                { kind: 'number', key: 'excavationDepth', title: 'ลึก (ม.)', width: 64, get: r => r.excavationDepth, set: (r, v) => ({ ...r, excavationDepth: v }) },
                { kind: 'calc', key: 'excavation', title: 'ปริมาณ (ลบ.ม.)', get: r => footingRow(r).excavation },
            ],
        },
        {
            band: 'วัสดุรองพื้น', title: 'ทรายหยาบ (ลบ.ม.)', color: GROUP_COLORS.base, total: <TotalValue value={t.sand} />,
            columns: [
                { kind: 'number', key: 'sandThickness', title: 'หนา (ม.)', width: 64, get: r => r.sandThickness, set: (r, v) => ({ ...r, sandThickness: v }) },
                { kind: 'calc', key: 'sand', title: 'ปริมาณ (ลบ.ม.)', get: r => footingRow(r).sand },
            ],
        },
        {
            band: 'วัสดุรองพื้น', title: 'คอนกรีตหยาบ (ลบ.ม.)', color: GROUP_COLORS.base, total: <TotalValue value={t.lean} />,
            columns: [
                { kind: 'number', key: 'leanThickness', title: 'หนา (ม.)', width: 64, get: r => r.leanThickness, set: (r, v) => ({ ...r, leanThickness: v }) },
                { kind: 'calc', key: 'lean', title: 'ปริมาณ (ลบ.ม.)', get: r => footingRow(r).lean },
            ],
        },
        {
            band: 'เหล็กเสริม', title: 'เหล็กเสริมหลัก (ด้านสั้น) (กก.)', color: GROUP_COLORS.rebar,
            columns: barGroup('short', 'ความยาว /เส้น (ม.)', t.short,
                r => r.shortBarSize, (r, v) => ({ ...r, shortBarSize: v }),
                r => r.shortBarCount, (r, v) => ({ ...r, shortBarCount: v }),
                r => { const c = footingRow(r); return { len: c.shortLength, total: c.shortTotal, kg: c.shortKg }; }),
        },
        {
            band: 'เหล็กเสริม', title: 'เหล็กเสริมหลัก (ด้านยาว) (กก.)', color: GROUP_COLORS.rebar,
            columns: barGroup('long', 'ความยาว /เส้น (ม.)', t.long,
                r => r.longBarSize, (r, v) => ({ ...r, longBarSize: v }),
                r => r.longBarCount, (r, v) => ({ ...r, longBarCount: v }),
                r => { const c = footingRow(r); return { len: c.longLength, total: c.longTotal, kg: c.longKg }; }),
        },
        {
            band: 'เหล็กเสริม', title: 'เหล็กรัดรอบ (กก.)', color: GROUP_COLORS.rebar,
            columns: barGroup('ring', 'ความยาว ต่อเส้น (ม.)', t.ring,
                r => r.ringBarSize, (r, v) => ({ ...r, ringBarSize: v }),
                r => r.ringBarCount, (r, v) => ({ ...r, ringBarCount: v }),
                r => { const c = footingRow(r); return { len: c.ringLength, total: c.ringTotal, kg: c.ringKg }; }),
        },
        {
            band: 'ไม้แบบ', title: 'ไม้แบบ (ตร.ม.)', color: GROUP_COLORS.concrete, total: <TotalValue value={t.formwork} />,
            columns: [{ kind: 'calc', key: 'formwork', title: 'ปริมาณ (ตร.ม.)', get: r => footingRow(r).formwork }],
        },
        {
            band: 'คอนกรีต', title: 'คอนกรีต โครงสร้าง (ลบ.ม.)', color: GROUP_COLORS.concrete, total: <TotalValue value={t.concrete} />,
            columns: [{ kind: 'calc', key: 'concrete', title: 'ปริมาณ (ลบ.ม.)', get: r => footingRow(r).concrete }],
        },
        {
            band: 'ถมดิน', title: 'ถมดิน กลับ >> (ลบ.ม.)', color: GROUP_COLORS.fill, total: <TotalValue value={backfillTotal} />,
            columns: [{ kind: 'calc', key: 'backfill', title: 'ปริมาณ', get: (r, i) => backfillOf(r, i) }],
        },
    ];

    const summary = (
        <SheetCard title="ส่งเข้าตารางสรุปวัสดุงานโครงสร้าง (งานฐานราก_Footing)">
            <CalcField label="ดินขุด" value={outputs.excavation} unit="ลบ.ม." digits={4} />
            <CalcField label="ทรายหยาบ" value={outputs.sand} unit="ลบ.ม." digits={4} />
            <CalcField label="คอนกรีตหยาบ" value={outputs.lean} unit="ลบ.ม." digits={4} />
            {REBAR_SIZES.map(s => (
                <CalcField key={s} label={`เหล็กเสริม ${s}`} value={outputs[`rebar.${s}`]} unit="กก." digits={4} />
            ))}
            <CalcField label="ไม้แบบ" value={outputs.formwork} unit="ตร.ม." digits={4} />
            <CalcField label="คอนกรีต โครงสร้าง" value={outputs.concrete} unit="ลบ.ม." digits={4} />
            <CalcField label="ดิน ถมกลับ (→ BOQ 8.1)" value={backfillTotal} unit="ลบ.ม." digits={4} strong />
        </SheetCard>
    );

    return (
        <CalculatorShell def={footing} result={result} isDefault={isDefault} onReset={reset} aside={summary}>
            <SheetCard title="ข้อมูลงานฐานราก Footing">
                <StructureTable<FootingRow>
                    rows={input.rows}
                    groups={groups}
                    onChange={onRowsChange}
                    newRow={() => emptyFootingRow()}
                    addLabel="เพิ่มฐานราก"
                />
                <ul className="mt-3 text-[12px] text-gray-500 list-disc pl-5 space-y-0.5">
                    <li>ดินขุด / ทรายหยาบ / คอนกรีตหยาบ คิดขนาดหลุม (กว้าง + 0.40 + 0.40) × (ยาว + 0.40 + 0.40) — เผื่อระยะทำงานด้านละ 0.40 ม.</li>
                    <li>ทรายหยาบ เผื่อ 25% (× 1.25)</li>
                    <li>เหล็กเสริมหลัก ความยาว/เส้น = กว้าง (หรือยาว) + 2 × ลึก (งอขึ้นสองข้าง) · เหล็กรัดรอบ = 2 × กว้าง + 2 × ยาว</li>
                    <li>ไม้แบบ = จำนวน × เส้นรอบรูป × ลึก (ด้านข้าง) · คอนกรีต = จำนวน × กว้าง × ยาว × ลึก</li>
                    <li>
                        ถมดินกลับ = ดินขุด − ทรายหยาบ − คอนกรีตหยาบ − คอนกรีตฐานราก − คอนกรีตเสาตอม่อที่ตั้งบนฐานรากนั้น
                        (จาก <Link className="text-blue-600 underline" href="/calc/pedestal">โปรแกรมเสาตอม่อ</Link>) → BOQ 8.1 ถมดินกลับ
                    </li>
                </ul>
            </SheetCard>
        </CalculatorShell>
    );
}
