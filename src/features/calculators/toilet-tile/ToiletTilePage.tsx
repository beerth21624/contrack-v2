'use client';

import type { ReactNode } from 'react';
import { Button, Popconfirm, Select } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
    toiletTile, toiletTileArea, bathroomGroups, bathroomPerimeter, newBathroomRows, newToiletRow, nextBathroomName,
    renameBathroom, setBathroomFloorSize, toiletRowKind, TOILET_TILE_CODES, TOILET_TILE_ITEMS, TOILET_TILE_SURFACES,
    type BathroomGroup, type ToiletTileInput, type ToiletTileRow,
} from '@/domain/calculators/toilet-tile';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber, SHEET_COLORS, TextCell } from '@/components/sheet/NumberCell';
import { EmptyState, ResultSummary } from '@/components/sheet/journey';
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

/** A labelled blank-able number input of a bathroom card. */
function Dim({ label, hint, value, onCommit, extra }: {
    label: string; hint?: string; value: number | undefined; onCommit: (v: number | undefined) => void; extra?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-0.5 min-w-[130px] max-w-[200px]">
            <span className="text-[12px] text-gray-700">{label}</span>
            <div className="w-[120px]"><OptionalNumberCell value={value} ariaLabel={label} onCommit={onCommit} /></div>
            {hint && <span className="text-[11px] text-gray-400 leading-tight">{hint}</span>}
            {extra}
        </div>
    );
}

function AreaOf({ row }: { row: ToiletTileRow }) {
    return (
        <div className="flex flex-col gap-0.5 ml-auto text-right">
            <span className="text-[12px] text-gray-500">พื้นที่</span>
            <span className="tabular-nums px-2 py-0.5 rounded-sm" style={{ background: SHEET_COLORS.calc }}>
                {formatNumber(toiletTileArea(row) ?? 0)} ตร.ม.
            </span>
        </div>
    );
}

function BathroomCard({ group, input, update }: {
    group: BathroomGroup; input: ToiletTileInput; update: UseCalculator<ToiletTileInput>['update'];
}) {
    const setRow = (i: number, patch: Partial<ToiletTileRow>) =>
        update(p => ({ ...p, rows: p.rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
    const removeRow = (i: number) => update(p => ({ ...p, rows: p.rows.filter((_, j) => j !== i) }));
    const addRow = (kind: 'floor' | 'wall') => update(p => {
        const row = newToiletRow(kind, group.name);
        const perimeter = kind === 'wall' ? bathroomPerimeter(p, group.name) : undefined;
        return { ...p, rows: [...p.rows, perimeter === undefined ? row : { ...row, length: perimeter }] };
    });
    const perimeter = bathroomPerimeter(input, group.name);

    return (
        <div className="border border-gray-200 rounded-lg p-3 flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <div className="w-[220px] rounded-sm font-semibold" style={{ background: SHEET_COLORS.input }}>
                    <TextCell value={group.name} placeholder="ชื่อห้องน้ำ" ariaLabel="ชื่อห้องน้ำ"
                        onCommit={v => update(p => renameBathroom(p, group.name, (v ?? '').trim()))} />
                </div>
                <Popconfirm title={`ลบ "${group.name === '' ? 'ห้องนี้' : group.name}" ทั้งห้อง?`} okText="ลบ" cancelText="ยกเลิก"
                    onConfirm={() => update(p => ({ ...p, rows: p.rows.filter(r => r.location.trim() !== group.name) }))}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />}>ลบห้อง</Button>
                </Popconfirm>
            </div>

            {group.rows.map(i => {
                const r = input.rows[i];
                if (!r) return null;
                const kind = toiletRowKind(r);
                const del = <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="ลบแถว" onClick={() => removeRow(i)} />;
                if (kind === 'floor') {
                    return (
                        <div key={i} className="flex flex-wrap items-start gap-3 bg-gray-50 rounded-md px-3 py-2">
                            <div className="w-[120px] text-[13px] font-medium text-gray-800 pt-4">พื้น<div className="text-[11px] font-normal text-gray-500">กระเบื้องกันลื่น</div></div>
                            <Dim label="กว้างห้อง (ม.)" value={r.width} onCommit={v => update(p => setBathroomFloorSize(p, i, { width: v }))} />
                            <Dim label="ยาวห้อง (ม.)" value={r.length} onCommit={v => update(p => setBathroomFloorSize(p, i, { length: v }))} />
                            <AreaOf row={r} />
                            <div className="pt-4">{del}</div>
                        </div>
                    );
                }
                if (kind === 'wall') {
                    const canUse = perimeter !== undefined && Math.abs(perimeter - (r.length ?? NaN)) >= 1e-9;
                    return (
                        <div key={i} className="flex flex-wrap items-start gap-3 bg-gray-50 rounded-md px-3 py-2">
                            <div className="w-[120px] text-[13px] font-medium text-gray-800 pt-4">ผนัง<div className="text-[11px] font-normal text-gray-500">กรุกระเบื้อง</div></div>
                            <Dim label="ความยาวรอบห้อง (ม.)" value={r.length} onCommit={v => setRow(i, { length: v })}
                                hint="ใส่ขนาดพื้นแล้วคิดให้: 2 × (กว้าง + ยาว)"
                                extra={canUse && (
                                    <Button size="small" type="link" className="!px-0 !h-auto self-start" onClick={() => setRow(i, { length: perimeter })}>
                                        ใช้รอบห้อง {formatNumber(perimeter)} ม.
                                    </Button>
                                )} />
                            <Dim label="ความสูงที่กรุกระเบื้อง (ม.)" value={r.height} onCommit={v => setRow(i, { height: v })} hint="เช่น 2.40" />
                            <Dim label="หักช่องเปิด (ตร.ม.)" value={r.openings} onCommit={v => setRow(i, { openings: v })}
                                hint="ประตู + หน้าต่าง เช่น 0.7*2+0.5*1.8" />
                            <AreaOf row={r} />
                            <div className="pt-4">{del}</div>
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
    );
}

function ToiletTileJourney({ input, update, outputs }: {
    input: ToiletTileInput; update: UseCalculator<ToiletTileInput>['update']; outputs: Record<string, number>;
}) {
    const groups = bathroomGroups(input);
    const add = () => update(p => ({ ...p, rows: [...p.rows, ...newBathroomRows(nextBathroomName(p))] }));
    return (
        <>
            <SheetCard title="ห้องน้ำ">
                {groups.length === 0
                    ? (
                        <EmptyState text="ยังไม่มีห้องน้ำ — เปิดแปลนห้องน้ำ แล้วเพิ่มทีละห้อง (ขนาดห้อง ความสูงที่กรุกระเบื้อง และช่องเปิด)"
                            addLabel="เพิ่มห้องน้ำ" onAdd={add} />
                    )
                    : (
                        <div className="flex flex-col gap-3">
                            {groups.map(g => <BathroomCard key={g.name} group={g} input={input} update={update} />)}
                            <Button type="dashed" icon={<PlusOutlined />} className="self-start" onClick={add}>เพิ่มห้องน้ำ</Button>
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
