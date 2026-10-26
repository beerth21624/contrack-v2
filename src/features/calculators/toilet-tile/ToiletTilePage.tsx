'use client';

import type { ReactNode } from 'react';
import { Button, Select } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
    toiletTile, toiletTileArea, bathroomGroups, bathroomPerimeter, newBathroomRows, newToiletRow, nextBathroomName,
    renameBathroom, setBathroomFloorSize, toiletRowKind, TOILET_TILE_CODES, TOILET_TILE_ITEMS,
    TOILET_TILE_SURFACES, type BathroomGroup, type ToiletTileInput, type ToiletTileRow,
} from '@/domain/calculators/toilet-tile';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber, SHEET_COLORS } from '@/components/sheet/NumberCell';
import {
    AddButton, EmptyState, FillProgress, NameInput, PlanCard, PlanField, PresetChips, ResultSummary, countFill, fillState,
    outOfRange, type FillState,
} from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';
import { OptionalNumberCell } from './OptionalNumberCell';

type DimKey = 'width' | 'length' | 'height' | 'openings';

/** Surface / item that go with each code — filled in when the code is picked and they are still blank. */
const CODE_DEFAULTS: Record<string, { surface: string; item: string }> = {
    F3: { surface: 'พื้น', item: 'ปูกระเบื้องแกรนิตโต้ ชนิดกันลื่น' },
    P3: { surface: 'ผนัง', item: 'กรุกระเบื้องแกรนิตโต้' },
};

// ─── Journey mode: one card per bathroom (rows sharing a ตำแหน่ง) ───

/** Tile height of a bathroom wall: half / common / full height (the Excel sample tiles 2.40 m, to the ceiling). */
const FULL_TILE_HEIGHT = 2.4;
const TILE_HEIGHTS = [1.2, 1.5, 2.0, FULL_TILE_HEIGHT];
const tileHeightLabel = (v: number) => (v === FULL_TILE_HEIGHT ? 'เต็มผนัง' : v.toFixed(1));

const filled = (v: number | undefined) => v !== undefined && Number.isFinite(v) && v > 0;
const plausible = (v: number | undefined, min: number, max: number) => (v === undefined ? undefined : outOfRange(v, min, max, 'ม.'));

/** Plan values a bathroom still needs, in reading order. */
function missingOf(input: ToiletTileInput, group: BathroomGroup): string[] {
    const rows = group.rows.flatMap(i => (input.rows[i] ? [input.rows[i]] : []));
    const out: string[] = [];
    const floor = rows.filter(r => toiletRowKind(r) === 'floor');
    const wall = rows.filter(r => toiletRowKind(r) === 'wall');
    if (floor.some(r => !filled(r.width) || !filled(r.length))) out.push('ขนาดพื้น');
    if (wall.some(r => !filled(r.length))) out.push('ความยาวรอบห้อง');
    if (wall.some(r => !filled(r.height))) out.push('ความสูงกระเบื้องผนัง');
    if (rows.some(r => toiletRowKind(r) === 'other')) out.push('พื้นหรือผนัง');
    if (rows.length === 0) out.push('พื้นและผนัง');
    return out;
}
const startedOf = (input: ToiletTileInput, group: BathroomGroup) =>
    group.rows.some(i => {
        const r = input.rows[i];
        return r !== undefined && (filled(r.width) || filled(r.length) || filled(r.height));
    });
const stateOf = (input: ToiletTileInput, group: BathroomGroup): FillState =>
    fillState([missingOf(input, group).length === 0], startedOf(input, group));

/** A labelled blank-able number input of a bathroom card (a blank cell is not 0 here, as in Excel). */
function Dim({ label, hint, value, onCommit, extra, note, missing }: {
    label: string; hint?: string; value: number | undefined; onCommit: (v: number | undefined) => void; extra?: ReactNode;
    note?: string; missing?: boolean;
}) {
    return (
        <PlanField label={label} hint={hint} note={note} missing={missing}>
            <span className={`block w-[120px] rounded ${missing ? 'ring-1 ring-red-400' : ''}`}>
                <OptionalNumberCell value={value} ariaLabel={label} onCommit={onCommit} />
            </span>
            {extra}
        </PlanField>
    );
}

function AreaOf({ row }: { row: ToiletTileRow }) {
    const area = toiletTileArea(row) ?? 0;
    if (area === 0) return null;
    return (
        <div className="flex flex-col gap-0.5 sm:ml-auto sm:text-right">
            <span className="text-[12px] text-gray-500">พื้นที่</span>
            <span className={`tabular-nums px-2 py-0.5 rounded-sm ${area < 0 ? 'text-red-600' : ''}`} style={{ background: SHEET_COLORS.calc }}>
                {formatNumber(area)} ตร.ม.
            </span>
        </div>
    );
}

function BathroomCard({ index, group, input, update }: {
    index: number; group: BathroomGroup; input: ToiletTileInput; update: UseCalculator<ToiletTileInput>['update'];
}) {
    const setRow = (i: number, patch: Partial<ToiletTileRow>) =>
        update(p => ({ ...p, rows: p.rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
    const removeRow = (i: number) => update(p => ({ ...p, rows: p.rows.filter((_, j) => j !== i) }));
    const addRow = (kind: 'floor' | 'wall') => update(p => {
        const row = newToiletRow(kind, group.name);
        const perimeter = kind === 'wall' ? bathroomPerimeter(p, group.name) : undefined;
        return { ...p, rows: [...p.rows, perimeter === undefined ? row : { ...row, length: perimeter }] };
    });
    // "ทำซ้ำ": every row of this bathroom under the next free name, right after it.
    const duplicate = () => update(p => {
        const name = nextBathroomName(p);
        const copies = p.rows.filter(r => r.location.trim() === group.name).map(r => ({ ...r, location: name }));
        const last = p.rows.reduce((at, r, j) => (r.location.trim() === group.name ? j : at), p.rows.length - 1);
        return { ...p, rows: [...p.rows.slice(0, last + 1), ...copies, ...p.rows.slice(last + 1)] };
    });
    const perimeter = bathroomPerimeter(input, group.name);
    const state = stateOf(input, group);
    const missing = state === 'missing' ? new Set(missingOf(input, group)) : new Set<string>();
    const rows = group.rows.flatMap(i => (input.rows[i] ? [input.rows[i]] : []));
    const sumOf = (kind: 'floor' | 'wall') =>
        rows.filter(r => toiletRowKind(r) === kind).reduce((s, r) => s + (toiletTileArea(r) ?? 0), 0);
    const floorArea = sumOf('floor');
    const wallArea = sumOf('wall');
    const result = floorArea !== 0 || wallArea !== 0
        ? `พื้น ${formatNumber(floorArea)} · ผนัง ${formatNumber(wallArea)} ตร.ม.`
        : undefined;

    return (
        <PlanCard index={index} state={state}
            title={<NameInput value={group.name} placeholder="ชื่อห้องน้ำ" ariaLabel={`ชื่อห้องน้ำที่ ${String(index)}`}
                onChange={name => update(p => renameBathroom(p, group.name, name))} />}
            result={result} onDuplicate={duplicate} hasData={startedOf(input, group)}
            onDelete={() => update(p => ({ ...p, rows: p.rows.filter(r => r.location.trim() !== group.name) }))}
            deleteTitle={`ลบ "${group.name === '' ? 'ห้องนี้' : group.name}" ทั้งห้อง?`}
            missingText={`ยังขาด: ${missingOf(input, group).join(', ')}`}>
            <div className="flex flex-col gap-2">
            {group.rows.map(i => {
                const r = input.rows[i];
                if (!r) return null;
                const kind = toiletRowKind(r);
                const del = <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="ลบแถว" onClick={() => removeRow(i)} />;
                if (kind === 'floor') {
                    const need = missing.has('ขนาดพื้น');
                    return (
                        <div key={i} className="flex flex-wrap items-start gap-3 bg-gray-50 rounded-md px-3 py-2">
                            <div className="w-[120px] text-[13px] font-medium text-gray-800 pt-4">พื้น<div className="text-[11px] font-normal text-gray-500">กระเบื้องกันลื่น</div></div>
                            <Dim label="กว้างห้อง (ม.)" value={r.width} missing={need && !filled(r.width)} note={plausible(r.width, 0.8, 6)}
                                onCommit={v => update(p => setBathroomFloorSize(p, i, { width: v }))} />
                            <Dim label="ยาวห้อง (ม.)" value={r.length} missing={need && !filled(r.length)} note={plausible(r.length, 0.8, 6)}
                                onCommit={v => update(p => setBathroomFloorSize(p, i, { length: v }))} />
                            <AreaOf row={r} />
                            <div className="pt-4">{del}</div>
                        </div>
                    );
                }
                if (kind === 'wall') {
                    const canUse = perimeter !== undefined && Math.abs(perimeter - (r.length ?? NaN)) >= 1e-9;
                    const gross = (r.length ?? 0) * (r.height ?? 0);
                    const tooMuchOpening = gross > 0 && (r.openings ?? 0) > gross;
                    return (
                        <div key={i} className="flex flex-col gap-2 bg-gray-50 rounded-md px-3 py-2">
                            <div className="flex flex-wrap items-start gap-3">
                                <div className="w-[120px] text-[13px] font-medium text-gray-800 pt-4">ผนัง<div className="text-[11px] font-normal text-gray-500">กรุกระเบื้อง</div></div>
                                <Dim label="ความยาวรอบห้อง (ม.)" value={r.length} onCommit={v => setRow(i, { length: v })}
                                    missing={missing.has('ความยาวรอบห้อง') && !filled(r.length)} note={plausible(r.length, 2, 30)}
                                    hint="ใส่ขนาดพื้นแล้วคิดให้: 2 × (กว้าง + ยาว)"
                                    extra={canUse && (
                                        <Button size="small" type="link" className="!px-0 !h-auto self-start" onClick={() => setRow(i, { length: perimeter })}>
                                            ใช้รอบห้อง {formatNumber(perimeter)} ม.
                                        </Button>
                                    )} />
                                <Dim label="ความสูงที่กรุกระเบื้อง (ม.)" value={r.height} onCommit={v => setRow(i, { height: v })}
                                    missing={missing.has('ความสูงกระเบื้องผนัง') && !filled(r.height)} note={plausible(r.height, 0.3, 4)}
                                    extra={<PresetChips values={TILE_HEIGHTS} current={r.height ?? 0} format={tileHeightLabel}
                                        onPick={v => setRow(i, { height: v })} />} />
                                <Dim label="หักช่องเปิด (ตร.ม.)" value={r.openings} onCommit={v => setRow(i, { openings: v })}
                                    hint="ประตู + หน้าต่าง เช่น 0.7*2+0.5*1.8" />
                                <AreaOf row={r} />
                                <div className="pt-4">{del}</div>
                            </div>
                            {tooMuchOpening && (
                                <div className="text-[12px] text-red-600">ช่องเปิดมากกว่าพื้นที่ผนัง — ตรวจความยาวรอบห้อง ความสูง หรือขนาดช่องเปิด</div>
                            )}
                        </div>
                    );
                }
                return (
                    <div key={i} className="flex flex-wrap items-start gap-3 bg-gray-50 rounded-md px-3 py-2">
                        <div className="w-[120px] text-[13px] text-gray-800 pt-1">
                            <Select<string> size="small" style={{ width: 110 }} placeholder="พื้นหรือผนัง" value={undefined}
                                options={[{ value: 'F3', label: 'พื้น' }, { value: 'P3', label: 'ผนัง' }]}
                                onChange={(v: string) => {
                                    const d = CODE_DEFAULTS[v];
                                    setRow(i, d ? { code: v, surface: d.surface, item: d.item } : { code: v });
                                }} />
                            <div className="text-[11px] text-gray-400 mt-1">ยังไม่ได้เลือก — ไม่นับเข้า BOQ</div>
                        </div>
                        <Dim label="กว้าง (ม.)" value={r.width} onCommit={v => setRow(i, { width: v })} />
                        <Dim label="ยาว (ม.)" value={r.length} onCommit={v => setRow(i, { length: v })} />
                        <Dim label="สูง (ม.)" value={r.height} onCommit={v => setRow(i, { height: v })} />
                        <Dim label="หักช่องเปิด (ตร.ม.)" value={r.openings} onCommit={v => setRow(i, { openings: v })} />
                        <AreaOf row={r} />
                        <div className="pt-4">{del}</div>
                    </div>
                );
            })}

            <div className="flex gap-2">
                <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => addRow('floor')}>พื้น</Button>
                <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => addRow('wall')}>ผนัง</Button>
            </div>
            </div>
        </PlanCard>
    );
}

function ToiletTileJourney({ input, update, outputs }: {
    input: ToiletTileInput; update: UseCalculator<ToiletTileInput>['update']; outputs: Record<string, number>;
}) {
    const groups = bathroomGroups(input);
    const add = () => update(p => ({ ...p, rows: [...p.rows, ...newBathroomRows(nextBathroomName(p))] }));
    const states = groups.map(g => stateOf(input, g));
    return (
        <>
            <SheetCard title="ห้องน้ำ">
                {groups.length === 0
                    ? (
                        <EmptyState text="ยังไม่มีห้องน้ำ — เปิดแปลนห้องน้ำ แล้วเพิ่มทีละห้อง (ขนาดห้อง ความสูงที่กรุกระเบื้อง และช่องเปิด)"
                            addLabel="เพิ่มห้องน้ำ" onAdd={add} />
                    )
                    : (
                        <div className="flex flex-col gap-2">
                            {groups.length >= 5 && <FillProgress {...countFill(states)} noun="ห้อง" />}
                            {groups.map((g, k) => <BathroomCard key={g.name} index={k + 1} group={g} input={input} update={update} />)}
                            <AddButton label="เพิ่มห้องน้ำ" onClick={add} />
                            <p className="text-[12px] text-gray-500">
                                พื้นห้องน้ำใช้กระเบื้องแกรนิตโต้ชนิดกันลื่น ผนังกรุกระเบื้องแกรนิตโต้ — ช่องตัวเลขพิมพ์เป็นสูตรได้ เช่น 2*(2.3+3)
                            </p>
                        </div>
                    )}
            </SheetCard>

            <ResultSummary items={[
                { label: 'ห้องน้ำ', value: groups.length, unit: 'ห้อง', digits: 0 },
                { label: 'ปูกระเบื้องพื้น', value: outputs.R210, unit: 'ตร.ม.' },
                { label: 'กรุกระเบื้องผนัง', value: outputs.R211, unit: 'ตร.ม.' },
            ]} />
        </>
    );
}

export default function ToiletTilePage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(toiletTile);
    const inJourney = useJourneyMode();

    if (inJourney) {
        return (
            <CalculatorShell def={toiletTile} result={result} isDefault={isDefault} onReset={reset}>
                <ToiletTileJourney input={input} update={update} outputs={outputs} />
            </CalculatorShell>
        );
    }

    const setRow = (i: number, patch: Partial<ToiletTileRow>) =>
        update(p => ({ ...p, rows: p.rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

    const dim = (key: DimKey, title: string, width = 90) => ({
        kind: 'label' as const, key, title, width,
        get: (r: ToiletTileRow, i: number) => (
            <OptionalNumberCell value={r[key]} ariaLabel={`${title} แถว ${i + 1}`}
                onCommit={v => setRow(i, { [key]: v })} />
        ),
    });

    return (
        <CalculatorShell def={toiletTile} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title=": ตารางคำนวณปริมาณวัสดุตกแต่งผิวพื้น-ผนัง">
                <EditableTable<ToiletTileRow>
                    rows={input.rows}
                    onChange={rows => update({ rows })}
                    newRow={() => ({ code: '', surface: '', item: '', location: '' })}
                    addLabel="+ เพิ่มรายการ"
                    columns={[
                        { kind: 'select', key: 'code', title: 'สัญลักษณ์', width: 80,
                            options: TOILET_TILE_CODES.map(v => ({ value: v })),
                            get: r => r.code,
                            set: (r, v) => ({
                                ...r, code: v,
                                surface: r.surface.trim() === '' ? (CODE_DEFAULTS[v]?.surface ?? '') : r.surface,
                                item: r.item.trim() === '' ? (CODE_DEFAULTS[v]?.item ?? '') : r.item,
                            }) },
                        { kind: 'select', key: 'surface', title: 'พื้น/ผนัง', width: 80,
                            options: TOILET_TILE_SURFACES.map(v => ({ value: v })),
                            get: r => r.surface, set: (r, v) => ({ ...r, surface: v }) },
                        { kind: 'select', key: 'item', title: 'รายการ', width: 220,
                            options: TOILET_TILE_ITEMS.map(v => ({ value: v })),
                            get: r => r.item.trim(), set: (r, v) => ({ ...r, item: v }) },
                        dim('width', 'กว้าง (ม.)'),
                        dim('length', 'ยาว (ม.)'),
                        dim('height', 'สูง (ม.)'),
                        dim('openings', 'ช่องเปิด (ตร.ม.)', 100),
                        { kind: 'calc', key: 'area', title: 'รวม (ตร.ม.)', width: 100, get: r => toiletTileArea(r) },
                        { kind: 'text', key: 'location', title: 'ตำแหน่ง', width: 120,
                            get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>รวม = กว้าง × ยาว × สูง (คูณเฉพาะช่องที่กรอก) − ช่องเปิด · ไม่กรอกกว้าง/ยาว/สูง = ว่าง</li>
                    <li>F3 = พื้น (ปูกระเบื้องแกรนิตโต้ ชนิดกันลื่น): กรอกกว้าง × ยาว ของห้องน้ำ</li>
                    <li>P3 = ผนัง (กรุกระเบื้องแกรนิตโต้): ยาว = ความยาวรอบห้อง เช่น 2 × (2.3 + 3) = 10.6 ม., สูง = ความสูงที่กรุกระเบื้อง</li>
                    <li>ช่องเปิด กรอกแยกแต่ละห้องน้ำ — ค่าตัวอย่าง Excel = ประตู 0.7 × 2 + หน้าต่าง 0.5 × 1.8 = 2.3 ตร.ม.</li>
                </ul>
            </SheetCard>

            <SheetCard title="สรุปพื้นที่กระเบื้องห้องน้ำ (ส่งเข้า BOQ หมวด 21)">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <CalcField label="ปูกระเบื้องแกรนิตโต้พื้น ชนิดกันลื่น (F3)" value={outputs.R210} unit="ตร.ม." strong />
                    <CalcField label="กรุกระเบื้องแกรนิตโต้ผนัง (P3)" value={outputs.R211} unit="ตร.ม." strong />
                </div>
                <p className="mt-2 text-[12px] text-gray-500">
                    งานระบบประปา ท่อน้ำดี ในหมวด 21 มาจากโปรแกรมท่อน้ำดี (Water Pipe)
                </p>
            </SheetCard>
        </CalculatorShell>
    );
}
