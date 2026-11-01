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
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const isCode = (v: string): v is FloorTileCode => (FLOOR_TILE_CODES as readonly string[]).includes(v);

/** Journey: short floor-finish names, with where the sample house uses each one. */
const plainType = (t: CalcT): Record<FloorTileCode, string> => ({
    F1: t('floorTile.granitoTilesGeneralRooms'),
    F3: t('floorTile.antiSlipGranitoTilesBalcony'),
    F4: t('floorTile.levellingAndWaterproofingRoofDeck'),
});

const newJourneyRow = (): FloorTileRow => ({ code: 'F1', width: 0, length: 0, location: '' });

/** Journey: the three floor finishes as buttons (short names; the full name is the button's tooltip). */
const typeChoices = (t: CalcT) => FLOOR_TILE_CODES.map(c => ({
    value: c,
    label: { F1: t('floorTile.granito'), F3: t('floorTile.antiSlipGranito'), F4: t('floorTile.levellingAndWaterproofing') }[c],
    hint: plainType(t)[c],
}));

/** Plan values a room card still needs, in reading order. */
function missingOf(t: CalcT, r: FloorTileRow): string[] {
    const out: string[] = [];
    if (r.code === '') out.push(t('floorTile.floorType'));
    if (!(r.width > 0)) out.push(t('common.width'));
    if (!(r.length > 0)) out.push(t('common.length2'));
    return out;
}
const stateOf = (t: CalcT, r: FloorTileRow): FillState => fillState([missingOf(t, r).length === 0], r.width > 0 || r.length > 0);
// eslint-disable-next-line no-restricted-syntax -- matches stored/typed Thai values, not UI text
const isStair = (r: FloorTileRow) => r.location.includes('บันได');

/**
 * "คัดลอกห้องจากฝ้าเพดาน": the rooms of the ceiling step not on this list yet, as new editable rows (names and
 * sizes). `count` is 0 when there is nothing to copy.
 */
function useRoomsFromCeiling(rows: FloorTileRow[], onCopy: (rows: FloorTileRow[]) => void) {
    const t = useTranslations('calculators');
    const { message } = App.useApp();
    const project = useProjectStore(s => s.project);
    const copy = roomsFromCeiling(calculatorInput(project, ceiling).rows, rows);
    const count = copy.rows.length;
    const run = () => {
        onCopy(copy.rows);
        const skipped = copy.skippedBathrooms > 0 ? t('floorTile.excludingVBathrooms', { v: String(copy.skippedBathrooms) }) : '';
        void message.success(t('floorTile.copiedVRoomsSkippedCheck', { v: String(count), skipped }));
    };
    return { count, run, label: t('floorTile.copyRoomsFromTheCeiling', { v: String(count) }) };
}

/** Journey mode: one card per room, read off the floor plan; live area per room, results reduced to the totals. */
function FloorTileJourney({ input, update, outputs }: {
    input: FloorTileInput; update: UseCalculator<FloorTileInput>['update']; outputs: Record<string, number>;
}) {
    const t = useTranslations('calculators');
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
    const states = rows.map(r => stateOf(t, r));

    const card = (r: FloorTileRow, i: number) => {
        const state = states[i] ?? 'empty';
        const missing = state === 'missing' ? new Set(missingOf(t, r)) : new Set<string>();
        const area = floorTileRowArea(r);
        const stair = isStair(r);
        return (
            <PlanCard key={i} index={i + 1} state={state} scope={{ listKey: 'rows', itemIndex: i }}
                title={<NameInput value={r.location} placeholder={t('common.roomNameEGBedroom')} ariaLabel={t('common.roomNameV', { v: String(i + 1) })}
                    onChange={location => setRow(i, { location })} />}
                result={area > 0 ? t('common.vSqM', { v: formatNumber(area) }) : undefined}
                onDuplicate={() => duplicate(i)} onDelete={() => setRows(rs => removeAt(rs, i))} hasData={r.width > 0 || r.length > 0}
                deleteTitle={t('common.deleteThisRoom')} missingText={t('common.missingV', { v: missingOf(t, r).join(', ') })}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    <PlanField className="sm:col-span-2" label={t('floorTile.floorType')} fieldKey="code">
                        <ChoiceButtons ariaLabel={t('floorTile.floorType')} size="small" options={typeChoices(t)} value={r.code === '' ? undefined : r.code}
                            onChange={code => setRow(i, { code })} />
                    </PlanField>
                    <PlanNumber label={stair ? t('floorTile.stairWidth') : t('common.width')} fieldKey="width" unit={t('common.m')} value={r.width} range={[0.3, 30]}
                        missing={missing.has(t('common.width'))} onChange={width => setRow(i, { width })} />
                    <PlanNumber label={stair ? t('floorTile.treadRiser') : t('common.length2')} fieldKey="length" unit={t('common.m')} value={r.length} range={[0.3, 30]}
                        missing={missing.has(t('common.length2'))} hint={stair ? t('floorTile.eG090') : undefined}
                        onChange={length => setRow(i, { length })} />
                </div>
                {isBathroomName(r.location) && (
                    <div className="mt-2 text-[12px] text-amber-700">{t('floorTile.bathroomsAreEnteredInThe')}</div>
                )}
            </PlanCard>
        );
    };

    return (
        <>
            <SheetCard title={t('floorTile.roomsAndFloorTypes')}>
                {rows.length === 0
                    ? (
                        // With rooms on the ceiling step, copying them is the quickest start.
                        <EmptyState text={t('floorTile.noRoomsYetOpenThe')}
                            note={t('floorTile.doNotEnterBathroomsHere')}
                            {...(fromCeiling.count > 0
                                ? { addLabel: fromCeiling.label, onAdd: fromCeiling.run, actions: [{ label: t('common.addRoom'), onClick: add }] }
                                : { addLabel: t('common.addRoom'), onAdd: add })} />
                    )
                    : (
                        <div className="flex flex-col gap-2">
                            {rows.length >= 5 && <FillProgress {...countFill(states)} noun={t('common.room')} />}
                            {rows.map(card)}
                            <AddButton label={t('common.addRoom')} onClick={add} />
                            {fromCeiling.count > 0 && (
                                <Button type="link" size="small" className="self-start !px-0" icon={<CopyOutlined />} onClick={fromCeiling.run}>
                                    {fromCeiling.label}
                                </Button>
                            )}
                            <p className="text-[12px] text-gray-500">
                                {t('floorTile.anLShapedRoomIs')}
                            </p>
                        </div>
                    )}
            </SheetCard>

            <ResultSummary items={[
                ...usedTypes.map(c => ({ label: plainType(t)[c], value: outputs[c], unit: t('common.sqM') })),
                { label: t('floorTile.totalTiledFloorArea'), value: outputs.total, unit: t('common.sqM') },
            ]} />
        </>
    );
}

export default function FloorTilePage() {
    const t = useTranslations('calculators');
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
            <SheetCard title={t('floorTile.floorFinishQuantityTable')}>
                <EditableTable<FloorTileRow>
                    rows={input.rows}
                    onChange={rows => update({ rows })}
                    newRow={() => ({ code: '', width: 0, length: 0, location: '' })}
                    addLabel={t('common.addItem')}
                    columns={[
                        { kind: 'select', key: 'code', title: t('common.symbol'), width: 80,
                            options: FLOOR_TILE_CODES.map(v => ({ value: v })),
                            get: r => r.code, set: (r, v) => ({ ...r, code: isCode(v) ? v : '' }) },
                        // Excel's C column is its own dropdown; here it selects the same code (O-13), in Excel's list order.
                        { kind: 'select', key: 'desc', title: t('common.item'), width: 260,
                            options: FLOOR_TILE_DESCRIPTION_ORDER.map(c => ({ value: c, label: FLOOR_TILE_DESCRIPTIONS[c] })),
                            get: r => r.code, set: (r, v) => ({ ...r, code: isCode(v) ? v : '' }) },
                        { kind: 'number', key: 'width', title: t('common.widthM'), width: 90,
                            get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'length', title: t('common.lengthM2'), width: 90,
                            get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'calc', key: 'area', title: t('common.totalSqM'), width: 100, get: r => floorTileRowArea(r) },
                        { kind: 'text', key: 'location', title: t('common.location'), width: 180,
                            get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>{t('common.totalSqMWidthLength')}</li>
                    <li>{t('floorTile.templateSampleValuesStairs1')}</li>
                    <li>{t('floorTile.symbolsF1F3F4Pool')}</li>
                </ul>
            </SheetCard>

            <SheetCard title={t('floorTile.floorTileAreaSummarySent')}>
                <div className="max-w-xl">
                    {FLOOR_TILE_CODES.map(c => (
                        <CalcField key={c} label={`${c} ${FLOOR_TILE_DESCRIPTIONS[c]}`} value={outputs[c]} unit={t('common.sqM')} />
                    ))}
                    <CalcField label={t('common.grandTotal')} value={outputs.total} unit={t('common.sqM')} strong />
                </div>
            </SheetCard>
        </CalculatorShell>
    );
}
