'use client';

import {
    ALUMINIUM, ALUMINIUM_RATES, doorWindow, itemCode, LIGHT_WALL, openingRowCalc, WOOD, WOOD_DEFAULT_PRICE,
    type DoorWindowInput, type OpeningRow,
} from '@/domain/calculators/door-window';
import { EditableTable, type SheetColumn } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { NumberCell, formatNumber } from '@/components/sheet/NumberCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import {
    AddButton, ChoiceButtons, EmptyState, FillProgress, JText, PlanCard, PlanField, PlanNumber, ResultSummary, countFill,
    fillState, type FillState,
} from '@/components/sheet/journey';
import { BRICK_CHOICES, THICKNESS_CHOICES, wallPartChoices } from '../brick/wallParts';
import { duplicateOpeningRow, newOpeningRow, priceCommit } from './rows';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

type Block = 'doors' | 'windows';

const typeChoices = (t: CalcT) => [{ value: ALUMINIUM as string, label: t('doorWindow.aluminium') }, { value: WOOD as string, label: t('doorWindow.wood') }];
const wallChoices = (t: CalcT) => [...BRICK_CHOICES, { value: LIGHT_WALL, label: t('doorWindow.lightWall'), hint: t('doorWindow.aLightWallDoesNot') }];

interface BlockInfo {
    title: string; prefix: string; add: string; empty: string; placeholder: string;
    /** Standard leaf sizes (doors only; windows have no standard size). */
    widths?: readonly number[]; heights?: readonly number[];
    /** Usual size range (m): outside it a quiet note asks to check the unit (e.g. a door 90 m wide). */
    widthRange: readonly [number, number]; heightRange: readonly [number, number];
}

const blocks = (t: CalcT): Record<Block, BlockInfo> => ({
    doors: {
        title: t('doorWindow.door'), prefix: 'D', add: t('doorWindow.addDoor'), placeholder: t('doorWindow.eGD1SingleSwing'),
        empty: t('doorWindow.noDoorsYetCheckThe'),
        widths: [0.8, 0.9, 1.0], heights: [2.0, 2.1],
        widthRange: [0.5, 6], heightRange: [1.5, 4],
    },
    windows: {
        title: t('doorWindow.window'), prefix: 'W', add: t('doorWindow.addWindow'), placeholder: t('doorWindow.eGW1Sliding'),
        empty: t('doorWindow.noWindowsYetCheckThe'),
        widthRange: [0.2, 8], heightRange: [0.2, 4],
    },
});

const isLight = (r: OpeningRow) => r.brick.trim() === LIGHT_WALL;

/** What a card still needs (plan values), in reading order. */
function missingOf(t: CalcT, r: OpeningRow): string[] {
    const out: string[] = [];
    if (r.type.trim() === '') out.push(t('doorWindow.leafMaterial'));
    if (!(r.count > 0)) out.push(t('common.number'));
    if (!(r.width > 0)) out.push(t('common.width2'));
    if (!(r.height > 0)) out.push(t('common.height'));
    if (r.wallPart.trim() === '') out.push(t('doorWindow.installedInWall'));
    if (r.brick.trim() === '' || (!isLight(r) && r.thickness.trim() === '')) out.push(t('doorWindow.wallType'));
    return out;
}

const stateOf = (t: CalcT, r: OpeningRow): FillState => {
    const missing = missingOf(t, r);
    return fillState(missing.length === 0 ? [true] : [false], r.width > 0 || r.height > 0);
};
/** The description after the code ("D1-บานเปิด" → "บานเปิด"). */
const description = (name: string) => name.replace(/^\s*[A-Za-z]+\d+\s*-?\s*/, '').trim();
const hasData = (r: OpeningRow) => r.width > 0 || r.height > 0 || description(r.name) !== '';
const titleOf = (r: OpeningRow, fallback: string) => {
    if (description(r.name) !== '') return r.name.trim();
    const code = itemCode(r.name);
    return code === '' ? fallback : `${code} · ${fallback}`;
};

export default function DoorWindowJourney() {
    const t = useTranslations('calculators');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(doorWindow);

    const setBlock = (block: Block, fn: (rows: OpeningRow[]) => OpeningRow[]) =>
        update((prev: DoorWindowInput) => ({ ...prev, [block]: fn(prev[block]) }));
    const setRow = (block: Block, i: number, patch: Partial<OpeningRow>) =>
        setBlock(block, rows => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const addRow = (block: Block) => setBlock(block, rows => [...rows, newOpeningRow(rows, blocks(t)[block].prefix)]);

    const priceColumns = (block: Block): SheetColumn<OpeningRow>[] => [
        { kind: 'label', key: 'name', title: t('common.item'), width: 240, get: r => <span className="px-1">{r.name}</span> },
        { kind: 'label', key: 'type', title: t('doorWindow.leafType'), width: 90,
            get: r => <span className="px-1">{r.type.trim() === WOOD ? t('doorWindow.wood') : r.type.trim() === ALUMINIUM ? t('doorWindow.aluminium') : '-'}</span> },
        { kind: 'label', key: 'rate', title: t('doorWindow.aluminiumBahtSqM'), width: 100,
            get: (r, i) => (r.type.trim() === ALUMINIUM
                ? <NumberCell value={r.rate} digits={0} ariaLabel={t('doorWindow.aluminiumRateBahtSqM')}
                    onCommit={v => setRow(block, i, { rate: v ?? ALUMINIUM_RATES.sliding })} />
                : <span className="block text-center text-gray-400">-</span>) },
        { kind: 'label', key: 'mat', title: t('doorWindow.materialPerSetBaht'), width: 110,
            get: (r, i) => (
                <NumberCell value={openingRowCalc(r).matUnit} tone={r.matPrice === null ? 'calc' : 'input'}
                    edited={r.matPrice !== null} ariaLabel={t('doorWindow.materialPerSet')}
                    onCommit={v => {
                        const p = priceCommit(r.matPrice, openingRowCalc(r).matUnit, v);
                        if (p !== 'unchanged') setRow(block, i, { matPrice: p });
                    }} />
            ) },
        { kind: 'label', key: 'lab', title: t('doorWindow.labourPerSetBaht'), width: 100,
            get: (r, i) => (
                <NumberCell value={openingRowCalc(r).labUnit} tone={r.labPrice === null ? 'calc' : 'input'}
                    edited={r.labPrice !== null} ariaLabel={t('doorWindow.labourPerSet')}
                    onCommit={v => {
                        const p = priceCommit(r.labPrice, openingRowCalc(r).labUnit, v);
                        if (p !== 'unchanged') setRow(block, i, { labPrice: p });
                    }} />
            ) },
    ];

    const count = (rows: OpeningRow[]) => rows.reduce((s, r) => s + (Number.isFinite(r.count) ? r.count : 0), 0);
    const all = [...input.doors, ...input.windows];
    const progress = countFill(all.map(r => stateOf(t, r)));

    const card = (block: Block, r: OpeningRow, i: number) => {
        const b = blocks(t)[block];
        const state = stateOf(t, r);
        const missing = state === 'missing' ? new Set(missingOf(t, r)) : new Set<string>();
        const c = openingRowCalc(r);
        return (
            <PlanCard key={i} index={i + 1} state={state} scope={{ listKey: block, itemIndex: i }}
                title={titleOf(r, t('doorWindow.titleV', { title: b.title, v: String(i + 1) }))}
                result={c.total > 0 ? <>{formatNumber(c.total)} {t('common.sqM')}</> : undefined}
                onDuplicate={() => setBlock(block, rows => duplicateOpeningRow(rows, i, b.prefix))}
                onDelete={() => setBlock(block, rows => rows.filter((_, j) => j !== i))}
                hasData={hasData(r)} deleteTitle={t('doorWindow.deleteThisTitle', { title: b.title })}
                missingText={t('common.missingV', { v: missingOf(t, r).join(', ') })}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    <div className="sm:col-span-2">
                        <JText wide label={t('doorWindow.codeItemAsInThe')} value={r.name} placeholder={b.placeholder}
                            onChange={name => setRow(block, i, { name })} />
                    </div>
                    <PlanField label={t('doorWindow.leafMaterial')}>
                        <ChoiceButtons ariaLabel={t('doorWindow.leafMaterial')} value={r.type.trim() === '' ? undefined : r.type.trim()} options={typeChoices(t)}
                            onChange={type => setRow(block, i, { type })} />
                    </PlanField>
                    <PlanNumber label={t('common.number')} fieldKey="count" unit={t('doorWindow.leaf')} digits={0} value={r.count} missing={missing.has(t('common.number'))}
                        onChange={count => setRow(block, i, { count })} />
                    <PlanNumber label={t('common.width')} fieldKey="width" unit={t('common.m')} value={r.width} presets={b.widths} presetFormat={v => v.toFixed(1)}
                        range={b.widthRange} missing={missing.has(t('common.width2'))}
                        onChange={width => setRow(block, i, { width })} />
                    <PlanNumber label={t('doorWindow.height')} fieldKey="height" unit={t('common.m')} value={r.height} presets={b.heights} presetFormat={v => v.toFixed(1)}
                        range={b.heightRange} missing={missing.has(t('common.height'))}
                        onChange={height => setRow(block, i, { height })} />
                    <PlanField className="sm:col-span-2" label={t('doorWindow.installedInWall2')}>
                        <ChoiceButtons ariaLabel={t('doorWindow.installedInWall2')} size="small" options={wallPartChoices(t)}
                            value={r.wallPart.trim() === '' ? undefined : r.wallPart.trim()}
                            onChange={wallPart => setRow(block, i, { wallPart })} />
                    </PlanField>
                    <PlanField className="sm:col-span-2" label={t('doorWindow.wallType')}>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                            <ChoiceButtons ariaLabel={t('doorWindow.wallType')} size="small" options={wallChoices(t)}
                                value={r.brick.trim() === '' ? undefined : r.brick.trim()}
                                onChange={brick => setRow(block, i, { brick })} />
                            {!isLight(r) && (
                                <ChoiceButtons ariaLabel={t('doorWindow.wallThickness')} size="small" options={THICKNESS_CHOICES}
                                    value={r.thickness.trim() === '' ? undefined : r.thickness.trim()}
                                    onChange={thickness => setRow(block, i, { thickness })} />
                            )}
                        </div>
                    </PlanField>
                </div>
            </PlanCard>
        );
    };

    return (
        <CalculatorShell def={doorWindow} result={result} isDefault={isDefault} onReset={reset}>
            {all.length >= 5 && <FillProgress {...progress} noun={t('doorWindow.opening')} />}

            {(['doors', 'windows'] as const).map(block => {
                const b = blocks(t)[block];
                const rows = input[block];
                return (
                    <SheetCard key={block} title={b.title}>
                        {rows.length === 0
                            ? <EmptyState text={b.empty} addLabel={b.add} onAdd={() => addRow(block)} />
                            : (
                                <div className="flex flex-col gap-2">
                                    {rows.map((r, i) => card(block, r, i))}
                                    <AddButton label={b.add} onClick={() => addRow(block)} />
                                </div>
                            )}
                    </SheetCard>
                );
            })}
            <ul className="list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                <li>{t('doorWindow.installedInWallAndWall')}</li>
                <li>{t('doorWindow.defaultPricesAluminiumIsPriced')}{formatNumber(ALUMINIUM_RATES.sliding, 0)}–{formatNumber(ALUMINIUM_RATES.awning, 0)} {t('doorWindow.bahtSqMWood')}{formatNumber(WOOD_DEFAULT_PRICE.mat, 0)} {t('doorWindow.labour')}{formatNumber(WOOD_DEFAULT_PRICE.lab, 0)} {t('doorWindow.bahtSetYouCanChange')}</li>
            </ul>

            {all.length > 0 && (
                <AdvancedSection title={t('doorWindow.doorAndWindowPrices')}>
                    {(['doors', 'windows'] as const).filter(block => input[block].length > 0).map(block => (
                        <div key={block} className="mb-3">
                            <div className="font-semibold text-[13px] text-gray-700 mb-1">{blocks(t)[block].title}</div>
                            <EditableTable<OpeningRow> rows={input[block]} onChange={next => setBlock(block, () => next)}
                                canDelete={false} columns={priceColumns(block)} />
                        </div>
                    ))}
                    <div className="text-[12px] text-gray-500">{t('doorWindow.greenCellsDefaultPriceType')}{formatNumber(ALUMINIUM_RATES.sliding, 0)}{t('doorWindow.casement')}{formatNumber(ALUMINIUM_RATES.awning, 0)} {t('doorWindow.bahtSqM')}</div>
                </AdvancedSection>
            )}

            <ResultSummary
                items={[
                    { label: t('doorWindow.door'), value: count(input.doors), unit: t('doorWindow.leaf'), digits: 0 },
                    { label: t('doorWindow.window'), value: count(input.windows), unit: t('doorWindow.leaf'), digits: 0 },
                    { label: t('doorWindow.totalOpeningArea'), value: outputs['opening.total'], unit: t('common.sqM') },
                ]}
                note={t('doorWindow.theOpeningAreaIsDeducted')} />
        </CalculatorShell>
    );
}
