'use client';

import { Checkbox } from 'antd';
import {
    landInspection, lineTotal, LAND_INSPECTION_CHECKLIST, type ChecklistAnswer, type CostLine, type LandInspectionInput,
} from '@/domain/calculators/land-inspection';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, InputTextField, SheetCard } from '@/components/sheet/SheetFields';
import { TextCell, formatNumber } from '@/components/sheet/NumberCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { EmptyState, ResultSummary } from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';

/** Rows 8–11 of the Excel sheet keep their fixed label; rows added after them are free text. */
const FIXED_ROWS = 4;
const NO_ANSWER: ChecklistAnswer = { done: false, note: '' };
const newCostLine = (): CostLine => ({ label: '', qty: 1, unit: '', unitPrice: 0 });

type Calc = UseCalculator<LandInspectionInput>;

export default function LandInspectionPage() {
    const calc = useCalculator(landInspection);
    const inJourney = useJourneyMode();
    const { input, update, reset, outputs, result, isDefault } = calc;

    return (
        <CalculatorShell def={landInspection} result={result} isDefault={isDefault} onReset={reset}>
            {inJourney ? <JourneyView calc={calc} /> : (
                <>
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
                        <CostTable calc={calc} />
                        <div className="mt-3 max-w-md ml-auto">
                            <CalcField label="ต้นทุนรวม" value={outputs.total} unit="บาท" strong />
                        </div>
                        <p className="mt-2 text-[12px] text-gray-500">
                            หมายเหตุ: ราคานี้เป็นตัวอย่างเบื้องต้น สามารถปรับจำนวน / หน่วย / ราคาต่อหน่วย ตามพื้นที่จริงได้ —
                            ยอด {formatNumber(outputs.total)} บาท ส่งเข้า BOQ แถว &quot;ค่าตรวจสอบที่ดิน&quot; (ช่องค่าแรง, 1 เหมา)
                        </p>
                    </SheetCard>

                    <SheetCard title="เอกสารสำรวจหน้างาน (Checklist)">
                        <Checklist calc={calc} />
                    </SheetCard>
                </>
            )}
        </CalculatorShell>
    );
}

/** Guided journey: what to check on site first, then the cost (quantities up front, prices folded). */
function JourneyView({ calc }: { calc: Calc }) {
    const { input, update, outputs } = calc;
    const total = outputs.total ?? 0;
    return (
        <>
            <SheetCard title="ตรวจที่ดินก่อนเริ่มงาน">
                <p className="mb-3 text-[12px] text-gray-500">
                    เดินดูที่ดินจริงเทียบกับโฉนดและผังบริเวณ ติ๊กข้อที่ตรวจแล้ว และจดสิ่งที่พบไว้ข้างหลัง
                </p>
                <Checklist calc={calc} />
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <InputTextField label="วันที่เข้าสำรวจ" value={input.surveyDate} placeholder="วว/ดด/ปปปป"
                        onChange={v => update({ surveyDate: v })} />
                    <InputTextField label="ผู้ตรวจสอบ" value={input.inspector} onChange={v => update({ inspector: v })} />
                </div>
            </SheetCard>

            <SheetCard title="ค่าใช้จ่ายตรวจสอบที่ดิน">
                {input.items.length === 0
                    ? (
                        <EmptyState text="ยังไม่มีรายการค่าใช้จ่าย เช่น ค่าแรงตรวจ ค่าเดินทาง ค่าที่พัก"
                            addLabel="เพิ่มรายการค่าใช้จ่าย"
                            onAdd={() => update(p => ({ ...p, items: [...p.items, newCostLine()] }))} />
                    )
                    : (
                        <>
                            <p className="mb-2 text-[12px] text-gray-500">ใส่จำนวนวัน / เที่ยว / คืน ที่ใช้จริง ราคาต่อหน่วยตั้งไว้ให้แล้ว</p>
                            <EditableTable<CostLine>
                                rows={input.items}
                                onChange={items => update({ items })}
                                canDelete={false}
                                columns={[
                                    { kind: 'label', key: 'label', title: 'รายการ', get: r => r.label || 'รายการใหม่' },
                                    { kind: 'number', key: 'qty', title: 'จำนวน', width: 90, get: r => r.qty, set: (r, v) => ({ ...r, qty: v }) },
                                    { kind: 'label', key: 'unit', title: 'หน่วย', width: 70, get: r => r.unit },
                                    { kind: 'calc', key: 'total', title: 'รวม (บาท)', width: 120, get: r => lineTotal(r) },
                                ]}
                            />
                        </>
                    )}
            </SheetCard>

            <AdvancedSection title="ราคาต่อหน่วยและรายการเพิ่มเติม" hint="ตั้งไว้ให้แล้ว แก้เมื่อราคาพื้นที่ต่างไป">
                <CostTable calc={calc} />
            </AdvancedSection>

            <ResultSummary items={[{ label: 'ค่าตรวจสอบที่ดินรวม', value: total, unit: 'บาท', digits: 0 }]} />
        </>
    );
}

/** The full cost table of the sheet (rows 8–11 plus added rows). */
function CostTable({ calc }: { calc: Calc }) {
    const { input, update } = calc;
    return (
        <EditableTable<CostLine>
            rows={input.items}
            onChange={items => update({ items })}
            lockedRows={FIXED_ROWS}
            newRow={newCostLine}
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
    );
}

/** The 5 questions of the site-inspection checklist, each with a tick and a note. */
function Checklist({ calc }: { calc: Calc }) {
    const { input, update } = calc;
    return (
        <div className="flex flex-col gap-2">
            {LAND_INSPECTION_CHECKLIST.map((q, i) => {
                const a = input.checklist[i] ?? NO_ANSWER;
                // Merge into the latest stored answer, not the one captured at render time.
                const setAnswer = (patch: Partial<ChecklistAnswer>) => update(p => ({
                    ...p,
                    checklist: LAND_INSPECTION_CHECKLIST.map((_, j) => {
                        const prev = p.checklist[j] ?? NO_ANSWER;
                        return j === i ? { ...prev, ...patch } : prev;
                    }),
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
    );
}
