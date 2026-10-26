'use client';

import {
    demolition, lineTotal, DEMOLITION_FIXED_ITEMS, type DemolitionInput, type DemolitionLine,
} from '@/domain/calculators/demolition';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { TextCell, formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, JText, PlanCard, PlanNumber, ResultSummary, isPositive, patchAt, planChecks, removeAt,
} from '@/components/sheet/journey';
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
            {inJourney ? <JourneyView calc={calc} /> : (
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
                            { kind: 'number', key: 'rate', title: 'ค่ารื้อต่อหน่วย', width: 110, get: r => r.rate, set: (r, v) => ({ ...r, rate: v }) },
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

/** A demolition kind is "on site" once it has a quantity or a rate; it costs something once it has both. */
const lineChecks = (l: DemolitionLine) => planChecks([
    { label: 'ปริมาณ', ok: isPositive(l.qty) },
    { label: 'ค่ารื้อต่อหน่วย', ok: isPositive(l.rate) },
]);

/**
 * Guided journey: the kinds of demolition listed as cards, the user fills only the ones on site (a kind left
 * empty stays grey). Excel has no rates, so the per-unit price stays on each card (hiding it would leave the
 * level at 0 บาท); a quantity without a rate is flagged.
 */
function JourneyView({ calc }: { calc: UseCalculator<DemolitionInput> }) {
    const { input, update, outputs } = calc;
    const total = outputs.total ?? 0;
    const setLine = (i: number, patch: Partial<DemolitionLine>) => update(p => ({ ...p, items: patchAt(p.items, i, patch) }));
    const checks = input.items.map(lineChecks);
    return (
        <>
            <SheetCard title="งานรื้อถอนในที่ดิน">
                <p className="mb-3 text-[12px] text-gray-500">
                    กรอกเฉพาะงานที่มีจริง — ค่ารื้อต่อหน่วยรวมค่าแรง เครื่องมือ และค่าใช้จ่ายเบื้องต้น
                </p>
                <div className="flex flex-col gap-2">
                    {input.items.map((r, i) => {
                        const k = checks[i] ?? lineChecks(r);
                        const fixed = i < FIXED_ROWS;
                        const unit = r.unit === '' ? 'หน่วย' : r.unit;
                        return (
                            <PlanCard key={i} index={i + 1} state={k.state} hasData={k.hasData} compact scope={{ listKey: 'items', itemIndex: i }}
                                missingText={k.missingText === undefined ? undefined
                                    : `${k.missingText} — รายการนี้ยังคิดเป็น 0 บาท`}
                                title={fixed
                                    ? <>{r.label}{r.check !== '' && <span className="ml-2 text-[12px] font-normal text-gray-500">ดู: {r.check}</span>}</>
                                    : (r.label === '' ? 'งานรื้ออื่น' : r.label)}
                                result={isPositive(lineTotal(r)) ? `รวม ${formatNumber(lineTotal(r), 0)} บาท` : undefined}
                                onDelete={fixed ? undefined : () => update(p => ({ ...p, items: removeAt(p.items, i) }))}
                                deleteTitle={`ลบ${r.label === '' ? 'รายการนี้' : r.label}?`}>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                                    {!fixed && (
                                        <>
                                            <JText label="ชื่องาน" value={r.label} placeholder="เช่น รื้อบ่อเกรอะเดิม" onChange={v => setLine(i, { label: v })} />
                                            <JText label="หน่วย" value={r.unit} placeholder="เช่น ตร.ม." onChange={v => setLine(i, { unit: v })} />
                                        </>
                                    )}
                                    <PlanNumber label="ปริมาณ" value={r.qty} unit={unit}
                                        onChange={v => setLine(i, { qty: v })} />
                                    <PlanNumber label="ค่ารื้อต่อหน่วย" value={r.rate} unit={`บาท/${unit}`} digits={0} fieldKey="rate"
                                        onChange={v => setLine(i, { rate: v })} />
                                </div>
                            </PlanCard>
                        );
                    })}
                </div>
                <div className="mt-3">
                    <AddButton label="เพิ่มงานรื้ออื่น" onClick={() => update(p => ({ ...p, items: [...p.items, newLine()] }))} />
                </div>
            </SheetCard>

            {/* The money is มูลค่าขั้นตอนนี้ in the bottom bar; here only what is counted. */}
            <ResultSummary
                items={total > 0 ? [{
                    label: 'งานรื้อถอน', value: input.items.filter(r => isPositive(lineTotal(r))).length, unit: 'รายการ', digits: 0,
                    detail: 'รวมเป็นเหมา 1 งานใน BOQ',
                }] : []}
                empty={<>ยังไม่มีงานรื้อถอน — หากที่ดินว่างและไม่มีสิ่งที่ต้องรื้อ กด &quot;ไม่มีในโครงการนี้&quot; ด้านล่าง</>} />
        </>
    );
}
