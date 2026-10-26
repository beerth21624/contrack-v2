'use client';

// Guided-journey view of the pedestal sheet: one card per pedestal type, each standing on a footing type of
// the footing level. Same input and calculation as the Excel-mirror table.
import { Button, Popconfirm } from 'antd';
import { totalKg, type FootingRow } from '@/domain/calculators/footing';
import {
    footingRefFor, newPedestalRow, pedestalRow, pedestalTotals, pedestalsForFootings, PEDESTAL_BAR_SIZES, type PedestalRow,
} from '@/domain/calculators/pedestal';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, BarField, ChoiceButtons, EmptyState, JSelect, JText, PlanCard, PlanField, PlanGroup, PlanNumber, ResultSummary,
    isPositive, planChecks, removeAt, resultText,
} from '@/components/sheet/journey';

const label = (r: PedestalRow, i: number) => (r.name.trim() === '' ? `แบบที่ ${i + 1}` : r.name.trim());
const footingLabel = (f: FootingRow, i: number) => (f.name.trim() === '' ? `ฐานแบบที่ ${i + 1}` : f.name.trim());

const L = {
    footing: 'ตั้งอยู่บนฐานราก', count: 'จำนวนต้น', width: 'ความกว้าง', length: 'ความยาว', height: 'ความสูง',
    main: 'เหล็กยืน', stirrup: 'เหล็กปลอก',
} as const;

const checksOf = (r: PedestalRow, onFooting: boolean) => planChecks([
    { label: L.footing, ok: onFooting },
    { label: L.count, ok: isPositive(r.count) },
    { label: L.width, ok: isPositive(r.width) },
    { label: L.length, ok: isPositive(r.length) },
    { label: L.height, ok: isPositive(r.height) },
    { label: L.main, ok: isPositive(r.mainBarCount) && r.mainBarSize !== '' },
    { label: L.stirrup, ok: isPositive(r.stirrupSpacing) && r.stirrupSize !== '' },
// The footing, count and bars come pre-filled on a new pedestal: only its own size marks it as started.
], [r.width, r.length, r.height, r.mainBarCount].some(isPositive));

export function PedestalJourney({ rows, onChange, footings, footingSkipped, footingOutputs, backfill }: {
    rows: PedestalRow[];
    onChange: (rows: PedestalRow[]) => void;
    /** Footing types of the footing level (pedestal rows refer to them by index). */
    footings: FootingRow[];
    /** The footing level is marked "ไม่มีในโครงการนี้". */
    footingSkipped: boolean;
    footingOutputs: Record<string, number> | undefined;
    backfill: number | undefined;
}) {
    const t = pedestalTotals(rows, footingOutputs);
    const set = (i: number, patch: Partial<PedestalRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const add = () => onChange([...rows, newPedestalRow(rows, footings)]);

    if (footings.length === 0 || footingSkipped) {
        return (
            <EmptyState text={<>
                {footingSkipped ? 'ขั้นตอนฐานรากระบุว่า "ไม่มีในโครงการนี้"' : 'ยังไม่มีฐานราก'} — เสาตอม่อตั้งอยู่บนฐานราก
                กรอกฐานรากแต่ละแบบในขั้นตอนฐานรากก่อน แล้วกลับมาที่ขั้นตอนนี้
            </>} goToLevel="footing">
                {rows.length > 0 && (
                    <div className="mt-1 text-[12px] text-orange-600">
                        ยังมีเสาตอม่อค้างอยู่ {rows.length} แบบ (คอนกรีต {formatNumber(t.concrete)} ลบ.ม.) ซึ่งไม่ได้ตั้งบนฐานรากใด
                        <Popconfirm title="ลบเสาตอม่อทั้งหมด?" okText="ลบ" cancelText="ยกเลิก" onConfirm={() => onChange([])}>
                            <Button className="ml-2" size="small" danger>ลบเสาตอม่อทั้งหมด</Button>
                        </Popconfirm>
                    </div>
                )}
            </EmptyState>
        );
    }

    if (rows.length === 0) {
        const names = footings.map(footingLabel).join(', ');
        return (
            <EmptyState
                text={<>ยังไม่มีเสาตอม่อ — ปกติฐานรากแต่ละแบบมีเสาตอม่อ 1 แบบ ({names}) ดูขนาดจากรูปขยายตอม่อ</>}
                addLabel={footings.length > 1 ? `เพิ่มเสาตอม่อให้ฐานราก ${names}` : `เพิ่มเสาตอม่อบนฐาน ${names}`}
                onAdd={() => onChange(pedestalsForFootings(footings))} />
        );
    }

    const footingOptions = footings.map((f, i) => ({ value: i, label: footingLabel(f, i) }));

    return (
        <div className="flex flex-col gap-4">
            {rows.map((r, i) => {
                const c = pedestalRow(r, footingRefFor(footingOutputs, r.footing));
                const onFooting = r.footing >= 0 && r.footing < footings.length;
                const k = checksOf(r, onFooting);
                return (
                    <PlanCard key={i} index={i + 1} state={k.state} hasData={k.hasData} missingText={k.missingText}
                        title={`เสาตอม่อ ${label(r, i)}`}
                        result={k.state === 'empty' ? undefined : resultText([
                            { label: 'คอนกรีต', value: c.concrete, unit: 'ลบ.ม.' },
                            { label: 'เหล็ก', value: c.mainKg + c.stirrupKg, unit: 'กก.', digits: 1 },
                        ])}
                        onDelete={() => onChange(removeAt(rows, i))} deleteTitle={`ลบเสาตอม่อ ${label(r, i)}?`}>
                        <PlanGroup title="ตำแหน่งและจำนวน">
                            <PlanField label={L.footing} className="col-span-2">
                                {footingOptions.length <= 5
                                    ? (
                                        <ChoiceButtons<number> size="small" ariaLabel={L.footing} value={onFooting ? r.footing : undefined}
                                            options={footingOptions} onChange={v => set(i, { footing: v })} />
                                    )
                                    : (
                                        <JSelect<number> label="" value={onFooting ? r.footing : undefined} placeholder="เลือกฐาน"
                                            options={footingOptions} width={140} onChange={v => set(i, { footing: v ?? -1 })} />
                                    )}
                            </PlanField>
                            <JText label="ชื่อเสาตอม่อ" value={r.name} placeholder="เช่น C1" onChange={v => set(i, { name: v })} />
                            <PlanNumber label={L.count} value={r.count} unit="ต้น" digits={0} hint="ปกติเท่ากับจำนวนฐาน"
                                onChange={v => set(i, { count: v })} />
                        </PlanGroup>
                        <PlanGroup title="ขนาดเสา (จากรูปขยายตอม่อ)">
                            <PlanNumber label={L.width} value={r.width} unit="ม." range={[0.1, 1.5]} onChange={v => set(i, { width: v })} />
                            <PlanNumber label={L.length} value={r.length} unit="ม." range={[0.1, 1.5]} onChange={v => set(i, { length: v })} />
                            <PlanNumber label={L.height} value={r.height} unit="ม." range={[0.1, 4]} hint="จากหลังฐานรากถึงคานคอดิน"
                                onChange={v => set(i, { height: v })} />
                        </PlanGroup>
                        <PlanGroup title="เหล็กเสริม ต่อ 1 ต้น" hint="เช่น 4-DB12 ปลอก RB6 @0.15" layout="wide">
                            <BarField label={L.main} sizes={PEDESTAL_BAR_SIZES} size={r.mainBarSize} onSize={v => set(i, { mainBarSize: v })}
                                amount={r.mainBarCount} onAmount={v => set(i, { mainBarCount: v })} />
                            <BarField label={L.stirrup} sizes={PEDESTAL_BAR_SIZES} size={r.stirrupSize} onSize={v => set(i, { stirrupSize: v })}
                                amount={r.stirrupSpacing} onAmount={v => set(i, { stirrupSpacing: v })} amountLabel="ระยะห่าง @"
                                amountUnit="ม." amountDigits={2} presets={[0.15, 0.2]} range={[0.05, 0.5]} />
                        </PlanGroup>
                    </PlanCard>
                );
            })}

            <AddButton label="เพิ่มเสาตอม่อแบบถัดไป" onClick={add} />

            <ResultSummary items={[
                { label: 'คอนกรีตเสาตอม่อ', value: t.concrete, unit: 'ลบ.ม.' },
                { label: 'เหล็กเสริม', value: totalKg(t.rebar), unit: 'กก.' },
                { label: 'ไม้แบบ', value: t.formwork, unit: 'ตร.ม.' },
            ]} note={backfill === undefined ? undefined
                : `ดินถมกลับรอบฐานราก ${formatNumber(backfill)} ลบ.ม. (หักคอนกรีตฐานรากและเสาตอม่อแล้ว)`} />
        </div>
    );
}
