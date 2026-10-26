'use client';

import { App, Button } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import {
    floorTile, floorTileRowArea, FLOOR_TILE_CODES, FLOOR_TILE_DESCRIPTIONS, FLOOR_TILE_DESCRIPTION_ORDER,
    type FloorTileCode, type FloorTileInput, type FloorTileRow,
} from '@/domain/calculators/floor-tile';
import { ceiling } from '@/domain/calculators/ceiling';
import { calculatorInput } from '@/domain/project';
import { useProjectStore } from '@/store/project-store';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, ChoiceButtons, EmptyState, FillProgress, NameInput, PlanCard, PlanField, PlanNumber, ResultSummary,
    countFill, fillState, insertAfter, nextCopyName, patchAt, removeAt, type FillState,
} from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';
import { isBathroomName, roomsFromCeiling } from './fromCeiling';

const isCode = (v: string): v is FloorTileCode => (FLOOR_TILE_CODES as readonly string[]).includes(v);

/** Journey: short floor-finish names, with where the sample house uses each one. */
const PLAIN_TYPE: Record<FloorTileCode, string> = {
    F1: 'กระเบื้องแกรนิตโต้ (ห้องทั่วไป)',
    F3: 'กระเบื้องแกรนิตโต้ กันลื่น (เฉลียง, บันได)',
    F4: 'ปรับระดับ ทำกันซึม (ดาดฟ้า)',
};

const newJourneyRow = (): FloorTileRow => ({ code: 'F1', width: 0, length: 0, location: '' });

/** Journey: the three floor finishes as buttons (short names; the full name is the button's tooltip). */
const TYPE_CHOICES = FLOOR_TILE_CODES.map(c => ({
    value: c,
    label: { F1: 'แกรนิตโต้', F3: 'แกรนิตโต้ กันลื่น', F4: 'ปรับระดับ ทำกันซึม' }[c],
    hint: PLAIN_TYPE[c],
}));

/** Plan values a room card still needs, in reading order. */
function missingOf(r: FloorTileRow): string[] {
    const out: string[] = [];
    if (r.code === '') out.push('ชนิดพื้น');
    if (!(r.width > 0)) out.push('กว้าง');
    if (!(r.length > 0)) out.push('ยาว');
    return out;
}
const stateOf = (r: FloorTileRow): FillState => fillState([missingOf(r).length === 0], r.width > 0 || r.length > 0);
const isStair = (r: FloorTileRow) => r.location.includes('บันได');

/**
 * "คัดลอกห้องจากฝ้าเพดาน": the rooms of the ceiling step not on this list yet, as new editable rows (names and
 * sizes). `count` is 0 when there is nothing to copy.
 */
function useRoomsFromCeiling(rows: FloorTileRow[], onCopy: (rows: FloorTileRow[]) => void) {
    const { message } = App.useApp();
    const project = useProjectStore(s => s.project);
    const copy = roomsFromCeiling(calculatorInput(project, ceiling).rows, rows);
    const count = copy.rows.length;
    const run = () => {
        onCopy(copy.rows);
        const skipped = copy.skippedBathrooms > 0 ? ` (ไม่รวมห้องน้ำ ${String(copy.skippedBathrooms)} ห้อง)` : '';
        void message.success(`คัดลอก ${String(count)} ห้องแล้ว${skipped} — ตรวจชนิดพื้นอีกครั้ง`);
    };
    return { count, run, label: `คัดลอกห้องจากฝ้าเพดาน (${String(count)} ห้อง)` };
}

/** Journey mode: one card per room, read off the floor plan; live area per room, results reduced to the totals. */
function FloorTileJourney({ input, update, outputs }: {
    input: FloorTileInput; update: UseCalculator<FloorTileInput>['update']; outputs: Record<string, number>;
}) {
    const rows = input.rows;
    const setRows = (edit: (rows: FloorTileRow[]) => FloorTileRow[]) => update(p => ({ ...p, rows: edit(p.rows) }));
    const setRow = (i: number, patch: Partial<FloorTileRow>) => setRows(rs => patchAt(rs, i, patch));
    const add = () => setRows(rs => [...rs, newJourneyRow()]);
    const duplicate = (i: number) => setRows(rs => {
        const r = rs[i];
        return r ? insertAfter(rs, i, { ...r, location: nextCopyName(r.location, rs.map(x => x.location)) }) : rs;
    });
    const fromCeiling = useRoomsFromCeiling(rows, copied => setRows(rs => [...rs, ...copied]));
    const usedTypes = FLOOR_TILE_CODES.filter(c => (outputs[c] ?? 0) !== 0);
    const states = rows.map(stateOf);

    const card = (r: FloorTileRow, i: number) => {
        const state = states[i] ?? 'empty';
        const missing = state === 'missing' ? new Set(missingOf(r)) : new Set<string>();
        const area = floorTileRowArea(r);
        const stair = isStair(r);
        return (
            <PlanCard key={i} index={i + 1} state={state} scope={{ listKey: 'rows', itemIndex: i }}
                title={<NameInput value={r.location} placeholder="ชื่อห้อง เช่น ห้องนอน 1" ariaLabel={`ชื่อห้องที่ ${String(i + 1)}`}
                    onChange={location => setRow(i, { location })} />}
                result={area > 0 ? `${formatNumber(area)} ตร.ม.` : undefined}
                onDuplicate={() => duplicate(i)} onDelete={() => setRows(rs => removeAt(rs, i))} hasData={r.width > 0 || r.length > 0}
                deleteTitle="ลบห้องนี้?" missingText={`ยังขาด: ${missingOf(r).join(', ')}`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    <PlanField className="sm:col-span-2" label="ชนิดพื้น" fieldKey="code">
                        <ChoiceButtons ariaLabel="ชนิดพื้น" size="small" options={TYPE_CHOICES} value={r.code === '' ? undefined : r.code}
                            onChange={code => setRow(i, { code })} />
                    </PlanField>
                    <PlanNumber label={stair ? 'ความกว้างบันได' : 'กว้าง'} fieldKey="width" unit="ม." value={r.width} range={[0.3, 30]}
                        missing={missing.has('กว้าง')} onChange={width => setRow(i, { width })} />
                    <PlanNumber label={stair ? 'ลูกนอน + ลูกตั้ง' : 'ยาว'} fieldKey="length" unit="ม." value={r.length} range={[0.3, 30]}
                        missing={missing.has('ยาว')} hint={stair ? 'เช่น 0.9+0.45' : undefined}
                        onChange={length => setRow(i, { length })} />
                </div>
                {isBathroomName(r.location) && (
                    <div className="mt-2 text-[12px] text-amber-700">ห้องน้ำกรอกในขั้นตอนกระเบื้องห้องน้ำ — ที่นี่จะนับซ้ำ</div>
                )}
            </PlanCard>
        );
    };

    return (
        <>
            <SheetCard title="ห้องและชนิดพื้น">
                {rows.length === 0
                    ? (
                        // With rooms on the ceiling step, copying them is the quickest start.
                        <EmptyState text="ยังไม่มีห้อง — เปิดแปลนพื้น แล้วเพิ่มทีละห้อง (ชื่อห้อง ชนิดพื้น กว้าง × ยาว)"
                            note="ห้องน้ำไม่ต้องใส่ที่นี่ — มีขั้นตอนกระเบื้องห้องน้ำแยกต่างหาก"
                            {...(fromCeiling.count > 0
                                ? { addLabel: fromCeiling.label, onAdd: fromCeiling.run, actions: [{ label: 'เพิ่มห้อง', onClick: add }] }
                                : { addLabel: 'เพิ่มห้อง', onAdd: add })} />
                    )
                    : (
                        <div className="flex flex-col gap-2">
                            {rows.length >= 5 && <FillProgress {...countFill(states)} noun="ห้อง" />}
                            {rows.map(card)}
                            <AddButton label="เพิ่มห้อง" onClick={add} />
                            {fromCeiling.count > 0 && (
                                <Button type="link" size="small" className="self-start !px-0" icon={<CopyOutlined />} onClick={fromCeiling.run}>
                                    {fromCeiling.label}
                                </Button>
                            )}
                            <p className="text-[12px] text-gray-500">
                                ห้องรูปตัว L แบ่งเป็น 2 การ์ด · บันได: กว้าง = ความกว้างบันได, ยาว = ลูกนอน + ลูกตั้ง
                            </p>
                        </div>
                    )}
            </SheetCard>

            <ResultSummary items={[
                ...usedTypes.map(c => ({ label: PLAIN_TYPE[c], value: outputs[c], unit: 'ตร.ม.' })),
                { label: 'พื้นที่ปูพื้นรวม', value: outputs.total, unit: 'ตร.ม.' },
            ]} />
        </>
    );
}

export default function FloorTilePage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(floorTile);
    const inJourney = useJourneyMode();

    if (inJourney) {
        return (
            <CalculatorShell def={floorTile} result={result} isDefault={isDefault} onReset={reset}>
                <FloorTileJourney input={input} outputs={outputs} update={update} />
            </CalculatorShell>
        );
    }

    return (
        <CalculatorShell def={floorTile} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title=": ตารางคำนวณปริมาณวัสดุตกแต่งผิวพื้น">
                <EditableTable<FloorTileRow>
                    rows={input.rows}
                    onChange={rows => update({ rows })}
                    newRow={() => ({ code: '', width: 0, length: 0, location: '' })}
                    addLabel="+ เพิ่มรายการ"
                    columns={[
                        { kind: 'select', key: 'code', title: 'สัญลักษณ์', width: 80,
                            options: FLOOR_TILE_CODES.map(v => ({ value: v })),
                            get: r => r.code, set: (r, v) => ({ ...r, code: isCode(v) ? v : '' }) },
                        // Excel's C column is its own dropdown; here it selects the same code (O-13), in Excel's list order.
                        { kind: 'select', key: 'desc', title: 'รายการ', width: 260,
                            options: FLOOR_TILE_DESCRIPTION_ORDER.map(c => ({ value: c, label: FLOOR_TILE_DESCRIPTIONS[c] })),
                            get: r => r.code, set: (r, v) => ({ ...r, code: isCode(v) ? v : '' }) },
                        { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 90,
                            get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 90,
                            get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'calc', key: 'area', title: 'รวม (ตร.ม.)', width: 100, get: r => floorTileRowArea(r) },
                        { kind: 'text', key: 'location', title: 'ตำแหน่ง', width: 180,
                            get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>รวม (ตร.ม.) = กว้าง × ยาว</li>
                    <li>ตัวอย่าง Excel บันได (1)–(3): ยาว = 0.9 + 0.45 = 1.35 ม.</li>
                    <li>สัญลักษณ์ F1 / F3 / F4 ใช้รวมปริมาณเข้า BOQ หมวด 20 (ห้องน้ำอยู่ในโปรแกรมปูกระเบื้องห้องน้ำ)</li>
                </ul>
            </SheetCard>

            <SheetCard title="สรุปพื้นที่ปูกระเบื้องพื้น (ส่งเข้า BOQ หมวด 20)">
                <div className="max-w-xl">
                    {FLOOR_TILE_CODES.map(c => (
                        <CalcField key={c} label={`${c} ${FLOOR_TILE_DESCRIPTIONS[c]}`} value={outputs[c]} unit="ตร.ม." />
                    ))}
                    <CalcField label="รวมทั้งหมด" value={outputs.total} unit="ตร.ม." strong />
                </div>
            </SheetCard>
        </CalculatorShell>
    );
}
