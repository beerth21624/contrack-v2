'use client';

import { Checkbox } from 'antd';
import {
    landInspection, lineTotal, LAND_INSPECTION_CHECKLIST, type CostLine,
} from '@/domain/calculators/land-inspection';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, InputTextField, SheetCard } from '@/components/sheet/SheetFields';
import { TextCell, formatNumber } from '@/components/sheet/NumberCell';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

/** Rows 8–11 of the Excel sheet keep their fixed label; rows added after them are free text. */
const FIXED_ROWS = 4;

export default function LandInspectionPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(landInspection);

    return (
        <CalculatorShell def={landInspection} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title="ข้อมูลโครงการ">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <InputTextField label="ชื่อโครงการ" value={input.projectName} onChange={v => update({ projectName: v })} />
                    <InputTextField label="จังหวัด" value={input.province} onChange={v => update({ province: v })} />
                    <InputTextField label="วันที่เข้าสำรวจ" value={input.surveyDate} placeholder="วว/ดด/ปปปป"
                        onChange={v => update({ surveyDate: v })} />
                    <InputTextField label="ผู้ตรวจสอบ" value={input.inspector} onChange={v => update({ inspector: v })} />
                </div>
            </SheetCard>

            <SheetCard title="รายการค่าใช้จ่าย">
                <EditableTable<CostLine>
                    rows={input.items}
                    onChange={items => update({ items })}
                    lockedRows={FIXED_ROWS}
                    newRow={() => ({ label: '', qty: 1, unit: '', unitPrice: 0 })}
                    addLabel="+ เพิ่มรายการ"
                    columns={[
                        {
                            kind: 'label', key: 'label', title: 'รายการค่าใช้จ่าย',
                            get: (r, i) => i < FIXED_ROWS
                                ? r.label
                                : <TextCell value={r.label} placeholder="ชื่อรายการ"
                                    onCommit={v => update(p => ({ ...p, items: p.items.map((x, j) => j === i ? { ...x, label: v ?? '' } : x) }))} />,
                        },
                        { kind: 'number', key: 'qty', title: 'จำนวน', width: 90, get: r => r.qty, set: (r, v) => ({ ...r, qty: v }) },
                        { kind: 'text', key: 'unit', title: 'หน่วย', width: 80, get: r => r.unit, set: (r, v) => ({ ...r, unit: v }) },
                        { kind: 'number', key: 'unitPrice', title: 'ราคาต่อหน่วย', width: 120, get: r => r.unitPrice, set: (r, v) => ({ ...r, unitPrice: v }) },
                        { kind: 'calc', key: 'total', title: 'รวม', width: 120, get: r => lineTotal(r) },
                        { kind: 'text', key: 'note', title: 'หมายเหตุ', width: 160, get: r => r.note ?? '', set: (r, v) => ({ ...r, note: v || undefined }) },
                    ]}
                />
                <div className="mt-3 max-w-md ml-auto">
                    <CalcField label="ต้นทุนรวม" value={outputs.total} unit="บาท" strong />
                </div>
                <p className="mt-2 text-[12px] text-gray-500">
                    หมายเหตุ: ราคานี้เป็นตัวอย่างเบื้องต้น สามารถปรับจำนวน / หน่วย / ราคาต่อหน่วย ตามพื้นที่จริงได้ —
                    ยอด {formatNumber(outputs.total)} บาท ส่งเข้า BOQ แถว &quot;ค่าตรวจสอบที่ดิน&quot; (ช่องค่าแรง, 1 เหมา)
                </p>
            </SheetCard>

            <SheetCard title="เอกสารสำรวจหน้างาน (Checklist)">
                <div className="flex flex-col gap-2">
                    {LAND_INSPECTION_CHECKLIST.map((q, i) => {
                        const a = input.checklist[i] ?? { done: false, note: '' };
                        const setAnswer = (patch: Partial<typeof a>) => update(p => ({
                            ...p,
                            checklist: LAND_INSPECTION_CHECKLIST.map((_, j) =>
                                j === i ? { ...a, ...patch } : (p.checklist[j] ?? { done: false, note: '' })),
                        }));
                        return (
                            <div key={q} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3">
                                <Checkbox checked={a.done} onChange={e => setAnswer({ done: e.target.checked })}>
                                    {i + 1}. {q}
                                </Checkbox>
                                <div className="border-b border-gray-200">
                                    <TextCell value={a.note} placeholder="บันทึก" onCommit={v => setAnswer({ note: v ?? '' })} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </SheetCard>
        </CalculatorShell>
    );
}
