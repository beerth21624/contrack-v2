'use client';

// Guided-journey view of the pedestal sheet: one card per pedestal type, each standing on a footing type of
// the footing level. Same input and calculation as the Excel-mirror table.
import Link from 'next/link';
import { Button, Popconfirm } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { totalKg, type FootingRow } from '@/domain/calculators/footing';
import {
    footingRefFor, newPedestalRow, pedestalRow, pedestalTotals, pedestalsForFootings, type PedestalRow,
} from '@/domain/calculators/pedestal';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, ElementCard, EmptyState, JBar, JGroup, JNumber, JSelect, JText, ResultSummary, resultText,
} from '../footing/JourneyParts';

const label = (r: PedestalRow, i: number) => r.name.trim() || `แบบที่ ${i + 1}`;
const footingLabel = (f: FootingRow, i: number) => f.name.trim() || `ฐานแบบที่ ${i + 1}`;

export function PedestalJourney({ rows, onChange, footings, footingSkipped, footingOutputs, backfill }: {
    rows: PedestalRow[];
    onChange: (rows: PedestalRow[]) => void;
    /** Footing types of the footing level (pedestal rows refer to them by index). */
    footings: FootingRow[];
    /** The footing level is marked "ไม่มีงานนี้". */
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
                {footingSkipped ? 'ด่านฐานรากถูกกำหนดว่า "ไม่มีงานนี้"' : 'ยังไม่มีฐานราก'} — เสาตอม่อตั้งอยู่บนฐานราก
                กรอกฐานรากแต่ละแบบในด่านฐานรากก่อน แล้วกลับมาที่ด่านนี้
            </>}>
                <Link href="/journey/footing"><Button type="primary" size="large" icon={<ArrowLeftOutlined />}>ไปด่านฐานราก</Button></Link>
                {rows.length > 0 && (
                    <div className="mt-4 text-[12px] text-orange-600">
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
                actionLabel={footings.length > 1 ? `เพิ่มเสาตอม่อให้ฐานราก ${names}` : `เพิ่มเสาตอม่อบนฐาน ${names}`}
                onAction={() => onChange(pedestalsForFootings(footings))} />
        );
    }

    const footingOptions = footings.map((f, i) => ({ value: i, label: footingLabel(f, i) }));

    return (
        <div className="flex flex-col gap-4">
            {rows.map((r, i) => {
                const c = pedestalRow(r, footingRefFor(footingOutputs, r.footing));
                const onFooting = r.footing >= 0 && r.footing < footings.length;
                return (
                    <ElementCard key={i} title={`เสาตอม่อ ${label(r, i)}`}
                        onDelete={() => onChange(rows.filter((_, j) => j !== i))} deleteTitle={`ลบเสาตอม่อ ${label(r, i)}?`}
                        warning={onFooting ? undefined : 'เลือกฐานรากที่เสาตอม่อนี้ตั้งอยู่ — ความยาวเหล็กยืนคิดจากความหนาและความกว้างของฐานนั้น'}
                        result={resultText([
                            { label: 'คอนกรีต', value: c.concrete, unit: 'ลบ.ม.' },
                            { label: 'เหล็ก', value: c.mainKg + c.stirrupKg, unit: 'กก.' },
                            { label: 'ไม้แบบ', value: c.formwork, unit: 'ตร.ม.' },
                        ])}>
                        <JGroup title="ตำแหน่งและจำนวน">
                            <JSelect<number> label="ตั้งอยู่บนฐานราก" value={onFooting ? r.footing : undefined} placeholder="เลือกฐาน"
                                options={footingOptions} width={140}
                                onChange={v => set(i, { footing: v ?? -1 })} />
                            <JText label="ชื่อเสาตอม่อ" value={r.name} placeholder="เช่น C1" onChange={v => set(i, { name: v })} />
                            <JNumber label="จำนวนต้น" value={r.count} unit="ต้น" digits={0} onChange={v => set(i, { count: v })}
                                hint="ปกติเท่ากับจำนวนฐาน" />
                        </JGroup>
                        <JGroup title="ขนาดเสา (จากรูปขยายตอม่อ)">
                            <JNumber label="ความกว้าง" value={r.width} unit="ม." onChange={v => set(i, { width: v })} />
                            <JNumber label="ความยาว" value={r.length} unit="ม." onChange={v => set(i, { length: v })} />
                            <JNumber label="ความสูง" value={r.height} unit="ม." onChange={v => set(i, { height: v })}
                                hint="จากหลังฐานรากถึงคานคอดิน" />
                        </JGroup>
                        <JGroup title="เหล็กเสริม (ต่อ 1 ต้น)">
                            <JBar label="เหล็กยืน" size={r.mainBarSize} onSize={v => set(i, { mainBarSize: v })}
                                amount={r.mainBarCount} onAmount={v => set(i, { mainBarCount: v })} />
                            <JBar label="เหล็กปลอก ระยะห่าง" size={r.stirrupSize} onSize={v => set(i, { stirrupSize: v })}
                                amount={r.stirrupSpacing} onAmount={v => set(i, { stirrupSpacing: v })} amountUnit="ม." amountDigits={2}
                                hint="เช่น RB6 @ 0.15 ม." />
                        </JGroup>
                    </ElementCard>
                );
            })}

            <AddButton label="เพิ่มเสาตอม่อแบบถัดไป" onClick={add} />

            <ResultSummary parts={[
                { label: 'คอนกรีตเสาตอม่อ', value: t.concrete, unit: 'ลบ.ม.' },
                { label: 'เหล็กเสริม', value: totalKg(t.rebar), unit: 'กก.' },
                { label: 'ไม้แบบ', value: t.formwork, unit: 'ตร.ม.' },
            ]} note={backfill === undefined ? undefined
                : `ดินถมกลับรอบฐานราก ${formatNumber(backfill)} ลบ.ม. (หักคอนกรีตฐานรากและเสาตอม่อแล้ว)`} />
        </div>
    );
}
