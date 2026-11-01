'use client';

import {
    wallFinishing, wallFinishingArea, wallFinishingKind, wallFinishingLength, newMouldingRow, newSlatRow, replaceRowsOfKind,
    setMouldingLength, MOULDING_0_1, MOULDING_0_3, SLAT_WALL, WALL_FINISHING_CODES, WALL_FINISHING_ITEMS,
    type WallFinishingInput, type WallFinishingKind, type WallFinishingRow,
} from '@/domain/calculators/wall-finishing';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, ChoiceButtons, EmptyState, FillProgress, NameInput, PlanCard, PlanField, PlanNumber, ResultSummary, countFill,
    fillState, insertAfter, removeAt, type FillState,
} from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

/** Journey: the two moulding sizes in plain words. */
const mouldingOptions = (t: CalcT) => [
    { value: MOULDING_0_3, label: t('wallFinishing.largeMoulding0300') },
    { value: MOULDING_0_1, label: t('wallFinishing.smallMoulding0100') },
];

/** Plan values an item card still needs. */
function missingOf(t: CalcT, r: WallFinishingRow): string[] {
    if (wallFinishingKind(r) === 'moulding') return (wallFinishingLength(r) ?? 0) > 0 ? [] : [t('common.length')];
    const out: string[] = [];
    if (!(r.width > 0)) out.push(t('common.width'));
    if (!(r.length > 0)) out.push(t('wallFinishing.height'));
    return out;
}
const stateOf = (t: CalcT, r: WallFinishingRow): FillState =>
    fillState([missingOf(t, r).length === 0], r.width > 0 || r.length > 0);

/** Journey mode: mouldings (metres) and slat-clad walls (m²) read off the elevations, one card per item. */
function WallFinishingJourney({ input, onChange, outputs }: {
    input: WallFinishingInput; onChange: (edit: (prev: WallFinishingInput) => WallFinishingInput) => void; outputs: Record<string, number>;
}) {
    const t = useTranslations('calculators');
    const rowsOf = (kind: WallFinishingKind) => input.rows.filter(r => wallFinishingKind(r) === kind);
    const setKind = (kind: WallFinishingKind) => (rows: WallFinishingRow[]) => onChange(p => replaceRowsOfKind(p, kind, rows));
    const mouldings = rowsOf('moulding');
    const slats = rowsOf('slat');
    const others = rowsOf('other');
    const addMoulding = () => onChange(p => ({ rows: [...p.rows, newMouldingRow()] }));
    const addSlat = () => onChange(p => ({ rows: [...p.rows, newSlatRow()] }));
    const setRow = (i: number, edit: (r: WallFinishingRow) => WallFinishingRow) =>
        onChange(p => ({ rows: p.rows.map((r, j) => (j === i ? edit(r) : r)) }));
    const duplicate = (i: number) => onChange(p => {
        const r = p.rows[i];
        return r ? { rows: insertAfter(p.rows, i, { ...r }) } : p;
    });
    const remove = (i: number) => onChange(p => ({ rows: removeAt(p.rows, i) }));
    // Cards address rows by their place in the whole list (mouldings and slat walls are shown apart).
    const indexed = input.rows.map((r, i) => ({ r, i }));
    const states = [...mouldings, ...slats].map(r => stateOf(t, r));

    const mouldingCard = ({ r, i }: { r: WallFinishingRow; i: number }, n: number) => {
        const state = stateOf(t, r);
        const length = wallFinishingLength(r) ?? 0;
        return (
            <PlanCard key={i} index={n} state={state} scope={{ listKey: 'rows', itemIndex: i }}
                title={<NameInput value={r.location} placeholder={t('wallFinishing.locationEGExteriorWall')} ariaLabel={t('wallFinishing.mouldingLocation', { v: String(n) })}
                    onChange={location => setRow(i, x => ({ ...x, location }))} />}
                result={length > 0 ? t('common.m2', { v: formatNumber(length) }) : undefined}
                onDuplicate={() => duplicate(i)} onDelete={() => remove(i)} hasData={length > 0}
                deleteTitle={t('wallFinishing.deleteThisMoulding')} missingText={t('wallFinishing.missingLength')}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    <PlanField label={t('wallFinishing.mouldingSize')}>
                        <ChoiceButtons ariaLabel={t('wallFinishing.mouldingSize')} size="small" options={mouldingOptions(t)} value={r.item.trim()}
                            onChange={item => setRow(i, x => ({ ...x, item }))} />
                    </PlanField>
                    <PlanNumber label={t('wallFinishing.totalLength')} fieldKey="length" unit={t('common.m')} value={length} range={[0.5, 300]}
                        missing={state === 'missing'} hint={t('wallFinishing.totalOfAllSpansE')}
                        onChange={v => setRow(i, x => setMouldingLength(x, v))} />
                </div>
            </PlanCard>
        );
    };

    const slatCard = ({ r, i }: { r: WallFinishingRow; i: number }, n: number) => {
        const state = stateOf(t, r);
        const missing = state === 'missing' ? new Set(missingOf(t, r)) : new Set<string>();
        const area = wallFinishingArea(r) ?? 0;
        return (
            <PlanCard key={i} index={n} state={state} scope={{ listKey: 'rows', itemIndex: i }}
                title={<NameInput value={r.location} placeholder={t('wallFinishing.locationEGBalconyWall')} ariaLabel={t('wallFinishing.slattedWallLocation', { v: String(n) })}
                    onChange={location => setRow(i, x => ({ ...x, location }))} />}
                result={area > 0 ? t('common.vSqM', { v: formatNumber(area) }) : undefined}
                onDuplicate={() => duplicate(i)} onDelete={() => remove(i)} hasData={r.width > 0 || r.length > 0}
                deleteTitle={t('wallFinishing.deleteThisSlattedWall')} missingText={t('common.missing', { v: missingOf(t, r).join(', ') })}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    <PlanNumber label={t('common.width')} fieldKey="width" unit={t('common.m')} value={r.width} range={[0.3, 20]} missing={missing.has(t('common.width'))}
                        onChange={width => setRow(i, x => ({ ...x, width }))} />
                    <PlanNumber label={t('wallFinishing.height')} fieldKey="length" unit={t('common.m')} value={r.length} range={[0.3, 6]} missing={missing.has(t('wallFinishing.height'))}
                        onChange={length => setRow(i, x => ({ ...x, length }))} />
                </div>
            </PlanCard>
        );
    };

    if (input.rows.length === 0) {
        return (
            <SheetCard>
                <EmptyState text={t('wallFinishing.noWallFinishingYetCheck')}
                    note={<>{t('wallFinishing.ifTheDrawingsHaveNone')}</>}
                    addLabel={t('wallFinishing.addWallMoulding')} onAdd={addMoulding}
                    actions={[{ label: t('wallFinishing.addSlattedWall'), onClick: addSlat }]} />
            </SheetCard>
        );
    }

    return (
        <>
            {states.length >= 5 && <FillProgress {...countFill(states)} noun={t('common.item')} />}

            <SheetCard title={t('wallFinishing.wallMouldingCountedByLength')}>
                <div className="flex flex-col gap-2">
                    {indexed.filter(x => wallFinishingKind(x.r) === 'moulding').map((x, k) => mouldingCard(x, k + 1))}
                    <AddButton label={t('wallFinishing.addWallMoulding')} onClick={addMoulding} />
                </div>
            </SheetCard>

            <SheetCard title={t('wallFinishing.fibreCementSlatCladdingCounted')}>
                <div className="flex flex-col gap-2">
                    {indexed.filter(x => wallFinishingKind(x.r) === 'slat').map((x, k) => slatCard(x, k + 1))}
                    <AddButton label={t('wallFinishing.addSlattedWall')} onClick={addSlat} />
                </div>
            </SheetCard>

            {others.length > 0 && (
                <SheetCard title={t('wallFinishing.itemsWithNoTypeChosen')}>
                    <EditableTable<WallFinishingRow>
                        rows={others}
                        onChange={setKind('other')}
                        columns={[
                            { kind: 'select', key: 'item', title: t('wallFinishing.type'), width: 240,
                                options: [...mouldingOptions(t), { value: SLAT_WALL, label: t('wallFinishing.slattedWall') }],
                                get: r => r.item.trim(), set: (r, v) => ({ ...r, item: v }) },
                            { kind: 'text', key: 'location', title: t('common.location'), width: 160,
                                get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                            { kind: 'number', key: 'width', title: t('common.widthM'), width: 90,
                                get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                            { kind: 'number', key: 'length', title: t('common.lengthM2'), width: 90,
                                get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        ]}
                    />
                </SheetCard>
            )}

            <ResultSummary
                items={[
                    { label: t('wallFinishing.largeMoulding030'), value: outputs.R218, unit: t('common.m') },
                    { label: t('wallFinishing.smallMoulding010'), value: outputs.R219, unit: t('common.m') },
                    { label: t('wallFinishing.slattedWall'), value: outputs.R220, unit: t('common.sqM') },
                ]}
                note={t('wallFinishing.theMouldingLengthAndSlat')} />
        </>
    );
}

export default function WallFinishingPage() {
    const t = useTranslations('calculators');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(wallFinishing);
    const inJourney = useJourneyMode();

    if (inJourney) {
        return (
            <CalculatorShell def={wallFinishing} result={result} isDefault={isDefault} onReset={reset}>
                <WallFinishingJourney input={input} outputs={outputs} onChange={next => update(next)} />
            </CalculatorShell>
        );
    }

    return (
        <CalculatorShell def={wallFinishing} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title={t('wallFinishing.wallFinishingMaterialQuantityCalculation')}>
                <EditableTable<WallFinishingRow>
                    rows={input.rows}
                    onChange={rows => update({ rows })}
                    newRow={() => ({ code: '', item: '', width: 0, length: 0, location: '' })}
                    addLabel={t('common.addItem')}
                    columns={[
                        { kind: 'select', key: 'code', title: t('common.symbol'), width: 80,
                            options: WALL_FINISHING_CODES.map(v => ({ value: v })),
                            get: r => r.code, set: (r, v) => ({ ...r, code: v }) },
                        { kind: 'select', key: 'item', title: t('common.item'), width: 300,
                            options: WALL_FINISHING_ITEMS.map(v => ({ value: v })),
                            get: r => r.item.trim(), set: (r, v) => ({ ...r, item: v }) },
                        { kind: 'number', key: 'width', title: t('common.widthM'), width: 80,
                            get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'length', title: t('common.lengthM2'), width: 80,
                            get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'calc', key: 'total-length', title: t('common.lengthM2'), width: 80, get: r => wallFinishingLength(r) },
                        { kind: 'calc', key: 'area', title: t('wallFinishing.areaSqM'), width: 90, get: r => wallFinishingArea(r) },
                        { kind: 'text', key: 'location', title: t('common.location'), width: 130,
                            get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>{t('wallFinishing.wallMouldingLengthMWidth')}</li>
                    <li>{t('wallFinishing.fibreCementSlatBoardCladding')}</li>

                </ul>
            </SheetCard>

            <SheetCard title={t('wallFinishing.quantitySummarySentToBOQ')}>
                <CalcField label={MOULDING_0_3} value={outputs.R218} unit={t('common.m')} strong />
                <CalcField label={MOULDING_0_1} value={outputs.R219} unit={t('common.m')} strong />
                <CalcField label={SLAT_WALL} value={outputs.R220} unit={t('common.sqM')} strong />
                <p className="mt-2 text-[12px] text-gray-500">
                    {t('wallFinishing.eachBOQRowMouldingSize')}
                </p>
            </SheetCard>
        </CalculatorShell>
    );
}
