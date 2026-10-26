'use client';

import type { ReactNode } from 'react';
import {
    demolition, lineTotal, DEMOLITION_FIXED_ITEMS, type DemolitionInput, type DemolitionLine,
} from '@/domain/calculators/demolition';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { TextCell, formatNumber } from '@/components/sheet/NumberCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';

/** Rows 4–10 of the Excel sheet keep their fixed label / unit / hint; rows added after them are free text. */
const FIXED_ROWS = DEMOLITION_FIXED_ITEMS.length;
const newLine = (): DemolitionLine => ({ label: '', unit: '', qty: 0, rate: 0, check: '' });

export default function DemolitionPage() {
    const calc = useCalculator(demolition);
    const inJourney = useJourneyMode();
    const { input, update, reset, outputs, result, isDefault } = calc;

    const setText = (i: number, patch: Partial<DemolitionLine>) =>
        update(p => ({ ...p, items: p.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

    /** Fixed Excel rows show their text as a label; added rows get a text input. */
    function cell(field: 'label' | 'unit' | 'check', placeholder: string, r: DemolitionLine, i: number) {
        if (i < FIXED_ROWS) return r[field];
        return <TextCell value={r[field]} placeholder={placeholder} onCommit={v => setText(i, { [field]: v ?? '' })} />;
    }

    return (
        <CalculatorShell def={demolition} result={result} isDefault={isDefault} onReset={reset}>
            {inJourney ? <JourneyView calc={calc} cell={cell} /> : (
                <SheetCard title="รายการงานรื้อถอน">
                    <EditableTable<DemolitionLine>
                        rows={input.items}
                        onChange={items => update({ items })}
                        lockedRows={FIXED_ROWS}
                        newRow={newLine}
                        addLabel="+ เพิ่มรายการ"
                        columns={[
                            { kind: 'label', key: 'label', title: 'รายการ', get: (r, i) => cell('label', 'ชื่อรายการ', r, i) },
                            { kind: 'label', key: 'unit', title: 'หน่วย', width: 80, get: (r, i) => cell('unit', 'หน่วย', r, i) },
                            { kind: 'number', key: 'qty', title: 'ปริมาณ', width: 100, get: r => r.qty, set: (r, v) => ({ ...r, qty: v }) },
                            { kind: 'number', key: 'rate', title: 'Rate', width: 110, get: r => r.rate, set: (r, v) => ({ ...r, rate: v }) },
                            { kind: 'calc', key: 'total', title: 'รวม', width: 120, get: r => lineTotal(r) },
                            {
                                kind: 'label', key: 'check', title: 'รายละเอียดที่ต้องตรวจสอบ', width: 200,
                                get: (r, i) => cell('check', 'รายละเอียด', r, i),
                            },
                        ]}
                    />
                    <div className="mt-3 max-w-md ml-auto">
                        <CalcField label="รวมทั้งหมด" value={outputs.total} unit="บาท" strong />
                    </div>
                    <p className="mt-2 text-[12px] text-gray-500 italic">
                        Rate = ค่าแรง + เครื่องมือพื้นฐาน + ค่าใช้จ่ายเบื้องต้นต่อหน่วย
                    </p>
                    <p className="mt-1 text-[12px] text-gray-500">
                        {(outputs.total ?? 0) > 0
                            ? <>ยอด {formatNumber(outputs.total)} บาท ส่งเข้า BOQ แถว &quot;งานรื้อถอน&quot; (ช่องค่าแรง, 1 เหมา)</>
                            : <>ยังไม่มีรายการรื้อถอน — BOQ แถว &quot;งานรื้อถอน&quot; เป็น 0 (ไม่มีงานรื้อถอน)</>}
                    </p>
                </SheetCard>
            )}
        </CalculatorShell>
    );
}

/**
 * Guided journey: the kinds of demolition listed, the user fills only the ones on site. Excel has no rates,
 * so the per-unit price stays in the table (hiding it would leave the level at 0 บาท).
 */
function JourneyView({ calc, cell }: {
    calc: UseCalculator<DemolitionInput>;
    cell: (field: 'label' | 'unit' | 'check', placeholder: string, r: DemolitionLine, i: number) => ReactNode;
}) {
    const { input, update, outputs } = calc;
    const total = outputs.total ?? 0;
    return (
        <>
            <SheetCard title="งานรื้อถอนในที่ดิน">
                <p className="mb-2 text-[12px] text-gray-500">
                    กรอกเฉพาะงานที่มีจริง งานที่ไม่มีปล่อยเป็น 0 — ค่ารื้อต่อหน่วยรวมค่าแรง เครื่องมือ และค่าใช้จ่ายเบื้องต้น
                </p>
                <EditableTable<DemolitionLine>
                    rows={input.items}
                    onChange={items => update({ items })}
                    lockedRows={FIXED_ROWS}
                    newRow={newLine}
                    addLabel="เพิ่มงานรื้ออื่น"
                    columns={[
                        {
                            kind: 'label', key: 'label', title: 'งาน',
                            get: (r, i) => (
                                <div>
                                    <div>{cell('label', 'ชื่องาน', r, i)}</div>
                                    {i < FIXED_ROWS && r.check !== '' && <div className="text-[11px] text-gray-400">ดู: {r.check}</div>}
                                </div>
                            ),
                        },
                        { kind: 'number', key: 'qty', title: 'ปริมาณ', width: 100, get: r => r.qty, set: (r, v) => ({ ...r, qty: v }) },
                        { kind: 'label', key: 'unit', title: 'หน่วย', width: 80, get: (r, i) => cell('unit', 'หน่วย', r, i) },
                        { kind: 'number', key: 'rate', title: 'ค่ารื้อต่อหน่วย (บาท)', width: 130, get: r => r.rate, set: (r, v) => ({ ...r, rate: v }) },
                        { kind: 'calc', key: 'total', title: 'รวม (บาท)', width: 120, get: r => lineTotal(r) },
                    ]}
                />
            </SheetCard>

            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <div className="text-[12px] font-semibold text-green-700">ผลลัพธ์</div>
                {total > 0
                    ? (
                        <div className="text-[15px] text-gray-800">
                            งานรื้อถอนรวม <b className="tabular-nums">{formatNumber(total, 0)}</b> บาท (คิดเป็นเหมา 1 งาน)
                        </div>
                    )
                    : (
                        <div className="text-[13px] text-gray-600">
                            ยังไม่มีงานรื้อถอน — ถ้าที่ดินว่างไม่มีอะไรต้องรื้อ กด &quot;ไม่มีงานนี้&quot; ด้านล่างได้เลย
                        </div>
                    )}
            </div>
        </>
    );
}
