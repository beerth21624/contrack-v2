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
    AddButton, EmptyState, FillProgress, MissingRing, NameInput, PlanCard, PlanField, PresetChips, RequiredScope, ResultSummary, countFill,
    fillState,
    outOfRange, type FillState,
} from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';
import { OptionalNumberCell } from './OptionalNumberCell';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

type DimKey = 'width' | 'length' | 'height' | 'openings';

/** Surface / item that go with each code — filled in when the code is picked and they are still blank. */
const CODE_DEFAULTS: Record<string, { surface: string; item: string }> = {
    /* eslint-disable no-restricted-syntax -- stored row values (domain data), not UI text */
    F3: { surface: 'พื้น', item: 'ปูกระเบื้องแกรนิตโต้ ชนิดกันลื่น' },
    P3: { surface: 'ผนัง', item: 'กรุกระเบื้องแกรนิตโต้' },
    /* eslint-enable no-restricted-syntax */
};

// ─── Journey mode: one card per bathroom (rows sharing a ตำแหน่ง) ───

/** Tile height of a bathroom wall: half / common / full height (the Excel sample tiles 2.40 m, to the ceiling). */
const FULL_TILE_HEIGHT = 2.4;
const TILE_HEIGHTS = [1.2, 1.5, 2.0, FULL_TILE_HEIGHT];
const tileHeightLabel = (t: CalcT, v: number) => (v === FULL_TILE_HEIGHT ? t('toiletTile.fullWall') : v.toFixed(1));

const filled = (v: number | undefined) => v !== undefined && Number.isFinite(v) && v > 0;
const plausible = (t: CalcT, v: number | undefined, min: number, max: number) => (v === undefined ? undefined : outOfRange(v, min, max, t('common.m')));

/** Plan values a bathroom still needs, in reading order. */
function missingOf(t: CalcT, input: ToiletTileInput, group: BathroomGroup): string[] {
    const rows = group.rows.flatMap(i => (input.rows[i] ? [input.rows[i]] : []));
    const out: string[] = [];
    const floor = rows.filter(r => toiletRowKind(r) === 'floor');
    const wall = rows.filter(r => toiletRowKind(r) === 'wall');
    if (floor.some(r => !filled(r.width) || !filled(r.length))) out.push(t('toiletTile.floorSize'));
    if (wall.some(r => !filled(r.length))) out.push(t('toiletTile.roomPerimeter'));
    if (wall.some(r => !filled(r.height))) out.push(t('toiletTile.wallTileHeight'));
    if (rows.some(r => toiletRowKind(r) === 'other')) out.push(t('toiletTile.floorOrWall'));
    if (rows.length === 0) out.push(t('toiletTile.floorAndWall'));
    return out;
}
const startedOf = (input: ToiletTileInput, group: BathroomGroup) =>
    group.rows.some(i => {
        const r = input.rows[i];
        return r !== undefined && (filled(r.width) || filled(r.length) || filled(r.height));
    });
const stateOf = (t: CalcT, input: ToiletTileInput, group: BathroomGroup): FillState =>
    fillState([missingOf(t, input, group).length === 0], startedOf(input, group));

/** A labelled blank-able number input of a bathroom card (a blank cell is not 0 here, as in Excel). */
function Dim({ label, hint, value, onCommit, extra, note, missing, fieldKey }: {
    label: string; hint?: string; value: number | undefined; onCommit: (v: number | undefined) => void; extra?: ReactNode;
    note?: string; missing?: boolean; fieldKey?: DimKey;
}) {
    return (
        <PlanField label={label} hint={hint} note={note} fieldKey={fieldKey} ringControl={false}>
            <MissingRing fieldKey={fieldKey} missing={missing} className="block w-[120px]">
                <OptionalNumberCell value={value} ariaLabel={label} onCommit={onCommit} />
            </MissingRing>
            {extra}
        </PlanField>
    );
}

function AreaOf({ row }: { row: ToiletTileRow }) {
    const t = useTranslations('calculators');
    const area = toiletTileArea(row) ?? 0;
    if (area === 0) return null;
    return (
        <div className="flex flex-col gap-0.5 sm:ml-auto sm:text-right">
            <span className="text-[12px] text-gray-500">{t('toiletTile.area')}</span>
            <span className={`tabular-nums px-2 py-0.5 rounded-sm ${area < 0 ? 'text-red-600' : ''}`} style={{ background: SHEET_COLORS.calc }}>
                {formatNumber(area)}{t('common.sqM2')}
            </span>
        </div>
    );
}

function BathroomCard({ index, group, input, update }: {
    index: number; group: BathroomGroup; input: ToiletTileInput; update: UseCalculator<ToiletTileInput>['update'];
}) {
    const t = useTranslations('calculators');
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
    const state = stateOf(t, input, group);
    const missing = state === 'missing' ? new Set(missingOf(t, input, group)) : new Set<string>();
    const rows = group.rows.flatMap(i => (input.rows[i] ? [input.rows[i]] : []));
    const sumOf = (kind: 'floor' | 'wall') =>
        rows.filter(r => toiletRowKind(r) === kind).reduce((s, r) => s + (toiletTileArea(r) ?? 0), 0);
    const floorArea = sumOf('floor');
    const wallArea = sumOf('wall');
    const result = floorArea !== 0 || wallArea !== 0
        ? t('toiletTile.floorWallSqM', { v: formatNumber(floorArea), v2: formatNumber(wallArea) })
        : undefined;

    /** One floor / wall row of the bathroom (its fields belong to that row of the input). */
    const rowView = (i: number, r: ToiletTileRow) => {
        const kind = toiletRowKind(r);
        const del = <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={t('toiletTile.deleteRow')} onClick={() => removeRow(i)} />;
        if (kind === 'floor') {
            const need = missing.has(t('toiletTile.floorSize'));
            return (
                <div key={i} className="flex flex-wrap items-start gap-3 bg-gray-50 rounded-md px-3 py-2">
                    <div className="w-full sm:w-[120px] text-[13px] font-medium text-gray-800 sm:pt-4">{t('common.slab')}<div className="text-[12px] font-normal text-gray-500">{t('toiletTile.antiSlipTile')}</div></div>
                    <Dim label={t('toiletTile.roomWidthM')} fieldKey="width" value={r.width} missing={need && !filled(r.width)} note={plausible(t, r.width, 0.8, 6)}
                        onCommit={v => update(p => setBathroomFloorSize(p, i, { width: v }))} />
                    <Dim label={t('toiletTile.roomLengthM')} fieldKey="length" value={r.length} missing={need && !filled(r.length)} note={plausible(t, r.length, 0.8, 6)}
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
                        <div className="w-full sm:w-[120px] text-[13px] font-medium text-gray-800 sm:pt-4">{t('toiletTile.wall')}<div className="text-[12px] font-normal text-gray-500">{t('toiletTile.wallTiling')}</div></div>
                        <Dim label={t('toiletTile.roomPerimeterM')} fieldKey="length" value={r.length} onCommit={v => setRow(i, { length: v })}
                            missing={missing.has(t('toiletTile.roomPerimeter')) && !filled(r.length)} note={plausible(t, r.length, 2, 30)}
                            hint={t('toiletTile.enterTheFloorSizeAnd')}
                            extra={canUse && (
                                <Button size="small" type="link" className="!px-0 !h-auto self-start" onClick={() => setRow(i, { length: perimeter })}>
                                    {t('toiletTile.useTheRoomPerimeter')}{formatNumber(perimeter)}{t('common.m3')}
                                </Button>
                            )} />
                        <Dim label={t('toiletTile.tiledHeightM')} fieldKey="height" value={r.height} onCommit={v => setRow(i, { height: v })}
                            missing={missing.has(t('toiletTile.wallTileHeight')) && !filled(r.height)} note={plausible(t, r.height, 0.3, 4)}
                            extra={<PresetChips values={TILE_HEIGHTS} current={r.height ?? 0} format={v => tileHeightLabel(t, v)}
                                onPick={v => setRow(i, { height: v })} />} />
                        <Dim label={t('toiletTile.deductOpeningsSqM')} value={r.openings} onCommit={v => setRow(i, { openings: v })}
                            hint={t('toiletTile.doorsWindowsEG0')} />
                        <AreaOf row={r} />
                        <div className="pt-4">{del}</div>
                    </div>
                    {tooMuchOpening && (
                        <div className="text-[12px] text-red-600">{t('toiletTile.theOpeningsAreLargerThan')}</div>
                    )}
                </div>
            );
        }
        return (
            <div key={i} className="flex flex-wrap items-start gap-3 bg-gray-50 rounded-md px-3 py-2">
                <div className="w-[120px] text-[13px] text-gray-800 pt-1">
                    <Select<string> size="small" style={{ width: 110 }} placeholder={t('toiletTile.floorOrWall')} value={undefined}
                        options={[{ value: 'F3', label: t('common.slab') }, { value: 'P3', label: t('toiletTile.wall') }]}
                        onChange={(v: string) => {
                            const d = CODE_DEFAULTS[v];
                            setRow(i, d ? { code: v, surface: d.surface, item: d.item } : { code: v });
                        }} />
                    <div className="text-[12px] text-gray-400 mt-1">{t('toiletTile.notSelectedNotCountedIn')}</div>
                </div>
                <Dim label={t('common.widthM')} value={r.width} onCommit={v => setRow(i, { width: v })} />
                <Dim label={t('common.lengthM2')} value={r.length} onCommit={v => setRow(i, { length: v })} />
                <Dim label={t('common.heightM')} value={r.height} onCommit={v => setRow(i, { height: v })} />
                <Dim label={t('toiletTile.deductOpeningsSqM')} value={r.openings} onCommit={v => setRow(i, { openings: v })} />
                <AreaOf row={r} />
                <div className="pt-4">{del}</div>
            </div>
        );
    };

    return (
        <PlanCard index={index} state={state}
            title={<NameInput value={group.name} placeholder={t('toiletTile.bathroomName')} ariaLabel={t('toiletTile.bathroomName2', { v: String(index) })}
                onChange={name => update(p => renameBathroom(p, group.name, name))} />}
            result={result} onDuplicate={duplicate} hasData={startedOf(input, group)}
            onDelete={() => update(p => ({ ...p, rows: p.rows.filter(r => r.location.trim() !== group.name) }))}
            deleteTitle={t('toiletTile.deleteAndTheWholeRoom', { v: group.name === '' ? t('toiletTile.thisRoom') : group.name })}
            missingText={t('common.missing', { v: missingOf(t, input, group).join(', ') })}>
            <div className="flex flex-col gap-2">
            {group.rows.map(i => {
                const r = input.rows[i];
                if (!r) return null;
                return <RequiredScope key={i} scope={{ listKey: 'rows', itemIndex: i }}>{rowView(i, r)}</RequiredScope>;
            })}

            <div className="flex gap-2">
                <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => addRow('floor')}>{t('common.slab')}</Button>
                <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => addRow('wall')}>{t('toiletTile.wall')}</Button>
            </div>
            </div>
        </PlanCard>
    );
}

function ToiletTileJourney({ input, update, outputs }: {
    input: ToiletTileInput; update: UseCalculator<ToiletTileInput>['update']; outputs: Record<string, number>;
}) {
    const t = useTranslations('calculators');
    const groups = bathroomGroups(input);
    const add = () => update(p => ({ ...p, rows: [...p.rows, ...newBathroomRows(nextBathroomName(p))] }));
    const states = groups.map(g => stateOf(t, input, g));
    return (
        <>
            <SheetCard title={t('toiletTile.bathroom')}>
                {groups.length === 0
                    ? (
                        <EmptyState text={t('toiletTile.noBathroomsYetOpenThe')}
                            addLabel={t('toiletTile.addBathroom')} onAdd={add} />
                    )
                    : (
                        <div className="flex flex-col gap-2">
                            {groups.length >= 5 && <FillProgress {...countFill(states)} noun={t('common.room')} />}
                            {groups.map((g, k) => <BathroomCard key={g.name} index={k + 1} group={g} input={input} update={update} />)}
                            <AddButton label={t('toiletTile.addBathroom')} onClick={add} />
                            <p className="text-[12px] text-gray-500">
                                {t('toiletTile.bathroomFloorsUseAntiSlip')}
                            </p>
                        </div>
                    )}
            </SheetCard>

            <ResultSummary items={[
                { label: t('toiletTile.bathroom'), value: groups.length, unit: t('common.room'), digits: 0 },
                { label: t('toiletTile.floorTiling'), value: outputs.R210, unit: t('common.sqM') },
                { label: t('toiletTile.wallTiling2'), value: outputs.R211, unit: t('common.sqM') },
            ]} />
        </>
    );
}

export default function ToiletTilePage() {
    const t = useTranslations('calculators');
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
            <OptionalNumberCell value={r[key]} ariaLabel={t('toiletTile.row', { title, v: String(i + 1) })}
                onCommit={v => setRow(i, { [key]: v })} />
        ),
    });

    return (
        <CalculatorShell def={toiletTile} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title={t('toiletTile.floorAndWallFinishingMaterial')}>
                <EditableTable<ToiletTileRow>
                    rows={input.rows}
                    onChange={rows => update({ rows })}
                    newRow={() => ({ code: '', surface: '', item: '', location: '' })}
                    addLabel={t('common.addItem')}
                    columns={[
                        { kind: 'select', key: 'code', title: t('common.symbol'), width: 80,
                            options: TOILET_TILE_CODES.map(v => ({ value: v })),
                            get: r => r.code,
                            set: (r, v) => ({
                                ...r, code: v,
                                surface: r.surface.trim() === '' ? (CODE_DEFAULTS[v]?.surface ?? '') : r.surface,
                                item: r.item.trim() === '' ? (CODE_DEFAULTS[v]?.item ?? '') : r.item,
                            }) },
                        { kind: 'select', key: 'surface', title: t('toiletTile.floorWall'), width: 80,
                            options: TOILET_TILE_SURFACES.map(v => ({ value: v })),
                            get: r => r.surface, set: (r, v) => ({ ...r, surface: v }) },
                        { kind: 'select', key: 'item', title: t('common.item'), width: 220,
                            options: TOILET_TILE_ITEMS.map(v => ({ value: v })),
                            get: r => r.item.trim(), set: (r, v) => ({ ...r, item: v }) },
                        dim('width', t('common.widthM')),
                        dim('length', t('common.lengthM2')),
                        dim('height', t('common.heightM')),
                        dim('openings', t('toiletTile.openingsSqM'), 100),
                        { kind: 'calc', key: 'area', title: t('common.totalSqM'), width: 100, get: r => toiletTileArea(r) },
                        { kind: 'text', key: 'location', title: t('common.location'), width: 120,
                            get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>{t('toiletTile.totalWidthLengthHeightOnly')}</li>
                    <li>{t('toiletTile.f3FloorAntiSlipGranito')}</li>
                    <li>{t('toiletTile.p3WallGranitoTileWall')}</li>
                    <li>{t('toiletTile.enterTheOpeningsSeparatelyFor')}</li>
                </ul>
            </SheetCard>

            <SheetCard title={t('toiletTile.bathroomTileAreaSummarySent')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <CalcField label={t('toiletTile.antiSlipGranitoFloorTiling')} value={outputs.R210} unit={t('common.sqM')} strong />
                    <CalcField label={t('toiletTile.granitoWallTileCladdingP3')} value={outputs.R211} unit={t('common.sqM')} strong />
                </div>
                <p className="mt-2 text-[12px] text-gray-500">
                    {t('toiletTile.plumbingWorkCleanWaterPipes')}
                </p>
            </SheetCard>
        </CalculatorShell>
    );
}
