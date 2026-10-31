'use client';

import type { ReactNode } from 'react';
import {
    column, columnRowCalc, COLUMN_BAR_SIZES, COLUMN_NAMES, type ColumnRow,
} from '@/domain/calculators/column';
import { REBAR_SIZES } from '@/domain/boq/slots';
import { EditableTable } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { ColumnJourney } from './ColumnJourney';

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center';
const td = 'border border-gray-200 px-2 py-1 text-[13px] text-right tabular-nums';

/** Column header with the sheet's group header (row 4) above the column label (row 7). */
const head = (group: string, label: string): ReactNode => (
    <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-normal text-gray-500">{group}</span>
        <span>{label}</span>
    </span>
);

const MAIN = 'เหล็กเสริมหลัก';
const STIRRUP = 'เหล็กปลอก';

const nameOptions = COLUMN_NAMES.map(v => ({ value: v }));
const sizeOptions = COLUMN_BAR_SIZES.map(v => ({ value: v }));

/** A new row keeps the previous row's height and bar settings; count and size start empty. */
const newColumn = (prev: ColumnRow | undefined): ColumnRow => ({
    name: '',
    count: 0,
    width: 0,
    depth: 0,
    height: prev?.height ?? 0,
    mainSize: prev?.mainSize ?? 'DB12',
    mainCount: prev?.mainCount ?? 0,
    stirrupSize: prev?.stirrupSize ?? 'RB6',
    stirrupSpacing: prev?.stirrupSpacing ?? 0,
});

export default function ColumnPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(column);
    const inJourney = useJourneyMode();

    if (inJourney) {
        return (
            <CalculatorShell def={column} result={result} isDefault={isDefault} onReset={reset}>
                <ColumnJourney input={input} outputs={outputs} onChange={columns => update({ columns })} />
            </CalculatorShell>
        );
    }

    return (
        <CalculatorShell def={column} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title="สรุปปริมาณงานเสา">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={th} colSpan={REBAR_SIZES.length}>ปริมาณเหล็กเสริมหลัก (กก.)</th>
                                <th className={th} colSpan={REBAR_SIZES.length}>ปริมาณเหล็กปลอก (กก.)</th>
                                <th className={th} rowSpan={2}>ไม้แบบ (ตร.ม.)</th>
                                <th className={th} rowSpan={2}>คอนกรีต โครงสร้าง (ลบ.ม.)</th>
                            </tr>
                            <tr>
                                {REBAR_SIZES.map(s => <th key={`m${s}`} className={th}>{s}</th>)}
                                {REBAR_SIZES.map(s => <th key={`s${s}`} className={th}>{s}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ background: SHEET_COLORS.calc }}>
                                {REBAR_SIZES.map(s => <td key={`m${s}`} className={td}>{formatNumber(outputs[`main.${s}`])}</td>)}
                                {REBAR_SIZES.map(s => <td key={`s${s}`} className={td}>{formatNumber(outputs[`stirrup.${s}`])}</td>)}
                                <td className={td}>{formatNumber(outputs.formwork)}</td>
                                <td className={td}>{formatNumber(outputs.concrete)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </SheetCard>

            <SheetCard title="ข้อมูลเสา">
                <EditableTable<ColumnRow>
                    rows={input.columns}
                    onChange={columns => update({ columns })}
                    newRow={i => newColumn(input.columns[i - 1])}
                    addLabel="+ เพิ่มเสา"
                    columns={[
                        { kind: 'select', key: 'name', title: 'ชื่อเสา', width: 70, options: nameOptions,
                            get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
                        { kind: 'number', key: 'count', title: 'จำนวน เสา (ต้น)', width: 70, digits: 0,
                            get: r => r.count, set: (r, v) => ({ ...r, count: v }) },
                        { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 70, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'depth', title: 'ยาว (ม.)', width: 70, get: r => r.depth, set: (r, v) => ({ ...r, depth: v }) },
                        { kind: 'number', key: 'height', title: 'สูง (ม.)', width: 70, get: r => r.height, set: (r, v) => ({ ...r, height: v }) },
                        { kind: 'select', key: 'mainSize', title: head(MAIN, 'ขนาด'), width: 80, options: sizeOptions,
                            get: r => r.mainSize, set: (r, v) => ({ ...r, mainSize: v }) },
                        { kind: 'number', key: 'mainCount', title: head(MAIN, 'จำนวน (เส้น)'), width: 70, digits: 0,
                            get: r => r.mainCount, set: (r, v) => ({ ...r, mainCount: v }) },
                        { kind: 'calc', key: 'mainBarLength', title: head(MAIN, 'ความยาว /เส้น (ม.)'), width: 80,
                            get: r => columnRowCalc(r).mainBarLength },
                        { kind: 'calc', key: 'mainTotalLength', title: head(MAIN, 'ความยาว รวม (ม.)'), width: 80,
                            get: r => columnRowCalc(r).mainTotalLength },
                        { kind: 'calc', key: 'mainWeight', title: head(MAIN, 'น้ำหนัก (กก.)'), width: 80,
                            get: r => columnRowCalc(r).mainWeight },
                        { kind: 'select', key: 'stirrupSize', title: head(STIRRUP, 'ขนาด'), width: 80, options: sizeOptions,
                            get: r => r.stirrupSize, set: (r, v) => ({ ...r, stirrupSize: v }) },
                        { kind: 'number', key: 'stirrupSpacing', title: head(STIRRUP, 'ระยะห่าง (ม.)'), width: 70,
                            get: r => r.stirrupSpacing, set: (r, v) => ({ ...r, stirrupSpacing: v }) },
                        { kind: 'calc', key: 'stirrupCount', title: head(STIRRUP, 'จำนวน (ปลอก)'), width: 70, digits: 0,
                            get: r => columnRowCalc(r).stirrupCount },
                        { kind: 'calc', key: 'stirrupLength', title: head(STIRRUP, 'ความยาว /เส้น (ม.)'), width: 80,
                            get: r => columnRowCalc(r).stirrupLength },
                        { kind: 'calc', key: 'stirrupTotalLength', title: head(STIRRUP, 'ความยาว รวม (ม.)'), width: 80,
                            get: r => columnRowCalc(r).stirrupTotalLength },
                        { kind: 'calc', key: 'stirrupWeight', title: head(STIRRUP, 'น้ำหนัก (กก.)'), width: 80,
                            get: r => columnRowCalc(r).stirrupWeight },
                        { kind: 'calc', key: 'formwork', title: 'ไม้แบบ (ตร.ม.)', width: 80, get: r => columnRowCalc(r).formwork },
                        { kind: 'calc', key: 'concrete', title: 'คอนกรีต โครงสร้าง (ลบ.ม.)', width: 90, get: r => columnRowCalc(r).concrete },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>สูง (ม.) พิมพ์เอง ไม่ลิงก์กับฐานราก/เสาตอม่อ — ค่าตัวอย่างในเทมเพลต = 0.55 + 3.5 = 4.05 ม.</li>
                    <li>เหล็กเสริมหลัก ความยาว /เส้น = ความสูงเสา; ความยาวรวม = จำนวนเสา × ความยาว /เส้น × จำนวนเส้น</li>
                    <li>เหล็กปลอก จำนวน = ปัดขึ้น (สูง ÷ ระยะห่าง); ความยาว /เส้น = 2 × (กว้าง + ยาว)</li>
                    <li>ไม้แบบ = จำนวนเสา × 2 × (กว้าง + ยาว) × สูง; คอนกรีต = จำนวนเสา × กว้าง × ยาว × สูง → BOQ 11</li>
                    <li>เหล็กเสริมเสาส่งเข้า BOQ หมวด 6 ข้อ 7) เหล็กเสริม - ***เสาชั้น 1 (แยกแถวตามขนาดเหล็ก + ลวดผูกเหล็ก 3%)</li>
                </ul>
            </SheetCard>
        </CalculatorShell>
    );
}
