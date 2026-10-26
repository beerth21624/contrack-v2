'use client';

import { plaster, plasterRowArea, type PlasterRow } from '@/domain/calculators/plaster';
import { BRICK_WALL_PARTS, netByPartKey } from '@/domain/calculators/brick';
import type { CalcContext } from '@/domain/calculators/types';
import { EditableTable } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { FromLevel, LabelWithHint, ResultSummary, SumInput, blankIfZero } from '@/components/sheet/journey';
import { isStructural, PlasterTable } from './PlasterTable';

const SIDE_OPTIONS = [
    { value: '0', label: 'ไม่ฉาบ' },
    { value: '1', label: '1 ด้าน' },
    { value: '2', label: '2 ด้าน' },
];

const kindLabel = (kind: string) => {
    const k = kind.trim();
    return k === 'ฉาบภายนอก' ? 'ฉาบด้านนอก' : k === 'ฉาบภายใน' ? 'ฉาบด้านใน' : '-';
};

export default function PlasterJourney() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(plaster);
    const ctx: CalcContext = { outputs: id => result.calcOutputs[id] };
    const brickNet = (part: string) => result.calcOutputs.brick?.[netByPartKey(part)] ?? 0;
    const setRow = (i: number, patch: Partial<PlasterRow>) =>
        update(p => ({ ...p, rows: p.rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

    const walls = BRICK_WALL_PARTS.map(part => ({ part, area: brickNet(part) })).filter(w => w.area !== 0);
    const noWalls = walls.length === 0;

    return (
        <CalculatorShell def={plaster} result={result} isDefault={isDefault} onReset={reset}>
            <FromLevel levelId="brick">
                {noWalls
                    ? (
                        <>
                            ยังไม่มีผนังก่ออิฐ — พื้นที่ฉาบมาจากผนังในขั้นตอนก่ออิฐ (หักประตู-หน้าต่างแล้ว)
                            กรอกผนังในขั้นตอนก่ออิฐก่อน แล้วระบบจะคิดพื้นที่ฉาบให้อัตโนมัติ
                        </>
                    )
                    : (
                        <>
                            พื้นที่ผนัง (หักประตู-หน้าต่างแล้ว):{' '}
                            {walls.map((w, i) => (
                                <span key={w.part}>{i > 0 && ' · '}{w.part} <b>{formatNumber(w.area)} ตร.ม.</b></span>
                            ))}
                        </>
                    )}
            </FromLevel>

            <SheetCard title="ผนังที่ต้องฉาบ">
                <EditableTable<PlasterRow>
                    rows={input.rows}
                    onChange={rows => update({ rows })}
                    canDelete={false}
                    columns={[
                        { kind: 'label', key: 'wall', title: 'ผนัง', width: 230,
                            get: r => (isStructural(r)
                                ? <LabelWithHint label="ผนังโครงสร้าง (เสา-คาน)" hint="ผิวเสา-คานคอนกรีตที่ต้องฉาบนอกเหนือจากผนังอิฐ" />
                                : <LabelWithHint label={r.wallPart.trim() === '' ? '-' : r.wallPart}
                                    hint={!noWalls && r.wallPart.trim() !== '' && brickNet(r.wallPart) === 0 ? 'ไม่มีผนังนี้ในขั้นตอนก่ออิฐ' : undefined} />) },
                        { kind: 'label', key: 'kind', title: 'ฉาบ', width: 100, get: r => <span className="px-1">{kindLabel(r.kind)}</span> },
                        { kind: 'label', key: 'area', title: 'พื้นที่ผนังต่อด้าน (ตร.ม.)', width: 150,
                            get: (r, i) => (isStructural(r)
                                ? <SumInput value={r.manualArea ?? 0} ariaLabel="พื้นที่ผนังโครงสร้าง ต่อด้าน (ตร.ม.)"
                                    onChange={manualArea => setRow(i, { manualArea })} />
                                : (
                                    <div className="text-right tabular-nums px-1" style={{ background: SHEET_COLORS.calc }}>
                                        {r.wallPart.trim() && brickNet(r.wallPart) !== 0 ? formatNumber(brickNet(r.wallPart)) : ''}
                                    </div>
                                )) },
                        { kind: 'select', key: 'sides', title: 'ฉาบกี่ด้าน', width: 100, options: SIDE_OPTIONS,
                            get: r => String(r.sides), set: (r, v) => ({ ...r, sides: Number(v) }) },
                        { kind: 'calc', key: 'total', title: 'พื้นที่ฉาบ (ตร.ม.)', width: 110, get: r => blankIfZero(plasterRowArea(r, ctx)) },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>ส่วนใหญ่ไม่ต้องแก้: ผนังรอบบ้านฉาบด้านในและด้านนอก ผนังภายในบ้านฉาบด้านในทั้ง 2 ด้าน ผนังภายนอกบ้านฉาบด้านนอกทั้ง 2 ด้าน</li>
                    <li>ผนังที่ไม่ฉาบ (เช่น ผนังโชว์อิฐ) เลือก &quot;ไม่ฉาบ&quot;</li>
                    <li>ผนังโครงสร้าง: พิมพ์พื้นที่ผิวเสา-คานต่อด้าน รวมหลายส่วนด้วย + ได้ เช่น 25+6.24 (ไม่มีให้เว้นว่าง)</li>
                </ul>
            </SheetCard>

            <AdvancedSection title="ตั้งค่ารายการฉาบ" hint="เพิ่ม/ลบรายการ หรือเปลี่ยนผนังและด้านที่ฉาบ — ปกติไม่ต้องแก้">
                <PlasterTable rows={input.rows} onChange={rows => update({ rows })} setRow={setRow} ctx={ctx}
                    brickNet={brickNet} structuralDefault={0} />
            </AdvancedSection>

            <ResultSummary
                items={[
                    { label: 'ฉาบผนังด้านนอก', value: outputs.exterior, unit: 'ตร.ม.' },
                    { label: 'ฉาบผนังด้านใน', value: outputs.interior, unit: 'ตร.ม.' },
                    { label: 'พื้นที่ฉาบรวม', value: outputs.total, unit: 'ตร.ม.' },
                ]}
                note="พื้นที่ฉาบด้านนอก/ด้านในใช้ต่อในขั้นตอนทาสีให้อัตโนมัติ" />
        </CalculatorShell>
    );
}
