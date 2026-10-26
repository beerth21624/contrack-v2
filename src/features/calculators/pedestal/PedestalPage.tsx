'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { footing } from '@/domain/calculators/footing';
import {
    pedestal, pedestalRow, pedestalTotals, footingRefFor, emptyPedestalRow, PEDESTAL_BAR_SIZES, PEDESTAL_NAMES,
    type PedestalRow,
} from '@/domain/calculators/pedestal';
import { REBAR_SIZES } from '@/domain/boq/slots';
import { calculatorInput } from '@/domain/project';
import { useProjectStore } from '@/store/project-store';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { PedestalJourney } from './PedestalJourney';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import {
    GROUP_COLORS, StructureTable, TotalValue, type StructColumn, type StructGroup,
} from '@/components/sheet/StructureTable';

const sizeOptions = PEDESTAL_BAR_SIZES.map(s => ({ value: s }));

/** Puts the bar sizes RB6…DB20 (sheet row 5) and their SUMIF totals (row 6) over the first five columns of a bar group. */
function withSizeTotals(cols: StructColumn<PedestalRow>[], totals: Record<string, number>): StructColumn<PedestalRow>[] {
    return cols.map((c, i) => {
        const s = REBAR_SIZES[i];
        return s === undefined ? { ...c, sub: '-', total: '-' } : { ...c, sub: s, total: <TotalValue value={totals[s]} /> };
    });
}

export default function PedestalPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(pedestal);
    const project = useProjectStore(s => s.project);
    const footingRows = useMemo(() => calculatorInput(project, footing).rows, [project]);
    const fo = result.calcOutputs.footing;
    const inJourney = useJourneyMode();
    const t = pedestalTotals(input.rows, fo);
    const calc = (r: PedestalRow) => pedestalRow(r, footingRefFor(fo, r.footing));

    const footingOptions = footingRows.map((f, i) => ({ value: i, label: `${i + 1}${f.name ? ` · ${f.name}` : ''}` }));

    const groups: StructGroup<PedestalRow>[] = [
        {
            title: 'สรุปปริมาณงานเสาตอม่อ', color: GROUP_COLORS.info,
            columns: [
                {
                    kind: 'select', key: 'name', title: 'ชื่อเสา', width: 72,
                    options: PEDESTAL_NAMES.map(n => ({ value: n })), allowClear: true,
                    get: r => r.name, set: (r, v) => ({ ...r, name: typeof v === 'string' ? v : '' }),
                },
                {
                    kind: 'select', key: 'footing', title: 'ตั้งบนฐานราก (แถว)', width: 88, options: footingOptions,
                    placeholder: 'เลือก', get: r => r.footing,
                    set: (r, v) => ({ ...r, footing: typeof v === 'number' ? v : -1 }),
                },
                { kind: 'number', key: 'count', title: 'จำนวน เสา (ต้น)', width: 64, digits: 0, get: r => r.count, set: (r, v) => ({ ...r, count: v }) },
                { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 64, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 64, get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                { kind: 'number', key: 'height', title: 'สูง (ม.)', width: 64, get: r => r.height, set: (r, v) => ({ ...r, height: v }) },
            ],
        },
        {
            band: 'เหล็กเสริม', title: 'ปริมาณเหล็กเสริมหลัก (กก.)', color: GROUP_COLORS.rebar,
            columns: withSizeTotals([
                {
                    kind: 'select', key: 'mainBarSize', title: 'ขนาด', width: 84, options: sizeOptions, allowClear: true,
                    get: r => r.mainBarSize, set: (r, v) => ({ ...r, mainBarSize: typeof v === 'string' ? v : '' }),
                },
                { kind: 'number', key: 'mainBarCount', title: 'จำนวน (เส้น)', width: 64, digits: 0, get: r => r.mainBarCount, set: (r, v) => ({ ...r, mainBarCount: v }) },
                { kind: 'calc', key: 'mainLength', title: 'ความยาว /เส้น (ม.)', get: r => calc(r).mainLength },
                { kind: 'calc', key: 'mainTotal', title: 'ความยาว รวม (ม.)', get: r => calc(r).mainTotal },
                { kind: 'calc', key: 'mainKg', title: 'น้ำหนัก (กก.)', get: r => calc(r).mainKg },
            ], t.main),
        },
        {
            band: 'เหล็กเสริม', title: 'ปริมาณเหล็กปลอก (กก.)', color: GROUP_COLORS.rebar,
            columns: withSizeTotals([
                {
                    kind: 'select', key: 'stirrupSize', title: 'ขนาด', width: 84, options: sizeOptions, allowClear: true,
                    get: r => r.stirrupSize, set: (r, v) => ({ ...r, stirrupSize: typeof v === 'string' ? v : '' }),
                },
                { kind: 'number', key: 'stirrupSpacing', title: 'ระยะห่าง (ม.)', width: 64, get: r => r.stirrupSpacing, set: (r, v) => ({ ...r, stirrupSpacing: v }) },
                { kind: 'calc', key: 'stirrupCount', title: 'จำนวน (ปลอก)', digits: 0, get: r => calc(r).stirrupCount },
                { kind: 'calc', key: 'stirrupLength', title: 'ความยาว /เส้น (ม.)', get: r => calc(r).stirrupLength },
                { kind: 'calc', key: 'stirrupTotal', title: 'ความยาว รวม (ม.)', get: r => calc(r).stirrupTotal },
                { kind: 'calc', key: 'stirrupKg', title: 'น้ำหนัก (กก.)', get: r => calc(r).stirrupKg },
            ], t.stirrup),
        },
        {
            band: 'ไม้แบบ', title: 'ไม้แบบ (ตร.ม.)', color: GROUP_COLORS.concrete, total: <TotalValue value={t.formwork} />,
            columns: [{ kind: 'calc', key: 'formwork', title: 'ไม้แบบ (ตร.ม.)', get: r => calc(r).formwork }],
        },
        {
            band: 'คอนกรีต', title: 'คอนกรีต โครงสร้าง (ลบ.ม.)', color: GROUP_COLORS.concrete, total: <TotalValue value={t.concrete} />,
            columns: [{ kind: 'calc', key: 'concrete', title: 'คอนกรีต โครงสร้าง (ลบ.ม.)', get: r => calc(r).concrete }],
        },
    ];

    const summary = (
        <SheetCard title="ส่งเข้าตารางสรุปวัสดุงานโครงสร้าง (งานเสาตอม่อ_Footing Column)">
            {REBAR_SIZES.map(s => (
                <CalcField key={s} label={`เหล็กเสริม ${s} (→ BOQ 6.6)`} value={outputs[`rebar.${s}`]} unit="กก." digits={4} />
            ))}
            <CalcField label="ไม้แบบ (→ BOQ 7.1)" value={outputs.formwork} unit="ตร.ม." digits={4} />
            <CalcField label="คอนกรีต โครงสร้าง (→ BOQ 7.2)" value={outputs.concrete} unit="ลบ.ม." digits={4} />
            <CalcField label="ดิน ถมกลับของฐานราก (→ BOQ 8.1)" value={outputs.backfill} unit="ลบ.ม." digits={4} strong />
        </SheetCard>
    );

    if (inJourney) {
        return (
            <CalculatorShell def={pedestal} result={result} isDefault={isDefault} onReset={reset}>
                <PedestalJourney rows={input.rows} onChange={rows => update({ rows })} footings={footingRows}
                    footingSkipped={project.journey?.footing === 'skipped'} footingOutputs={fo} backfill={outputs.backfill} />
            </CalculatorShell>
        );
    }

    return (
        <CalculatorShell def={pedestal} result={result} isDefault={isDefault} onReset={reset} aside={summary}>
            <SheetCard title="สรุปปริมาณงานเสาตอม่อ">
                <StructureTable<PedestalRow>
                    rows={input.rows}
                    groups={groups}
                    onChange={rows => update({ rows })}
                    // D13: a new pedestal sits on the footing row with the same number (row 1 if there is none).
                    newRow={i => emptyPedestalRow(i < footingRows.length ? i : 0)}
                    addLabel="เพิ่มเสาตอม่อ"
                />
                <ul className="mt-3 text-[12px] text-gray-500 list-disc pl-5 space-y-0.5">
                    <li>
                        ตั้งบนฐานราก = แถวใน <Link className="text-blue-600 underline" href="/calc/footing">โปรแกรมฐานราก</Link> ที่เสาตอม่อนี้ตั้งอยู่
                        (Excel จับคู่แถวต่อแถว: เสาตอม่อแถว n ↔ ฐานรากแถว n)
                    </li>
                    <li>เหล็กเสริมหลัก ความยาว/เส้น = สูง + ลึกฐานราก + กว้างฐานราก ÷ 3</li>
                    <li>
                        เหล็กปลอก จำนวน = ปัดขึ้น((ลึกฐานราก + สูง) ÷ ระยะห่าง) · ความยาว/เส้น = 2 × (กว้าง + ยาว)
                        — ใช้ความลึกของฐานรากที่เสาตั้งอยู่ (Excel ใช้ฐานรากแถวแรกทุกแถว)
                    </li>
                    <li>ไม้แบบ = จำนวน × 2 × (กว้าง + ยาว) × สูง · คอนกรีต = จำนวน × กว้าง × ยาว × สูง</li>
                    <li>คอนกรีตเสาตอม่อถูกหักออกจากดินถมกลับของฐานราก → BOQ 8.1 ถมดินกลับ · เหล็กเสริมไปที่ BOQ 6.6</li>
                </ul>
            </SheetCard>
        </CalculatorShell>
    );
}
