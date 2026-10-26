'use client';

import type { ReactNode } from 'react';
import {
    slabOnGrade, slabRowCalc, SLAB_BAR_SIZES, SLAB_LAYERS, SLAB_NAMES, type SlabRow,
} from '@/domain/calculators/slab-on-grade';
import { REBAR_SIZES } from '@/domain/boq/slots';
import { EditableTable } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { SlabOnGradeJourney } from './SlabOnGradeJourney';

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center';
const td = 'border border-gray-200 px-2 py-1 text-[13px] text-right tabular-nums';

/** Column header with the sheet's group header (row 3/4) above the column label (row 7). */
const head = (group: string, label: string): ReactNode => (
    <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-normal text-gray-500">{group}</span>
        <span>{label}</span>
    </span>
);

const nameOptions = SLAB_NAMES.map(v => ({ value: v }));
const sizeOptions = SLAB_BAR_SIZES.map(v => ({ value: v }));
const layerOptions = SLAB_LAYERS.map(v => ({ value: String(v) }));

/** A new row keeps the previous row's thickness / fill / sand / bar settings, with no size yet. */
const newSlab = (prev: SlabRow | undefined): SlabRow => ({
    name: prev?.name ?? 'S1',
    width: 0,
    length: 0,
    thickness: prev?.thickness ?? 0.1,
    fillDepth: prev?.fillDepth ?? 0.4,
    sandThickness: prev?.sandThickness ?? 0.05,
    barSize: prev?.barSize ?? 'RB9',
    layers: prev?.layers ?? 2,
    spacing: prev?.spacing ?? 0.2,
});

export default function SlabOnGradePage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(slabOnGrade);
    const inJourney = useJourneyMode();

    if (inJourney) {
        return (
            <CalculatorShell def={slabOnGrade} result={result} isDefault={isDefault} onReset={reset}>
                <SlabOnGradeJourney input={input} outputs={outputs} onChange={slabs => update({ slabs })} />
            </CalculatorShell>
        );
    }

    return (
        <CalculatorShell def={slabOnGrade} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title="สรุปปริมาณงานพื้นหล่อในที่">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={th} colSpan={3}>วัสดุรองพื้น</th>
                                <th className={th} colSpan={REBAR_SIZES.length}>เหล็กเสริม — ปริมาณเหล็กเสริมหลัก (กก.)</th>
                                <th className={th}>คอนกรีต</th>
                            </tr>
                            <tr>
                                <th className={th}>ดินถมกลับ (ลบ.ม.)</th>
                                <th className={th}>ทรายหยาบ (ลบ.ม.)</th>
                                <th className={th}>พลาสติก กันชื้น (ตร.ม.)</th>
                                {REBAR_SIZES.map(s => <th key={s} className={th}>{s}</th>)}
                                <th className={th}>คอนกรีต โครงสร้าง (ลบ.ม.)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ background: SHEET_COLORS.calc }}>
                                <td className={td}>{formatNumber(outputs.backfill)}</td>
                                <td className={td}>{formatNumber(outputs.sand)}</td>
                                <td className={td}>{formatNumber(outputs.plastic)}</td>
                                {REBAR_SIZES.map(s => <td key={s} className={td}>{formatNumber(outputs[`rebar.${s}`])}</td>)}
                                <td className={td}>{formatNumber(outputs.concrete)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </SheetCard>

            <SheetCard title="ข้อมูลพื้นหล่อในที่">
                <EditableTable<SlabRow>
                    rows={input.slabs}
                    onChange={slabs => update({ slabs })}
                    newRow={i => newSlab(input.slabs[i - 1])}
                    addLabel="+ เพิ่มพื้น"
                    columns={[
                        { kind: 'select', key: 'name', title: 'ชื่อพื้น', width: 70, options: nameOptions,
                            get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
                        { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 70, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 70, get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'number', key: 'thickness', title: 'หนา (ม.)', width: 70, get: r => r.thickness, set: (r, v) => ({ ...r, thickness: v }) },
                        { kind: 'number', key: 'fillDepth', title: head('ดินถมกลับ', 'ถมลึก (ม.)'), width: 70,
                            get: r => r.fillDepth, set: (r, v) => ({ ...r, fillDepth: v }) },
                        { kind: 'calc', key: 'backfill', title: head('ดินถมกลับ', 'ปริมาณ (ลบ.ม.)'), width: 80, get: r => slabRowCalc(r).backfill },
                        { kind: 'number', key: 'sandThickness', title: head('ทรายหยาบ', 'หนา (ม.)'), width: 70,
                            get: r => r.sandThickness, set: (r, v) => ({ ...r, sandThickness: v }) },
                        { kind: 'calc', key: 'sand', title: head('ทรายหยาบ', 'ปริมาณ (ลบ.ม.)'), width: 80, get: r => slabRowCalc(r).sand },
                        { kind: 'calc', key: 'plastic', title: head('พลาสติก กันชื้น', 'ปริมาณ (ตร.ม.)'), width: 80, get: r => slabRowCalc(r).plastic },
                        { kind: 'select', key: 'barSize', title: head('เหล็กเสริม', 'ขนาด'), width: 80, options: sizeOptions,
                            get: r => r.barSize, set: (r, v) => ({ ...r, barSize: v }) },
                        { kind: 'select', key: 'layers', title: head('เหล็กเสริม', 'วางเหล็ก (ชั้น)'), width: 70, options: layerOptions,
                            get: r => String(r.layers), set: (r, v) => ({ ...r, layers: Number(v) }) },
                        { kind: 'number', key: 'spacing', title: head('เหล็กเสริม', 'ระยะห่าง (ม.)'), width: 70,
                            get: r => r.spacing, set: (r, v) => ({ ...r, spacing: v }) },
                        { kind: 'calc', key: 'barLength', title: head('เหล็กเสริม', 'รวม (ม.)'), width: 80, get: r => slabRowCalc(r).barLength },
                        { kind: 'calc', key: 'weight', title: head('เหล็กเสริม', 'น้ำหนัก (กก.)'), width: 80, get: r => slabRowCalc(r).weight },
                        { kind: 'calc', key: 'concrete', title: head('คอนกรีต โครงสร้าง', '(ลบ.ม.)'), width: 80, get: r => slabRowCalc(r).concrete },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>ดินถมกลับ = กว้าง × ยาว × ถมลึก → BOQ 9 ข้อ 2) ถมดินกลับ</li>
                    <li>ทรายหยาบ = กว้าง × ยาว × หนา × 1.25 (เผื่อ 25%) → BOQ 9 ข้อ 3) (BOQ เผื่ออีก 30%)</li>
                    <li>พลาสติกกันชื้น = กว้าง × ยาว → BOQ 9 ข้อ 4) (BOQ เผื่อ 30%)</li>
                    <li>เหล็กเสริม รวม (ม.) = กว้าง × ยาว ÷ ระยะห่าง × 2 ทิศทาง × จำนวนชั้น → BOQ 9 ข้อ 5) แยกแถวตามขนาดเหล็ก + ลวดผูกเหล็ก 3%</li>
                    <li>คอนกรีตโครงสร้าง = กว้าง × ยาว × หนา → BOQ 9 ข้อ 6)</li>
                    <li>ท่อน้ำทิ้ง (BOQ 9 ข้อ 1) คำนวณจากโปรแกรมท่อน้ำทิ้ง</li>
                </ul>
            </SheetCard>
        </CalculatorShell>
    );
}
