'use client';

import type { ReactNode } from 'react';
import { Button, Select } from 'antd';
import {
    roofStructure, partTotal, DOUBLE_C_OPTIONS, ROOF_FACTOR_OPTIONS, STICK_LENGTH,
    type AreaMember, type KingPostPart, type LengthMember, type RoofStructureInput,
} from '@/domain/calculators/roof-structure';
import { roofing } from '@/domain/calculators/roofing';
import { calculatorInput } from '@/domain/project';
import { useProjectStore } from '@/store/project-store';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, InputNumberField, SheetCard } from '@/components/sheet/SheetFields';
import { NumberCell, TextCell, SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { LengthsCell } from '@/components/sheet/LengthsCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { EmptyState, FromLevel, Hint, ResultSummary } from '@/components/sheet/journey';

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center';
const td = 'border border-gray-200 px-1 py-0.5 text-[13px] align-middle';

function NumSelect({ value, options, onChange, label, digits = 0 }: {
    value: number; options: readonly number[]; onChange: (v: number) => void; label: string; digits?: number;
}) {
    return (
        <Select size="small" variant="borderless" style={{ width: '100%', background: SHEET_COLORS.input }} aria-label={label}
            value={String(value)} onChange={v => onChange(Number(v))}
            options={options.map(o => ({ value: String(o), label: o.toFixed(digits) }))} />
    );
}

/** One plan-length line: label, typed segments, their sum. */
function LengthLine({ label, hint, lengths, total, onChange }: {
    label: string; hint: string; lengths: number[]; total: number | undefined; onChange: (lengths: number[]) => void;
}) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px_110px] items-center gap-2 py-1">
            <div>
                <div className="text-[13px] text-gray-700">{label}</div>
                <Hint>{hint}</Hint>
            </div>
            <LengthsCell lengths={lengths} ariaLabel={label} onChange={onChange} />
            <span className="text-right tabular-nums px-1 rounded-sm text-[13px]" style={{ background: SHEET_COLORS.calc }}>
                {formatNumber(total)} ม.
            </span>
        </div>
    );
}

export default function RoofStructureJourney() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(roofStructure);
    const roofSlope = useProjectStore(s => calculatorInput(s.project, roofing).slopeDeg);
    const linked = outputs.linkedSlopeArea ?? 0;

    function set<K extends keyof RoofStructureInput>(key: K, patch: Partial<RoofStructureInput[K]>) {
        update(p => ({ ...p, [key]: { ...p[key], ...patch } }));
    }
    const setParts = (parts: KingPostPart[]) => update(p => ({ ...p, kingPosts: { ...p.kingPosts, parts } }));
    const newPart = (parts: KingPostPart[]): KingPostPart =>
        ({ desc: `- ดั้ง-${parts.length + 1}`, c: parts[parts.length - 1]?.c ?? 2, length: 0, count: 1 });
    const addPart = () => update(p => ({ ...p, kingPosts: { ...p.kingPosts, parts: [...p.kingPosts.parts, newPart(p.kingPosts.parts)] } }));
    const parts = input.kingPosts.parts;

    // ─── Advanced: steel sections and spec per member ───
    const lengthSpec = (key: 'wallPlate' | 'ridge', name: string, m: LengthMember): ReactNode => (
        <tr key={key}>
            <td className={td}>{name}</td>
            <td className={td} style={{ background: SHEET_COLORS.input }}><TextCell value={m.desc} ariaLabel={`ขนาดเหล็ก${name}`} onCommit={v => set(key, { desc: v ?? '' })} /></td>
            <td className={td}><NumSelect value={m.c} options={DOUBLE_C_OPTIONS} label="ซีคู่" onChange={c => set(key, { c })} /></td>
            <td className={`${td} text-center text-gray-400`}>-</td>
            <td className={`${td} text-center text-gray-400`}>-</td>
            <td className={td}><NumberCell value={m.count} digits={0} ariaLabel="จำนวนเส้น" onCommit={v => set(key, { count: v ?? 1 })} /></td>
        </tr>
    );
    const areaSpec = (key: 'rafter' | 'purlin', name: string, m: AreaMember): ReactNode => (
        <tr key={key}>
            <td className={td}>{name}</td>
            <td className={td} style={{ background: SHEET_COLORS.input }}><TextCell value={m.desc} ariaLabel={`ขนาดเหล็ก${name}`} onCommit={v => set(key, { desc: v ?? '' })} /></td>
            <td className={td}><NumSelect value={m.c} options={DOUBLE_C_OPTIONS} label="ซีคู่" onChange={c => set(key, { c })} /></td>
            <td className={td}><NumSelect value={m.factor} options={ROOF_FACTOR_OPTIONS} digits={2} label="Factor Roof" onChange={factor => set(key, { factor })} /></td>
            <td className={td}><NumberCell value={m.spacing} ariaLabel={`ระยะห่าง${name} (ม.)`} onCommit={v => set(key, { spacing: v ?? 0 })} /></td>
            <td className={`${td} text-center text-gray-400`}>-</td>
        </tr>
    );
    const areaOverride = (key: 'rafter' | 'purlin', name: string, m: AreaMember) => (
        <div className="grid grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-2 py-1">
            <span className="text-[13px] text-gray-700">พื้นที่หลังคาที่ใช้คิด{name}</span>
            <NumberCell value={outputs[`${key}.area`] ?? 0} tone={m.area === null ? 'calc' : 'input'} edited={m.area !== null}
                ariaLabel={`พื้นที่หลังคาที่ใช้คิด${name} (ตร.ม.)`}
                onCommit={v => set(key, { area: v ?? null })} />
            <span className="text-[12px] text-gray-500">ตร.ม. {m.area === null ? '(จากด่านวัสดุมุงหลังคา)' : '(พิมพ์เอง — ลบค่าเพื่อกลับไปใช้ค่าจากหลังคา)'}</span>
        </div>
    );

    return (
        <CalculatorShell def={roofStructure} result={result} isDefault={isDefault} onReset={reset}>
            <FromLevel levelId="roofing">
                {linked > 0
                    ? <>พื้นที่หลังคาตามแนวลาด <b>{formatNumber(linked)} ตร.ม.</b> — จันทัน แป และค่าแรงโครงหลังคาคิดจากพื้นที่นี้ให้เอง ไม่ต้องกรอกซ้ำ</>
                    : <>ยังไม่มีพื้นที่หลังคา — กรอกขนาดหลังคาในด่านวัสดุมุงหลังคาก่อน แล้วจันทันและแปจะคิดให้เอง</>}
            </FromLevel>

            <SheetCard title="อะเสและอกไก่">
                <Hint>พิมพ์ความยาวแต่ละช่วงต่อกันด้วย + ได้ เช่น 12.5+11+4.5</Hint>
                <LengthLine label="อะเส" hint="ความยาวคานเหล็กรับโครงหลังคาบนหัวเสา รอบอาคาร"
                    lengths={input.wallPlate.lengths} total={outputs['wallPlate.length']}
                    onChange={lengths => set('wallPlate', { lengths })} />
                <LengthLine label="อกไก่" hint="ความยาวสันหลังคา (ตัวบนสุดของโครง)"
                    lengths={input.ridge.lengths} total={outputs['ridge.length']}
                    onChange={lengths => set('ridge', { lengths })} />
            </SheetCard>

            <SheetCard title="ดั้ง (เสาค้ำอกไก่)">
                {parts.length === 0
                    ? <EmptyState text="ยังไม่มีดั้ง — ดูรูปตัดโครงหลังคา: ความสูงดั้งแต่ละแบบ และจำนวนต้น" addLabel="เพิ่มดั้ง" onAdd={addPart} />
                    : (
                        <EditableTable<KingPostPart>
                            rows={parts}
                            onChange={setParts}
                            newRow={() => newPart(parts)}
                            addLabel="+ เพิ่มดั้ง"
                            columns={[
                                { kind: 'text', key: 'desc', title: 'ชื่อ', width: 140, get: p => p.desc, set: (p, v) => ({ ...p, desc: v }) },
                                { kind: 'number', key: 'length', title: 'ความสูง/ความยาว (ม.)', width: 120, get: p => p.length, set: (p, v) => ({ ...p, length: v }) },
                                { kind: 'number', key: 'count', title: 'จำนวน (ต้น)', width: 90, digits: 0, get: p => p.count, set: (p, v) => ({ ...p, count: v }) },
                                { kind: 'calc', key: 'total', title: 'ความยาวรวม (ม.)', width: 110, get: p => partTotal(p) },
                            ]}
                        />
                    )}
            </SheetCard>

            <SheetCard title="ตะเข้ราง">
                <Hint>ถ้าหลังคาไม่มีตะเข้ (รางน้ำระหว่างหลังคา 2 ผืน) ปล่อยว่างได้</Hint>
                <div className="max-w-xl mt-1">
                    <InputNumberField label="ระยะตามแนวราบ ด้านที่ 1" value={input.valley.runA} unit="ม." onChange={runA => set('valley', { runA })} />
                    <InputNumberField label="ระยะตามแนวราบ ด้านที่ 2" value={input.valley.runB} unit="ม." onChange={runB => set('valley', { runB })} />
                    <InputNumberField label="จำนวนตะเข้" value={input.valley.count} unit="เส้น" digits={0} onChange={count => set('valley', { count })} />
                    <InputNumberField label="ความชันหลังคา" value={input.valley.deg} unit="องศา" digits={0} onChange={deg => set('valley', { deg })} />
                    {roofSlope > 0 && input.valley.deg !== roofSlope && (
                        <div className="flex justify-end">
                            <Button size="small" onClick={() => set('valley', { deg: roofSlope })}>
                                ใช้ความชันเดียวกับหลังคา ({formatNumber(roofSlope, 0)}°)
                            </Button>
                        </div>
                    )}
                    <CalcField label="ความยาวตะเข้ต่อเส้น" value={outputs['valley.length']} unit="ม." strong />
                </div>
            </SheetCard>

            <AdvancedSection title="ขนาดเหล็กและระยะห่าง" hint="สเปกตามแบบมาตรฐาน — ไม่ต้องแก้ก็ได้">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={th} style={{ width: 80 }}>รายการ</th>
                                <th className={th} style={{ minWidth: 200 }}>ขนาดเหล็ก</th>
                                <th className={th} style={{ width: 70 }}>ซีคู่</th>
                                <th className={th} style={{ width: 80 }}>Factor Roof</th>
                                <th className={th} style={{ width: 90 }}>ระยะห่าง (ม.)</th>
                                <th className={th} style={{ width: 80 }}>จำนวนเส้น</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lengthSpec('wallPlate', 'อะเส', input.wallPlate)}
                            <tr>
                                <td className={td}>ดั้ง</td>
                                <td className={td} style={{ background: SHEET_COLORS.input }}>
                                    <TextCell value={input.kingPosts.desc} ariaLabel="ขนาดเหล็กดั้ง" onCommit={v => set('kingPosts', { desc: v ?? '' })} />
                                </td>
                                <td className={td}>
                                    {parts.length > 0
                                        ? <NumSelect value={parts[0]?.c ?? 2} options={DOUBLE_C_OPTIONS} label="ซีคู่ดั้ง"
                                            onChange={c => setParts(parts.map(p => ({ ...p, c })))} />
                                        : <span className="block text-center text-gray-400">-</span>}
                                </td>
                                <td className={`${td} text-center text-gray-400`}>-</td>
                                <td className={`${td} text-center text-gray-400`}>-</td>
                                <td className={`${td} text-center text-gray-400`}>-</td>
                            </tr>
                            {lengthSpec('ridge', 'อกไก่', input.ridge)}
                            <tr>
                                <td className={td}>ตะเข้ราง</td>
                                <td className={td} style={{ background: SHEET_COLORS.input }}>
                                    <TextCell value={input.valley.desc} ariaLabel="ขนาดเหล็กตะเข้ราง" onCommit={v => set('valley', { desc: v ?? '' })} />
                                </td>
                                <td className={td}><NumSelect value={input.valley.c} options={DOUBLE_C_OPTIONS} label="ซีคู่" onChange={c => set('valley', { c })} /></td>
                                <td className={`${td} text-center text-gray-400`}>-</td>
                                <td className={`${td} text-center text-gray-400`}>-</td>
                                <td className={`${td} text-center text-gray-400`}>-</td>
                            </tr>
                            {areaSpec('rafter', 'จันทัน', input.rafter)}
                            {areaSpec('purlin', 'แป', input.purlin)}
                        </tbody>
                    </table>
                </div>
                <div className="mt-2 max-w-2xl">
                    {areaOverride('rafter', 'จันทัน', input.rafter)}
                    {areaOverride('purlin', 'แป', input.purlin)}
                </div>
                <div className="mt-2 text-[12px] text-gray-500">
                    ซีคู่ 2 = เหล็กตัวซีประกบคู่ · Factor Roof = เผื่อเหล็กจันทัน/แปตามรูปหลังคา · เหล็กยาวท่อนละ {STICK_LENGTH} ม.
                </div>
            </AdvancedSection>

            <ResultSummary
                items={[
                    { label: 'อะเส', value: outputs.R152, unit: 'ท่อน', digits: 0 },
                    { label: 'ดั้ง', value: outputs.R153, unit: 'ท่อน', digits: 0 },
                    { label: 'อกไก่', value: outputs.R154, unit: 'ท่อน', digits: 0 },
                    { label: 'ตะเข้ราง', value: outputs.R155, unit: 'ท่อน', digits: 0 },
                    { label: 'จันทัน', value: outputs.R156, unit: 'ท่อน', digits: 0 },
                    { label: 'แป', value: outputs.R157, unit: 'ท่อน', digits: 0 },
                ]}
                note={<>เหล็กโครงหลังคาท่อนละ {STICK_LENGTH} ม. · ค่าแรงโครงหลังคาคิดจากพื้นที่หลังคา {formatNumber(outputs.R159)} ตร.ม.</>} />
        </CalculatorShell>
    );
}
