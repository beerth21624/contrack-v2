'use client';

import {
    demolition, lineTotal, DEMOLITION_FIXED_ITEMS, type DemolitionLine,
} from '@/domain/calculators/demolition';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { TextCell, formatNumber } from '@/components/sheet/NumberCell';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

/** Rows 4–10 of the Excel sheet keep their fixed label / unit / hint; rows added after them are free text. */
const FIXED_ROWS = DEMOLITION_FIXED_ITEMS.length;

export default function DemolitionPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(demolition);

    const setText = (i: number, patch: Partial<DemolitionLine>) =>
        update(p => ({ ...p, items: p.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

    /** Fixed Excel rows show their text as a label; added rows get a text input. */
    function cell(field: 'label' | 'unit' | 'check', placeholder: string, r: DemolitionLine, i: number) {
        if (i < FIXED_ROWS) return r[field];
        return <TextCell value={r[field]} placeholder={placeholder} onCommit={v => setText(i, { [field]: v ?? '' })} />;
    }

    return (
        <CalculatorShell def={demolition} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title="รายการงานรื้อถอน">
                <EditableTable<DemolitionLine>
                    rows={input.items}
                    onChange={items => update({ items })}
                    lockedRows={FIXED_ROWS}
                    newRow={() => ({ label: '', unit: '', qty: 0, rate: 0, check: '' })}
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
        </CalculatorShell>
    );
}
