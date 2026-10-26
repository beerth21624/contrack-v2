'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button, Select } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
    roofStructure, partTotal, DOUBLE_C_OPTIONS, ROOF_FACTOR_OPTIONS, STICK_LENGTH,
    type AreaMember, type KingPostPart, type LengthMember, type RoofStructureInput,
} from '@/domain/calculators/roof-structure';
import { InputNumberField, CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { NumberCell, TextCell, SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { LengthsCell } from '@/components/sheet/LengthsCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import RoofStructureJourney from './RoofStructureJourney';

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center';
const td = 'border border-gray-200 px-1 py-0.5 text-[13px] align-middle';
const yellow = { background: SHEET_COLORS.input };
const green = { background: SHEET_COLORS.calc };

const Dash = () => <td className={`${td} text-center text-gray-400`}>-</td>;
const Calc = ({ value, digits = 2, strong }: { value: number | undefined; digits?: number; strong?: boolean }) => (
    <td className={`${td} text-right tabular-nums ${strong ? 'font-semibold underline' : ''}`} style={green}>
        {formatNumber(value, digits)}
    </td>
);
const Blank = () => <td className={td} />;

function NumSelect({ value, options, onChange, label, digits = 0 }: {
    value: number; options: readonly number[]; onChange: (v: number) => void; label: string; digits?: number;
}) {
    return (
        <td className={td} style={yellow}>
            <Select size="small" variant="borderless" style={{ width: '100%' }} aria-label={label}
                value={String(value)} onChange={v => onChange(Number(v))}
                options={options.map(o => ({ value: String(o), label: o.toFixed(digits) }))} />
        </td>
    );
}

function DescCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
        <td className={td} style={yellow}>
            <TextCell value={value} ariaLabel="รายการ" onCommit={v => onChange(v ?? '')} />
        </td>
    );
}

function NumInput({ value, onChange, label, digits }: { value: number; onChange: (v: number) => void; label: string; digits?: number }) {
    return <td className={td}><NumberCell value={value} digits={digits} ariaLabel={label} onCommit={v => onChange(v ?? 0)} /></td>;
}

export default function RoofStructurePage() {
    return useJourneyMode() ? <RoofStructureJourney /> : <RoofStructureSheet />;
}

/** The Excel-mirror sheet (/calc/roof-structure). */
function RoofStructureSheet() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(roofStructure);
    const linked = outputs.linkedSlopeArea;

    function set<K extends keyof RoofStructureInput>(key: K, patch: Partial<RoofStructureInput[K]>) {
        update(p => ({ ...p, [key]: { ...p[key], ...patch } }));
    }
    const setPart = (i: number, patch: Partial<KingPostPart>) => update(p => ({
        ...p, kingPosts: { ...p.kingPosts, parts: p.kingPosts.parts.map((x, j) => (j === i ? { ...x, ...patch } : x)) },
    }));
    const removePart = (i: number) => update(p => ({
        ...p, kingPosts: { ...p.kingPosts, parts: p.kingPosts.parts.filter((_, j) => j !== i) },
    }));
    const addPart = () => update(p => ({
        ...p,
        kingPosts: {
            ...p.kingPosts,
            parts: [...p.kingPosts.parts, { desc: `- ดั้ง-${p.kingPosts.parts.length + 1}`, c: 2, length: 0, count: 0 }],
        },
    }));

    const lengthRow = (no: number, key: 'wallPlate' | 'ridge', m: LengthMember, line: string): ReactNode => (
        <tr key={key}>
            <td className={`${td} text-center`}>{no}</td>
            <DescCell value={m.desc} onChange={desc => set(key, { desc })} />
            <NumSelect value={m.c} options={DOUBLE_C_OPTIONS} label="ซีคู่" onChange={c => set(key, { c })} />
            <Blank /><Dash /><Dash />
            <td className={td}>
                <LengthsCell lengths={m.lengths} ariaLabel="ความยาว (ม.)" onChange={lengths => set(key, { lengths })} />
                {m.lengths.length > 1 && (
                    <div className="text-right tabular-nums px-1 text-[12px]" style={green}>{formatNumber(outputs[`${key}.length`])}</div>
                )}
            </td>
            <NumInput value={m.count} label="จำนวน (เส้น)" digits={0} onChange={count => set(key, { count })} />
            <Calc value={outputs[`${key}.total`]} />
            <Calc value={outputs[line]} strong />
        </tr>
    );

    const areaRow = (no: number, key: 'rafter' | 'purlin', m: AreaMember, line: string): ReactNode => (
        <tr key={key}>
            <td className={`${td} text-center`}>{no}</td>
            <DescCell value={m.desc} onChange={desc => set(key, { desc })} />
            <NumSelect value={m.c} options={DOUBLE_C_OPTIONS} label="ซีคู่" onChange={c => set(key, { c })} />
            <NumSelect value={m.factor} options={ROOF_FACTOR_OPTIONS} digits={2} label="ตัวคูณหลังคา" onChange={factor => set(key, { factor })} />
            <td className={td}>
                <NumberCell value={outputs[`${key}.area`] ?? 0} ariaLabel="พื้นที่หลังคา (ตร.ม.)" tone={m.area === null ? 'calc' : 'input'}
                    onCommit={v => {
                        // NumberCell commits on blur even when only focused (draft rounded to 6 decimals):
                        // an unchanged linked value must keep the link to the Roofing sheet.
                        const shown = outputs[`${key}.area`] ?? 0;
                        if (m.area === null && v !== undefined && Math.abs(v - shown) <= 1e-6 * Math.max(1, Math.abs(shown))) return;
                        set(key, { area: v ?? null });
                    }} />
            </td>
            <NumInput value={m.spacing} label="ระยะห่าง (ม.)" onChange={spacing => set(key, { spacing })} />
            <Dash /><Dash />
            <Calc value={outputs[`${key}.total`]} />
            <Calc value={outputs[line]} strong />
        </tr>
    );

    return (
        <CalculatorShell def={roofStructure} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title=": ตารางคำนวณปริมาณเหล็กโครงหลังคา (จำนวนท่อน)">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={th} style={{ width: 40 }}>ลำดับ</th>
                                <th className={th} style={{ minWidth: 200 }}>รายการ</th>
                                <th className={th} style={{ width: 60 }}>ซีคู่</th>
                                <th className={th} style={{ width: 75 }}>ตัวคูณหลังคา</th>
                                <th className={th} style={{ width: 90 }}>พื้นที่หลังคา (ตร.ม.)</th>
                                <th className={th} style={{ width: 70 }}>ระยะห่าง (ม.)</th>
                                <th className={th} style={{ width: 150 }}>ความยาว (ม.)</th>
                                <th className={th} style={{ width: 65 }}>จำนวน (เส้น)</th>
                                <th className={th} style={{ width: 85 }}>ความยาวรวม (ม.)</th>
                                <th className={th} style={{ width: 70 }}>จำนวน (ท่อน)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lengthRow(1, 'wallPlate', input.wallPlate, 'R152')}

                            <tr>
                                <td className={`${td} text-center`}>2</td>
                                <DescCell value={input.kingPosts.desc} onChange={desc => set('kingPosts', { desc })} />
                                <Blank /><Blank /><Dash /><Dash /><Dash /><Dash />
                                <Calc value={outputs['kingPosts.total']} />
                                <Calc value={outputs.R153} strong />
                            </tr>
                            {input.kingPosts.parts.map((p, i) => (
                                <tr key={`part-${i}`}>
                                    <td className={`${td} text-center`}>
                                        <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="ลบแถวดั้ง"
                                            onClick={() => removePart(i)} />
                                    </td>
                                    <DescCell value={p.desc} onChange={desc => setPart(i, { desc })} />
                                    <NumSelect value={p.c} options={DOUBLE_C_OPTIONS} label="ซีคู่" onChange={c => setPart(i, { c })} />
                                    <Blank /><Dash /><Dash />
                                    <NumInput value={p.length} label="ความยาว (ม.)" onChange={length => setPart(i, { length })} />
                                    <NumInput value={p.count} label="จำนวน (เส้น)" digits={0} onChange={count => setPart(i, { count })} />
                                    <Calc value={partTotal(p)} />
                                    <Blank />
                                </tr>
                            ))}
                            <tr>
                                <td className={td} />
                                <td className={td} colSpan={9}>
                                    <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addPart}>เพิ่มดั้ง</Button>
                                </td>
                            </tr>

                            {lengthRow(3, 'ridge', input.ridge, 'R154')}

                            <tr>
                                <td className={`${td} text-center`}>4</td>
                                <DescCell value={input.valley.desc} onChange={desc => set('valley', { desc })} />
                                <NumSelect value={input.valley.c} options={DOUBLE_C_OPTIONS} label="ซีคู่" onChange={c => set('valley', { c })} />
                                <Blank /><Dash /><Dash />
                                <Calc value={outputs['valley.length']} />
                                <NumInput value={input.valley.count} label="จำนวน (เส้น)" digits={0} onChange={count => set('valley', { count })} />
                                <Calc value={outputs['valley.total']} />
                                <Calc value={outputs.R155} strong />
                            </tr>

                            {areaRow(5, 'rafter', input.rafter, 'R156')}
                            {areaRow(6, 'purlin', input.purlin, 'R157')}
                        </tbody>
                    </table>
                </div>
                <ul className="mt-2 text-[12px] text-gray-500 list-disc pl-5 space-y-0.5">
                    <li>ความยาวรวม = ความยาว × จำนวน × ซีคู่ (อะเส, ดั้ง, อกไก่, ตะเข้ราง) หรือ พื้นที่หลังคา ÷ ระยะห่าง × ตัวคูณหลังคา × ซีคู่ (จันทัน, แป)</li>
                    <li>จำนวน (ท่อน) = ROUNDUP(ความยาวรวม ÷ {STICK_LENGTH}) — เหล็กยาวท่อนละ {STICK_LENGTH} ม.</li>
                    <li>
                        พื้นที่หลังคา (สีเขียว) = พื้นที่ตามแนวลาดเอียง {formatNumber(linked)} ตร.ม. จาก
                        {' '}<Link href="/calc/roofing" className="text-blue-600 hover:underline">ชีตมุงหลังคา</Link>{' '}
                        — พิมพ์ทับได้, ล้างช่องเพื่อกลับไปใช้ค่าที่ลิงก์
                    </li>
                    <li>ความยาว (อะเส, อกไก่) พิมพ์เป็นผลรวมช่วงได้ เช่น 12.5+11+4.5</li>
                </ul>
            </SheetCard>

            <SheetCard title="ความยาวตะเข้ราง (ต่อเส้น) = √(ระยะราบ 1² + ระยะราบ 2²) ÷ cos(องศา)">
                <div className="max-w-lg">
                    <InputNumberField label="ระยะราบ 1" value={input.valley.runA} unit="ม." onChange={runA => set('valley', { runA })} />
                    <InputNumberField label="ระยะราบ 2" value={input.valley.runB} unit="ม." onChange={runB => set('valley', { runB })} />
                    <InputNumberField label="ความลาดเอียง" value={input.valley.deg} unit="องศา" digits={0} onChange={deg => set('valley', { deg })} />
                    <CalcField label="ความยาวตะเข้ราง" value={outputs['valley.length']} unit="ม." strong />
                </div>
                <p className="mt-2 text-[12px] text-gray-500">
                    Excel พิมพ์ไว้ตายตัว =(SQRT((3.6^2)+(3.6^2)))/COS(RADIANS(40)) ไม่ได้ลิงก์กับความลาดเอียงในชีตมุงหลังคา
                </p>
            </SheetCard>
        </CalculatorShell>
    );
}
