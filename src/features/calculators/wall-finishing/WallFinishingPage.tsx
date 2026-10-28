'use client';

import {
    wallFinishing, wallFinishingArea, wallFinishingKind, wallFinishingLength, newMouldingRow, newSlatRow, replaceRowsOfKind,
    setMouldingLength, MOULDING_0_1, MOULDING_0_3, SLAT_WALL, WALL_FINISHING_CODES, WALL_FINISHING_ITEMS,
    type WallFinishingInput, type WallFinishingKind, type WallFinishingRow,
} from '@/domain/calculators/wall-finishing';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, ChoiceButtons, EmptyState, FillProgress, NameInput, PlanCard, PlanField, PlanNumber, ResultSummary, countFill,
    fillState, insertAfter, removeAt, type FillState,
} from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

/** Journey: the two moulding sizes in plain words. */
const MOULDING_OPTIONS = [
    { value: MOULDING_0_3, label: 'บัวใหญ่ 0.30 × 0.10 ม.' },
    { value: MOULDING_0_1, label: 'บัวเล็ก 0.10 × 0.10 ม.' },
];

/** Plan values an item card still needs. */
function missingOf(r: WallFinishingRow): string[] {
    if (wallFinishingKind(r) === 'moulding') return (wallFinishingLength(r) ?? 0) > 0 ? [] : ['ความยาว'];
    const out: string[] = [];
    if (!(r.width > 0)) out.push('กว้าง');
    if (!(r.length > 0)) out.push('สูง');
    return out;
}
const stateOf = (r: WallFinishingRow): FillState =>
    fillState([missingOf(r).length === 0], r.width > 0 || r.length > 0);

/** Journey mode: mouldings (metres) and slat-clad walls (m²) read off the elevations, one card per item. */
function WallFinishingJourney({ input, onChange, outputs }: {
    input: WallFinishingInput; onChange: (edit: (prev: WallFinishingInput) => WallFinishingInput) => void; outputs: Record<string, number>;
}) {
    const rowsOf = (kind: WallFinishingKind) => input.rows.filter(r => wallFinishingKind(r) === kind);
    const setKind = (kind: WallFinishingKind) => (rows: WallFinishingRow[]) => onChange(p => replaceRowsOfKind(p, kind, rows));
    const mouldings = rowsOf('moulding');
    const slats = rowsOf('slat');
    const others = rowsOf('other');
    const addMoulding = () => onChange(p => ({ rows: [...p.rows, newMouldingRow()] }));
    const addSlat = () => onChange(p => ({ rows: [...p.rows, newSlatRow()] }));
    const setRow = (i: number, edit: (r: WallFinishingRow) => WallFinishingRow) =>
        onChange(p => ({ rows: p.rows.map((r, j) => (j === i ? edit(r) : r)) }));
    const duplicate = (i: number) => onChange(p => {
        const r = p.rows[i];
        return r ? { rows: insertAfter(p.rows, i, { ...r }) } : p;
    });
    const remove = (i: number) => onChange(p => ({ rows: removeAt(p.rows, i) }));
    // Cards address rows by their place in the whole list (mouldings and slat walls are shown apart).
    const indexed = input.rows.map((r, i) => ({ r, i }));
    const states = [...mouldings, ...slats].map(stateOf);

    const mouldingCard = ({ r, i }: { r: WallFinishingRow; i: number }, n: number) => {
        const state = stateOf(r);
        const length = wallFinishingLength(r) ?? 0;
        return (
            <PlanCard key={i} index={n} state={state} scope={{ listKey: 'rows', itemIndex: i }}
                title={<NameInput value={r.location} placeholder="ตำแหน่ง เช่น ผนังภายนอก" ariaLabel={`ตำแหน่งบัวที่ ${String(n)}`}
                    onChange={location => setRow(i, x => ({ ...x, location }))} />}
                result={length > 0 ? `${formatNumber(length)} ม.` : undefined}
                onDuplicate={() => duplicate(i)} onDelete={() => remove(i)} hasData={length > 0}
                deleteTitle="ลบบัวนี้?" missingText="ยังขาด: ความยาว">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    <PlanField label="ขนาดบัว">
                        <ChoiceButtons ariaLabel="ขนาดบัว" size="small" options={MOULDING_OPTIONS} value={r.item.trim()}
                            onChange={item => setRow(i, x => ({ ...x, item }))} />
                    </PlanField>
                    <PlanNumber label="ความยาวรวม" fieldKey="length" unit="ม." value={length} range={[0.5, 300]}
                        missing={state === 'missing'} hint="รวมทุกช่วง เช่น 6+4.5+2.5"
                        onChange={v => setRow(i, x => setMouldingLength(x, v))} />
                </div>
            </PlanCard>
        );
    };

    const slatCard = ({ r, i }: { r: WallFinishingRow; i: number }, n: number) => {
        const state = stateOf(r);
        const missing = state === 'missing' ? new Set(missingOf(r)) : new Set<string>();
        const area = wallFinishingArea(r) ?? 0;
        return (
            <PlanCard key={i} index={n} state={state} scope={{ listKey: 'rows', itemIndex: i }}
                title={<NameInput value={r.location} placeholder="ตำแหน่ง เช่น ผนังเฉลียง" ariaLabel={`ตำแหน่งผนังระแนงที่ ${String(n)}`}
                    onChange={location => setRow(i, x => ({ ...x, location }))} />}
                result={area > 0 ? `${formatNumber(area)} ตร.ม.` : undefined}
                onDuplicate={() => duplicate(i)} onDelete={() => remove(i)} hasData={r.width > 0 || r.length > 0}
                deleteTitle="ลบผนังระแนงนี้?" missingText={`ยังขาด: ${missingOf(r).join(', ')}`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    <PlanNumber label="กว้าง" fieldKey="width" unit="ม." value={r.width} range={[0.3, 20]} missing={missing.has('กว้าง')}
                        onChange={width => setRow(i, x => ({ ...x, width }))} />
                    <PlanNumber label="สูง" fieldKey="length" unit="ม." value={r.length} range={[0.3, 6]} missing={missing.has('สูง')}
                        onChange={length => setRow(i, x => ({ ...x, length }))} />
                </div>
            </PlanCard>
        );
    };

    if (input.rows.length === 0) {
        return (
            <SheetCard>
                <EmptyState text="ยังไม่มีงานตกแต่งผนัง — ดูรูปด้านว่ามีบัวผนัง หรือผนังกรุไม้ระแนงไหม"
                    note={<>หากแบบไม่มีงานส่วนนี้ กด &quot;ไม่มีในโครงการนี้&quot; ที่แถบด้านล่าง</>}
                    addLabel="เพิ่มบัวผนัง" onAdd={addMoulding}
                    actions={[{ label: 'เพิ่มผนังไม้ระแนง', onClick: addSlat }]} />
            </SheetCard>
        );
    }

    return (
        <>
            {states.length >= 5 && <FillProgress {...countFill(states)} noun="รายการ" />}

            <SheetCard title="บัวผนัง (คิดเป็นความยาว)">
                <div className="flex flex-col gap-2">
                    {indexed.filter(x => wallFinishingKind(x.r) === 'moulding').map((x, k) => mouldingCard(x, k + 1))}
                    <AddButton label="เพิ่มบัวผนัง" onClick={addMoulding} />
                </div>
            </SheetCard>

            <SheetCard title="ผนังกรุไม้ระแนงไฟเบอร์ซีเมนต์ (คิดเป็นพื้นที่)">
                <div className="flex flex-col gap-2">
                    {indexed.filter(x => wallFinishingKind(x.r) === 'slat').map((x, k) => slatCard(x, k + 1))}
                    <AddButton label="เพิ่มผนังไม้ระแนง" onClick={addSlat} />
                </div>
            </SheetCard>

            {others.length > 0 && (
                <SheetCard title="รายการที่ยังไม่ได้เลือกชนิด (ยังไม่นับ)">
                    <EditableTable<WallFinishingRow>
                        rows={others}
                        onChange={setKind('other')}
                        columns={[
                            { kind: 'select', key: 'item', title: 'ชนิด', width: 240,
                                options: [...MOULDING_OPTIONS, { value: SLAT_WALL, label: 'ผนังไม้ระแนง' }],
                                get: r => r.item.trim(), set: (r, v) => ({ ...r, item: v }) },
                            { kind: 'text', key: 'location', title: 'ตำแหน่ง', width: 160,
                                get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                            { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 90,
                                get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                            { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 90,
                                get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        ]}
                    />
                </SheetCard>
            )}

            <ResultSummary
                items={[
                    { label: 'บัวใหญ่ 0.30', value: outputs.R218, unit: 'ม.' },
                    { label: 'บัวเล็ก 0.10', value: outputs.R219, unit: 'ม.' },
                    { label: 'ผนังไม้ระแนง', value: outputs.R220, unit: 'ตร.ม.' },
                ]}
                note="ความยาวบัวและพื้นที่ระแนงนำไปใช้ต่อในขั้นตอนทาสีได้" />
        </>
    );
}

export default function WallFinishingPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(wallFinishing);
    const inJourney = useJourneyMode();

    if (inJourney) {
        return (
            <CalculatorShell def={wallFinishing} result={result} isDefault={isDefault} onReset={reset}>
                <WallFinishingJourney input={input} outputs={outputs} onChange={next => update(next)} />
            </CalculatorShell>
        );
    }

    return (
        <CalculatorShell def={wallFinishing} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title=": ตารางคำนวณปริมาณวัสดุตกแต่งผิวผนัง">
                <EditableTable<WallFinishingRow>
                    rows={input.rows}
                    onChange={rows => update({ rows })}
                    newRow={() => ({ code: '', item: '', width: 0, length: 0, location: '' })}
                    addLabel="+ เพิ่มรายการ"
                    columns={[
                        { kind: 'select', key: 'code', title: 'สัญลักษณ์', width: 80,
                            options: WALL_FINISHING_CODES.map(v => ({ value: v })),
                            get: r => r.code, set: (r, v) => ({ ...r, code: v }) },
                        { kind: 'select', key: 'item', title: 'รายการ', width: 300,
                            options: WALL_FINISHING_ITEMS.map(v => ({ value: v })),
                            get: r => r.item.trim(), set: (r, v) => ({ ...r, item: v }) },
                        { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 80,
                            get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 80,
                            get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'calc', key: 'total-length', title: 'ยาว (ม.)', width: 80, get: r => wallFinishingLength(r) },
                        { kind: 'calc', key: 'area', title: 'พื้นที่ (ตร.ม.)', width: 90, get: r => wallFinishingArea(r) },
                        { kind: 'text', key: 'location', title: 'ตำแหน่ง', width: 130,
                            get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>บัวตกแต่งผนัง: ยาว (ม.) = กว้าง + ยาว (ค่าตัวอย่างในเทมเพลตกรอกกว้าง = 0) → ส่งเข้า BOQ เป็นเมตร</li>
                    <li>กรุไม้ระแนงไฟเบอร์ซีเมนต์บอร์ด: พื้นที่ (ตร.ม.) = กว้าง × ยาว → ส่งเข้า BOQ และงานทาสีผนัง - ไม้ระแนง</li>
                </ul>
            </SheetCard>

            <SheetCard title="สรุปปริมาณ (ส่งเข้า BOQ หมวด 22)">
                <CalcField label={MOULDING_0_3} value={outputs.R218} unit="ม." strong />
                <CalcField label={MOULDING_0_1} value={outputs.R219} unit="ม." strong />
                <CalcField label={SLAT_WALL} value={outputs.R220} unit="ตร.ม." strong />
                <p className="mt-2 text-[12px] text-gray-500">
                    แต่ละแถว BOQ (บัว ขนาด 0.3 / 0.1) รวมความยาวของบัวขนาดของตัวเอง
                </p>
            </SheetCard>
        </CalculatorShell>
    );
}
