'use client';

import { useState } from 'react';
import { Button } from 'antd';
import { UndoOutlined } from '@ant-design/icons';
import {
    paint, paintLinkedSources, paintSuggestions, applyPaintSuggestions, pendingPaintSuggestions, mouldingArea, PAINT_LINES,
    type MouldingRun, type PaintInput, type PaintLineKey, type PaintSuggestions,
} from '@/domain/calculators/paint';
import type { CalcContext } from '@/domain/calculators/types';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { JNumber, LevelLink, ResultSummary, SuggestedValue, levelTitle } from '@/components/sheet/journey';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, InputNumberField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber, SHEET_COLORS } from '@/components/sheet/NumberCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { useProjectStore } from '@/store/project-store';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center';
const td = 'border border-gray-200 px-2 py-1 text-[13px] align-middle';

/** Excel rows 5–6 of the moulding list are the sheet's fixed runs (บัว 0.3, บัว 0.1). */
const FIXED_MOULDINGS = 2;

/** PAINT_LINES[].boq lists the rows of these sections, in this order. */
const SECTIONS = paint.sections;

/** "ใช้ค่าจาก …" — the value another sheet offers for a hand-typed Excel number (decision D20 pending). */
function SourceHint({ sheet, value, current, unit, onUse }: {
    sheet: string; value: number | undefined; current: number; unit: string; onUse: (v: number) => void;
}) {
    if (value === undefined) {
        return <span className="text-[12px] text-gray-400">ยังไม่มีค่าจาก {sheet}</span>;
    }
    const same = Math.abs(value - current) < 1e-9;
    return (
        <span className="inline-flex flex-wrap items-center gap-2 text-[12px] text-gray-600">
            <span>ค่าจาก {sheet}: <b className="tabular-nums">{formatNumber(value, 2)}</b> {unit}</span>
            <Button size="small" disabled={same} onClick={() => onUse(value)}>
                {same ? 'ตรงกับค่าในชีตแล้ว' : `ใช้ค่าจาก ${sheet}`}
            </Button>
        </span>
    );
}

// ─── Journey mode: a review of the areas earlier levels gave, plus the three numbers to confirm ───

/** Where each line's area comes from, in plain words. */
const JOURNEY_SOURCE: Partial<Record<PaintLineKey, { level: string; what: string }>> = {
    wallExterior: { level: 'plaster', what: 'ผนังฉาบภายนอก' },
    wallInterior: { level: 'plaster', what: 'ผนังฉาบภายใน' },
    ceilingExterior: { level: 'ceiling', what: 'ฝ้าที่เลือกทาสีภายนอก' },
    ceilingInterior: { level: 'ceiling', what: 'ฝ้าที่เลือกทาสีภายใน' },
    ceilingSlat: { level: 'ceiling', what: 'ฝ้าระแนง (สีย้อมไม้)' },
    skim: { level: 'plaster', what: 'ผนังฉาบภายนอก + ภายใน' },
};

/** The hand-typed values before an "ใช้ค่า…ทั้งหมด" (for เลิกทำ). */
interface AppliedSnapshot { slatWallArea: number; fasciaLength: number; mouldingLengths: number[]; count: number }

function PaintJourney({ input, update, outputs, linked, suggest }: {
    input: PaintInput; update: UseCalculator<PaintInput>['update']; outputs: Record<string, number>;
    linked: ReturnType<typeof paintLinkedSources>; suggest: PaintSuggestions;
}) {
    const pending = pendingPaintSuggestions(input, suggest);
    // Set by the "ใช้ทั้งหมด" click only; cleared by เลิกทำ.
    const [applied, setApplied] = useState<AppliedSnapshot | null>(null);
    const applyAll = () => {
        setApplied({
            slatWallArea: input.slatWallArea, fasciaLength: input.fasciaLength,
            mouldingLengths: input.mouldings.map(m => m.length), count: pending,
        });
        update(p => applyPaintSuggestions(p, suggest));
    };
    const undoApply = (snap: AppliedSnapshot) => {
        update(p => ({
            ...p, slatWallArea: snap.slatWallArea, fasciaLength: snap.fasciaLength,
            mouldings: p.mouldings.map((m, i) => ({ ...m, length: snap.mouldingLengths[i] ?? m.length })),
        }));
        setApplied(null);
    };
    const isLinked = (key: PaintLineKey) =>
        key === 'ceilingExterior' || key === 'ceilingInterior' || key === 'ceilingSlat' ? linked[key] : linked.plaster;
    const fromLevels = PAINT_LINES.filter(l => JOURNEY_SOURCE[l.key] !== undefined);
    const setMoulding = (i: number, patch: Partial<MouldingRun>) => update(p => ({
        ...p, mouldings: p.mouldings.map((m, j) => (j === i ? { ...m, ...patch } : m)),
    }));
    const sum = (keys: PaintLineKey[]) => keys.reduce((s, k) => s + (outputs[k] ?? 0), 0);
    // The wall-finishing level was marked "ไม่มีในโครงการนี้" and nothing was typed here: no slat or moulding paint.
    const finishingSkipped = useProjectStore(s => s.project.journey?.['wall-finishing'] === 'skipped');
    const noFinishing = finishingSkipped && input.slatWallArea === 0 && input.mouldings.every(m => m.length === 0);

    return (
        <>
            <SheetCard title="พื้นที่ทาสีจากขั้นตอนก่อนหน้า">
                <p className="text-[12px] text-gray-500 mb-2">ไม่ต้องกรอก — ตรวจสอบว่าครบถ้วน หากรายการใดยังไม่มีแต่แบบมี ให้กลับไปกรอกในขั้นตอนนั้น</p>
                <div className="divide-y divide-gray-100">
                    {fromLevels.map(l => {
                        const src = JOURNEY_SOURCE[l.key];
                        if (!src) return null;
                        const area = outputs[l.key] ?? 0;
                        return (
                            <div key={l.key} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5">
                                <span className="text-[13px] text-gray-800 min-w-[200px]">{l.label}</span>
                                <span className="tabular-nums px-2 py-0.5 rounded-sm min-w-[110px] text-right" style={{ background: SHEET_COLORS.calc }}>
                                    {area === 0 ? 'ไม่มี' : `${formatNumber(area)} ตร.ม.`}
                                </span>
                                <span className="text-[12px] text-gray-500">
                                    {isLinked(l.key)
                                        ? <>จาก <LevelLink levelId={src.level} /> ({src.what})</>
                                        : <>ค่าตัวอย่าง (ยังไม่มีข้อมูลจากขั้นตอน{levelTitle(src.level)})</>}
                                </span>
                                {area === 0 && (
                                    <LevelLink levelId={src.level} className="text-[12px] text-orange-600">
                                        หากแบบมี กรอกที่ขั้นตอน{levelTitle(src.level)}
                                    </LevelLink>
                                )}
                            </div>
                        );
                    })}
                </div>
            </SheetCard>

            <SheetCard title="พื้นที่ที่ต้องยืนยัน">
                {pending > 0 && (
                    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2">
                        <span className="text-[13px] text-gray-800">ขั้นตอนก่อนหน้ามีค่าให้ใช้ {pending} รายการ — ค่าเดิมและค่าใหม่แสดงใต้แต่ละช่อง</span>
                        <Button type="primary" className="ml-auto" onClick={applyAll}>ใช้ค่าจากขั้นตอนก่อนหน้าทั้งหมด</Button>
                    </div>
                )}
                {pending === 0 && applied !== null && (
                    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] text-green-800">
                        <span>ใช้ค่าจากขั้นตอนก่อนหน้าแล้ว {applied.count} รายการ</span>
                        <Button size="small" type="link" icon={<UndoOutlined />} onClick={() => undoApply(applied)}>เลิกทำ</Button>
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    {noFinishing ? (
                        <div className="text-[13px] text-gray-600">
                            ทาสีผนังไม้ระแนงและบัวผนัง: ไม่มี (<LevelLink levelId="wall-finishing" /> ระบุว่า &quot;ไม่มีในโครงการนี้&quot;)
                        </div>
                    ) : (<>
                    <div>
                        <div className="text-[13px] font-semibold text-gray-800">ทาสีผนังไม้ระแนง</div>
                        <JNumber label="พื้นที่ผนังไม้ระแนง" unit="ตร.ม." value={input.slatWallArea}
                            onChange={v => update({ slatWallArea: v })} />
                        <SuggestedValue levelId="wall-finishing" value={suggest.slatWallArea} current={input.slatWallArea}
                            unit="ตร.ม." onUse={v => update({ slatWallArea: v })} />
                    </div>

                    <div>
                        <div className="text-[13px] font-semibold text-gray-800">ทาสีบัวผนัง</div>
                        {input.mouldings.length === 0 && <div className="text-[12px] text-gray-500 py-1">ไม่มีบัว</div>}
                        {input.mouldings.map((m, i) => (
                            <div key={i}>
                                <JNumber label={m.size.trim() === '' ? `ความยาวบัว ${i + 1}` : `ความยาวบัว ${m.size} ม.`}
                                    unit="ม." value={m.length} onChange={v => setMoulding(i, { length: v })}
                                    hint={mouldingArea(m) === 0 ? undefined : `ทาสี ${formatNumber(mouldingArea(m))} ตร.ม.`} />
                                {m.size.trim() !== '' && (
                                    <SuggestedValue levelId="wall-finishing" value={suggest.mouldingLength(m.size)} current={m.length}
                                        unit="ม." onUse={v => setMoulding(i, { length: v })} />
                                )}
                            </div>
                        ))}
                    </div>
                    </>)}

                    <div>
                        <div className="text-[13px] font-semibold text-gray-800">ทาสีเชิงชาย</div>
                        <JNumber label="ความยาวเชิงชาย" unit="ม." value={input.fasciaLength}
                            onChange={v => update({ fasciaLength: v })}
                            hint={(outputs.fascia ?? 0) === 0 ? undefined : `สูง ${formatNumber(input.fasciaHeight)} ม. → ${formatNumber(outputs.fascia)} ตร.ม.`} />
                        <SuggestedValue levelId="roofing" value={suggest.fasciaLength} current={input.fasciaLength}
                            unit="ม." onUse={v => update({ fasciaLength: v })} />
                    </div>
                </div>
            </SheetCard>

            <AdvancedSection title="ขนาดบัวและเชิงชาย" hint="ค่าตั้งต้น — ไม่ต้องแก้ก็ได้">
                <EditableTable<MouldingRun>
                    rows={input.mouldings}
                    onChange={mouldings => update({ mouldings })}
                    lockedRows={FIXED_MOULDINGS}
                    newRow={() => ({ size: '', girth: 0, length: 0 })}
                    addLabel="+ เพิ่มบัว"
                    columns={[
                        { kind: 'text', key: 'size', title: 'ขนาดบัว (ม.)', width: 90, placeholder: 'เช่น 0.3',
                            get: r => r.size, set: (r, v) => ({ ...r, size: v.trim() }) },
                        { kind: 'number', key: 'girth', title: 'ความกว้างรอบรูปที่ทาสี (ม.)', width: 140,
                            get: r => r.girth, set: (r, v) => ({ ...r, girth: v }) },
                    ]}
                />
                <p className="mt-1 mb-3 text-[12px] text-gray-500">
                    ความกว้างรอบรูป = หน้าบัว + 2 × ความหนา (บัว 0.3 × 0.1 → 0.5 ม., บัว 0.1 × 0.1 → 0.3 ม.)
                </p>
                <InputNumberField label="ความสูงไม้เชิงชาย" unit="ม." value={input.fasciaHeight}
                    onChange={v => update({ fasciaHeight: v })} />
                <p className="mt-1 text-[12px] text-gray-500">ราคาสีต่อ ตร.ม. ของแต่ละรอบ แก้ได้ที่หน้า BOQ</p>
            </AdvancedSection>

            <ResultSummary
                items={[
                    { label: 'ทาสีผนัง', value: sum(['wallExterior', 'wallInterior']), unit: 'ตร.ม.' },
                    { label: 'ทาสีฝ้า', value: sum(['ceilingExterior', 'ceilingInterior']), unit: 'ตร.ม.' },
                    { label: 'ระแนง บัว เชิงชาย', value: sum(['ceilingSlat', 'wallSlat', 'moulding', 'fascia']), unit: 'ตร.ม.' },
                    { label: 'ฉาบบาง (สกิมโค้ท)', value: outputs.skim, unit: 'ตร.ม.' },
                ]}
                note="พื้นที่ทาสีคิด 3 รอบ: รองพื้น, รอบที่ 1, รอบสุดท้าย" />
        </>
    );
}

export default function PaintPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(paint);
    const inJourney = useJourneyMode();
    const ctx: CalcContext = { outputs: id => result.calcOutputs[id] };
    const linked = paintLinkedSources(ctx);
    const suggest = paintSuggestions(ctx);

    if (inJourney) {
        return (
            <CalculatorShell def={paint} result={result} isDefault={isDefault} onReset={reset}>
                <PaintJourney input={input} update={update} outputs={outputs} linked={linked} suggest={suggest} />
            </CalculatorShell>
        );
    }

    const fromExcel = (sheet: string) => `ค่าจาก Excel (ยังไม่มีชีต ${sheet})`;
    const source: Record<PaintLineKey, string> = {
        wallExterior: linked.plaster ? 'ฉาบปูน_Plaster — รวม "ฉาบภายนอก"' : fromExcel('ฉาบปูน_Plaster'),
        wallInterior: linked.plaster ? 'ฉาบปูน_Plaster — รวม "ฉาบภายใน"' : fromExcel('ฉาบปูน_Plaster'),
        ceilingExterior: linked.ceilingExterior ? 'ฝ้าเพดาน_Ceiling — แยกงานทาสี "ทาสีฝ้า - ภายนอก"' : fromExcel('ฝ้าเพดาน_Ceiling'),
        ceilingInterior: linked.ceilingInterior ? 'ฝ้าเพดาน_Ceiling — แยกงานทาสี "ทาสีฝ้า - ภายใน"' : fromExcel('ฝ้าเพดาน_Ceiling'),
        ceilingSlat: linked.ceilingSlat ? 'ฝ้าเพดาน_Ceiling — แยกงานทาสี "ทาสีฝ้า - ไม้ระแนง"' : fromExcel('ฝ้าเพดาน_Ceiling'),
        wallSlat: 'กรอกเอง (ข้อ 6 ด้านล่าง)',
        moulding: 'ความกว้างรอบรูป × ความยาว (ข้อ 7 ด้านล่าง)',
        fascia: 'ความยาว × ความสูงเชิงชาย (ข้อ 8 ด้านล่าง)',
        skim: '= ข้อ 1 + ข้อ 2 (พื้นที่ฉาบภายนอก + ภายใน)',
    };

    const setMoulding = (i: number, patch: Partial<MouldingRun>) => update(p => ({
        ...p, mouldings: p.mouldings.map((m, j) => (j === i ? { ...m, ...patch } : m)),
    }));

    return (
        <CalculatorShell def={paint} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title="ตารางคำนวณปริมาณทาสี">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={th} style={{ width: 48 }}>ลำดับ</th>
                                <th className={th}>แยกส่วนผนัง</th>
                                <th className={th} style={{ width: 110 }}>พื้นที่ (ตร.ม.)</th>
                                <th className={th}>ที่มา</th>
                                <th className={th} style={{ width: 120 }}>ส่งเข้า BOQ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {PAINT_LINES.map((l, i) => (
                                <tr key={l.key}>
                                    <td className={`${td} text-center text-gray-500`}>{i + 1}</td>
                                    <td className={td}>{l.label}</td>
                                    <td className={`${td} text-right tabular-nums`} style={{ background: SHEET_COLORS.calc }}>
                                        {formatNumber(outputs[l.key])}
                                    </td>
                                    <td className={`${td} text-[12px] text-gray-600`}>{source[l.key]}</td>
                                    <td className={`${td} text-[12px] text-gray-600`}>
                                        {l.boq.map((r, j) => `§${SECTIONS[j]} แถว ${r.slice(1)}`).join(' · ')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="mt-2 text-[12px] text-gray-500">
                    พื้นที่ทั้ง 8 รายการใช้เป็นปริมาณของงานทาสีรองพื้น (ขั้นตอน 23), ทาสีจริง รอบที่ 1 (25) และทาสีรอบสุดท้าย (31);
                    งานฉาบบาง (สกิมโค๊ท) อยู่ในขั้นตอน 23 เท่านั้น — ราคาต่อหน่วยแก้ได้ที่หน้า BOQ แยกตามขั้นตอน
                </p>
            </SheetCard>

            <SheetCard title="6. ทาสีผนัง - ไม้ระแนง">
                <InputNumberField label="พื้นที่ผนังไม้ระแนง" unit="ตร.ม." value={input.slatWallArea}
                    onChange={v => update({ slatWallArea: v })} />
                <div className="py-1">
                    <SourceHint sheet="ตกแต่งผนัง (ระแนง)" value={suggest.slatWallArea} current={input.slatWallArea}
                        unit="ตร.ม." onUse={v => update({ slatWallArea: v })} />
                </div>
                <p className="mt-1 text-[12px] text-gray-500">ค่าตัวอย่าง Excel: =3.3+4.8 (พิมพ์ไว้ในสูตร)</p>
            </SheetCard>

            <SheetCard title="7. ทาสีผนัง - บัว">
                <EditableTable<MouldingRun>
                    rows={input.mouldings}
                    onChange={mouldings => update({ mouldings })}
                    lockedRows={FIXED_MOULDINGS}
                    newRow={() => ({ size: '', girth: 0, length: 0 })}
                    addLabel="+ เพิ่มบัว"
                    columns={[
                        {
                            kind: 'text', key: 'size', title: 'ขนาดบัว (ม.)', width: 90, placeholder: 'เช่น 0.3',
                            get: r => r.size, set: (r, v) => ({ ...r, size: v.trim() }),
                        },
                        {
                            kind: 'number', key: 'girth', title: 'ความกว้างรอบรูป (ม.)', width: 110,
                            get: r => r.girth, set: (r, v) => ({ ...r, girth: v }),
                        },
                        {
                            kind: 'number', key: 'length', title: 'ความยาว (ม.)', width: 100,
                            get: r => r.length, set: (r, v) => ({ ...r, length: v }),
                        },
                        { kind: 'calc', key: 'area', title: 'พื้นที่ (ตร.ม.)', width: 100, get: r => mouldingArea(r) },
                        {
                            kind: 'label', key: 'source', title: 'ความยาวจากชีตตกแต่งผนัง',
                            get: (r, i) => (
                                <SourceHint sheet={`ตกแต่งผนัง (บัว ${r.size})`} value={suggest.mouldingLength(r.size)}
                                    current={r.length} unit="ม." onUse={v => setMoulding(i, { length: v })} />
                            ),
                        },
                    ]}
                />
                <div className="mt-3 max-w-md ml-auto">
                    <CalcField label="รวมพื้นที่ทาสีบัว" value={outputs.moulding} unit="ตร.ม." strong />
                </div>
                <p className="mt-1 text-[12px] text-gray-500">
                    ความกว้างรอบรูป = หน้าบัว + 2 × ความหนา (บัว 0.3×0.1 → 0.5 ม., บัว 0.1×0.1 → 0.3 ม.).
                    ค่าตัวอย่าง Excel: =(0.5*13)+(0.3*11)
                </p>
            </SheetCard>

            <SheetCard title="8. ทาสีผนัง - เชิงชาย">
                <InputNumberField label="ความยาวเชิงชาย" unit="ม." value={input.fasciaLength}
                    onChange={v => update({ fasciaLength: v })} />
                <div className="py-1">
                    <SourceHint sheet="มุงหลังคา (ไม้เชิงชาย)" value={suggest.fasciaLength} current={input.fasciaLength}
                        unit="ม." onUse={v => update({ fasciaLength: v })} />
                </div>
                <InputNumberField label="ความสูงเชิงชาย" unit="ม." value={input.fasciaHeight}
                    onChange={v => update({ fasciaHeight: v })} />
                <CalcField label="พื้นที่ทาสีเชิงชาย" value={outputs.fascia} unit="ตร.ม." strong />
                <p className="mt-1 text-[12px] text-gray-500">
                    ค่าตัวอย่าง Excel: =63.2*0.23 (ชีตมุงหลังคาใช้ความยาวไม้เชิงชาย 62.3 ม. — รอยืนยัน)
                </p>
            </SheetCard>

            <p className="text-[12px] text-gray-500 px-1">
                ข้อ 6–8 Excel พิมพ์ตัวเลขไว้ในสูตร — ค่าเริ่มต้นตาม Excel; กด &quot;ใช้ค่าจาก …&quot; เพื่อดึงค่าจากชีตต้นทาง
            </p>
        </CalculatorShell>
    );
}
