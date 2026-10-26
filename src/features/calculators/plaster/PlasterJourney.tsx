'use client';

import { plaster, plasterRowArea, type PlasterRow } from '@/domain/calculators/plaster';
import { BRICK_WALL_PARTS, netByPartKey } from '@/domain/calculators/brick';
import type { CalcContext } from '@/domain/calculators/types';
import { SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import {
    ChoiceButtons, FieldNote, FromLevel, Hint, ResultSummary, SumInput, outOfRange,
} from '@/components/sheet/journey';
import { isStructural, PlasterTable } from './PlasterTable';

const SIDE_CHOICES = [
    { value: 0, label: 'ไม่ฉาบ' },
    { value: 1, label: '1 ด้าน' },
    { value: 2, label: '2 ด้าน' },
];

const kindLabel = (kind: string) => {
    const k = kind.trim();
    return k === 'ฉาบภายนอก' ? 'ฉาบด้านนอก' : k === 'ฉาบภายใน' ? 'ฉาบด้านใน' : 'ฉาบ (ยังไม่เลือกด้าน)';
};

interface Group { part: string; rows: { row: PlasterRow; index: number }[] }

/** Rows grouped by wall part, in the order the parts first appear (a part's inside and outside rows together). */
function groupRows(rows: PlasterRow[]): Group[] {
    const groups: Group[] = [];
    rows.forEach((row, index) => {
        const part = row.wallPart.trim();
        const g = groups.find(x => x.part === part);
        if (g) g.rows.push({ row, index });
        else groups.push({ part, rows: [{ row, index }] });
    });
    return groups;
}

export default function PlasterJourney() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(plaster);
    const ctx: CalcContext = { outputs: id => result.calcOutputs[id] };
    const brickNet = (part: string) => result.calcOutputs.brick?.[netByPartKey(part)] ?? 0;
    const setRow = (i: number, patch: Partial<PlasterRow>) =>
        update(p => ({ ...p, rows: p.rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

    const walls = BRICK_WALL_PARTS.map(part => ({ part, area: brickNet(part) })).filter(w => w.area !== 0);
    const noWalls = walls.length === 0;
    const groups = groupRows(input.rows);

    const group = (g: Group) => {
        const structural = g.rows.some(r => isStructural(r.row));
        const area = structural ? 0 : brickNet(g.part);
        return (
            <div key={g.part === '' ? '(blank)' : g.part} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                    <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold text-gray-800">
                            {structural ? 'ผนังโครงสร้าง (ผิวเสา-คาน)' : g.part === '' ? '(ยังไม่เลือกส่วนผนัง)' : g.part}
                        </div>
                        {structural && <Hint>ผิวเสา-คานคอนกรีตที่ต้องฉาบนอกเหนือจากผนังอิฐ (ไม่มีให้เว้นว่าง)</Hint>}
                    </div>
                    {!structural && g.part !== '' && (area !== 0
                        ? <span className="text-[12px] text-gray-600 tabular-nums">ผนัง {formatNumber(area)} ตร.ม. ต่อด้าน</span>
                        : !noWalls && <span className="text-[12px] text-gray-400">ไม่มีผนังนี้ในขั้นตอนก่ออิฐ</span>)}
                </div>
                <div className="mt-2 flex flex-col gap-2">
                    {g.rows.map(({ row, index }) => {
                        const rowArea = plasterRowArea(row, ctx);
                        return (
                            <div key={index} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                <span className="w-[96px] shrink-0 text-[13px] text-gray-700">{kindLabel(row.kind)}</span>
                                {isStructural(row) && (
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-[150px]">
                                            <SumInput value={row.manualArea ?? 0} placeholder="เช่น 25+6.24"
                                                ariaLabel="พื้นที่ผิวเสา-คาน ต่อด้าน (ตร.ม.)"
                                                onChange={manualArea => setRow(index, { manualArea })} />
                                        </span>
                                        <span className="text-[12px] text-gray-500">ตร.ม. ต่อด้าน</span>
                                    </span>
                                )}
                                <ChoiceButtons ariaLabel={`${g.part} ${kindLabel(row.kind)} กี่ด้าน`} size="small"
                                    options={SIDE_CHOICES} value={row.sides} onChange={sides => setRow(index, { sides })} />
                                <span className="ml-auto text-[13px] tabular-nums px-2 py-0.5 rounded"
                                    style={{ background: rowArea > 0 ? SHEET_COLORS.calc : undefined }}>
                                    {rowArea > 0 ? `= ${formatNumber(rowArea)} ตร.ม.` : <span className="text-gray-400">—</span>}
                                </span>
                            </div>
                        );
                    })}
                    {structural && g.rows.map(({ row, index }) => {
                        const note = outOfRange(row.manualArea ?? 0, 1, 500, 'ตร.ม.');
                        return note === undefined ? null : <FieldNote key={`n${String(index)}`}>{note}</FieldNote>;
                    })}
                </div>
            </div>
        );
    };

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
                    // Each wall card below shows its own area: here only where the areas come from.
                    : <>ใช้พื้นที่ผนังที่ก่อไว้ {formatNumber(walls.length, 0)} ส่วน (หักประตู-หน้าต่างแล้ว) — ไม่ต้องกรอกซ้ำ</>}
            </FromLevel>

            <SheetCard title="ผนังที่ต้องฉาบ">
                <p className="mb-3 text-[12px] text-gray-500">ตั้งด้านที่ฉาบตามงานทั่วไปไว้แล้ว</p>
                <div className="flex flex-col gap-2">{groups.map(group)}</div>
            </SheetCard>

            <AdvancedSection title="ตั้งค่ารายการฉาบ">
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
