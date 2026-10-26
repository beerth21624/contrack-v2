'use client';

// Journey-mode body of the slab-on-grade level: one card per panel read off the slab plan, the sub-base
// (backfill depth, sand bed) folded away, and a short result at the end. Same input and formulas as /calc.
import {
    newSlabRow, slabRowCalc, SLAB_BAR_SIZES, SLAB_LAYERS, SLAB_NAMES, type SlabOnGradeInput, type SlabRow,
} from '@/domain/calculators/slab-on-grade';
import { EditableTable } from '@/components/sheet/EditableTable';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, BarField, ChoiceButtons, EmptyState, FillProgress, PlanCard, PlanField, PlanGroup, PlanNumber, ResultSummary,
    blankIfZero, countFill, insertAfter, isPositive, planChecks, rebarSummaryItem, removeAt, resultText,
} from '@/components/sheet/journey';

const nameOptions = SLAB_NAMES.map(v => ({ value: v as string, label: v }));
const layerOptions = SLAB_LAYERS.map(v => ({ value: v as number, label: `${v} ชั้น` }));
/** Show the fill progress only once the list is long enough to lose track of. */
const PROGRESS_FROM = 5;

const L = { width: 'ความกว้าง', length: 'ความยาว', thickness: 'ความหนา', bars: 'เหล็กเสริม' } as const;

const checksOf = (r: SlabRow) => planChecks([
    { label: L.width, ok: isPositive(r.width) },
    { label: L.length, ok: isPositive(r.length) },
    { label: L.thickness, ok: isPositive(r.thickness) },
    { label: L.bars, ok: r.barSize !== '' && isPositive(r.spacing) && isPositive(r.layers) },
// Thickness and bars are copied from the previous panel: the panel's own size marks it as started.
], isPositive(r.width) || isPositive(r.length));

export function SlabOnGradeJourney({ input, outputs, onChange }: {
    input: SlabOnGradeInput; outputs: Record<string, number>; onChange: (slabs: SlabRow[]) => void;
}) {
    const rows = input.slabs;
    const set = (i: number, patch: Partial<SlabRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const add = () => onChange([...rows, newSlabRow(rows[rows.length - 1])]);
    /** A panel of the same size and spec (each panel is its own card). */
    const duplicate = (r: SlabRow, i: number) => onChange(insertAfter(rows, i, { ...r }));

    if (rows.length === 0) {
        return (
            <EmptyState text="ยังไม่มีพื้น — ดูแปลนพื้น แล้วเพิ่มทีละผืน (กว้าง × ยาว × หนา และเหล็กเสริม)"
                addLabel="เพิ่มพื้นผืนแรก" onAdd={add} />
        );
    }

    const checks = rows.map(checksOf);

    return (
        <div className="flex flex-col gap-3">
            {rows.length >= PROGRESS_FROM && (
                <FillProgress {...countFill(checks.map(c => c.state))} noun="ผืน" doneText="ครบทุกผืนแล้ว" />
            )}

            {rows.map((r, i) => {
                const c = slabRowCalc(r);
                const k = checks[i] ?? checksOf(r);
                return (
                    <PlanCard key={i} index={i + 1} state={k.state} hasData={k.hasData} missingText={k.missingText} compact
                        title={`ผืนที่ ${String(i + 1)}`}
                        result={k.state === 'empty' ? undefined : resultText([
                            { label: 'คอนกรีต', value: c.concrete, unit: 'ลบ.ม.' },
                            { label: 'เหล็ก', value: c.weight, unit: 'กก.', digits: 1 },
                        ])}
                        onDuplicate={() => duplicate(r, i)}
                        onDelete={() => onChange(removeAt(rows, i))} deleteTitle={`ลบพื้นผืนที่ ${i + 1}?`}>
                        <PlanGroup title="ขนาดผืน (จากแปลนพื้น)">
                            <PlanField label="ชื่อพื้น">
                                <ChoiceButtons<string> size="small" ariaLabel="ชื่อพื้น" value={r.name === '' ? undefined : r.name}
                                    options={nameOptions} onChange={v => set(i, { name: v })} />
                            </PlanField>
                            <PlanNumber label={L.width} value={r.width} unit="ม." onChange={v => set(i, { width: v })} />
                            <PlanNumber label={L.length} value={r.length} unit="ม." onChange={v => set(i, { length: v })} />
                            <PlanNumber label={L.thickness} value={r.thickness} unit="ม." presets={[0.1, 0.12, 0.15]} range={[0.05, 0.4]}
                                onChange={v => set(i, { thickness: v })} />
                        </PlanGroup>
                        <PlanGroup title="เหล็กเสริม" hint="เช่น RB9 @0.20 ม. 2 ชั้น" layout="wide">
                            <BarField label={L.bars} sizes={SLAB_BAR_SIZES} size={r.barSize} onSize={v => set(i, { barSize: v })}
                                amount={r.spacing} onAmount={v => set(i, { spacing: v })} amountLabel="ระยะห่าง @" amountUnit="ม."
                                amountDigits={2} presets={[0.15, 0.2]} range={[0.05, 0.5]} />
                            <PlanField label="วางเหล็ก">
                                <ChoiceButtons<number> size="small" ariaLabel="วางเหล็ก" value={r.layers} options={layerOptions}
                                    onChange={v => set(i, { layers: v })} />
                            </PlanField>
                        </PlanGroup>
                    </PlanCard>
                );
            })}

            <AddButton label="เพิ่มพื้นอีกผืน" onClick={add} />

            <AdvancedSection title="ดินถมใต้พื้น และทรายรองพื้น">
                <EditableTable<SlabRow>
                    rows={rows}
                    onChange={onChange}
                    canDelete={false}
                    columns={[
                        { kind: 'label', key: 'panel', title: 'พื้น', width: 120,
                            get: (r, i) => `${String(i + 1)}. ${r.name} ${formatNumber(r.width)} × ${formatNumber(r.length)} ม.` },
                        { kind: 'number', key: 'fillDepth', title: 'ดินถมกลับใต้พื้น ลึก (ม.)', width: 110,
                            get: r => r.fillDepth, set: (r, v) => ({ ...r, fillDepth: v }) },
                        { kind: 'calc', key: 'backfill', title: 'ดินถม (ลบ.ม.)', width: 90, get: r => blankIfZero(slabRowCalc(r).backfill) },
                        { kind: 'number', key: 'sandThickness', title: 'ทรายหยาบรองพื้น หนา (ม.)', width: 110,
                            get: r => r.sandThickness, set: (r, v) => ({ ...r, sandThickness: v }) },
                        { kind: 'calc', key: 'sand', title: 'ทราย (ลบ.ม.)', width: 90, get: r => blankIfZero(slabRowCalc(r).sand) },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>คอนกรีต = กว้าง × ยาว × หนา</li>
                    <li>เหล็กเสริม = กว้าง × ยาว ÷ ระยะห่าง × 2 ทิศทาง × จำนวนชั้น (ม.) × น้ำหนักเหล็กต่อเมตร</li>
                    <li>ดินถมกลับ = กว้าง × ยาว × ลึก · ทรายหยาบ = กว้าง × ยาว × หนา + เผื่อ 25% · พลาสติกกันชื้น = กว้าง × ยาว</li>
                </ul>
            </AdvancedSection>

            <ResultSummary
                items={[
                    { label: 'คอนกรีต', value: outputs.concrete ?? 0, unit: 'ลบ.ม.' },
                    rebarSummaryItem(outputs),
                ]}
                minor={[
                    { label: 'ทรายหยาบ', value: outputs.sand ?? 0, unit: 'ลบ.ม.' },
                    { label: 'ดินถมกลับ', value: outputs.backfill ?? 0, unit: 'ลบ.ม.' },
                    { label: 'พลาสติกกันชื้น', value: outputs.plastic ?? 0, unit: 'ตร.ม.' },
                ]}
            />
        </div>
    );
}
