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
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const sideChoices = (t: CalcT) => [
    { value: 0, label: t('plaster.noPlaster') },
    { value: 1, label: t('plaster.n1Side') },
    { value: 2, label: t('plaster.n2Sides') },
];

const kindLabel = (t: CalcT, kind: string) => {
    const k = kind.trim();
    // eslint-disable-next-line no-restricted-syntax -- stored kind values, not UI text
    return k === 'ฉาบภายนอก' ? t('plaster.plasterOutside') : k === 'ฉาบภายใน' ? t('plaster.plasterInside') : t('plaster.plasterSideNotSelected');
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
    const t = useTranslations('calculators');
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
                            {structural ? t('plaster.structuralWallsColumnBeamSurfaces') : g.part === '' ? t('plaster.wallPartNotSelected') : g.part}
                        </div>
                        {structural && <Hint>{t('plaster.concreteColumnAndBeamSurfaces')}</Hint>}
                    </div>
                    {!structural && g.part !== '' && (area !== 0
                        ? <span className="text-[12px] text-gray-600 tabular-nums">{t('plaster.wall')}{formatNumber(area)} {t('plaster.sqMPerSide')}</span>
                        : !noWalls && <span className="text-[12px] text-gray-400">{t('plaster.thisWallIsNotIn')}</span>)}
                </div>
                <div className="mt-2 flex flex-col gap-2">
                    {g.rows.map(({ row, index }) => {
                        const rowArea = plasterRowArea(row, ctx);
                        return (
                            <div key={index} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                <span className="w-[96px] shrink-0 text-[13px] text-gray-700">{kindLabel(t, row.kind)}</span>
                                {isStructural(row) && (
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-[150px]">
                                            <SumInput value={row.manualArea ?? 0} placeholder={t('plaster.eG25624')}
                                                ariaLabel={t('plaster.columnBeamSurfaceAreaPer')}
                                                onChange={manualArea => setRow(index, { manualArea })} />
                                        </span>
                                        <span className="text-[12px] text-gray-500">{t('plaster.sqMPerSide')}</span>
                                    </span>
                                )}
                                <ChoiceButtons ariaLabel={t('plaster.partVHowManySides', { part: g.part, v: kindLabel(t, row.kind) })} size="small"
                                    options={sideChoices(t)} value={row.sides} onChange={sides => setRow(index, { sides })} />
                                <span className="ml-auto text-[13px] tabular-nums px-2 py-0.5 rounded"
                                    style={{ background: rowArea > 0 ? SHEET_COLORS.calc : undefined }}>
                                    {rowArea > 0 ? t('plaster.vSqM', { v: formatNumber(rowArea) }) : <span className="text-gray-400">—</span>}
                                </span>
                            </div>
                        );
                    })}
                    {structural && g.rows.map(({ row, index }) => {
                        const note = outOfRange(row.manualArea ?? 0, 1, 500, t('common.sqM'));
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
                            {t('plaster.noBrickWallsYetThe')}
                        </>
                    )
                    // Each wall card below shows its own area: here only where the areas come from.
                    : <>{t('plaster.usesTheMasonryWallArea')}{formatNumber(walls.length, 0)} {t('plaster.wallPartsAfterDeductingDoors')}</>}
            </FromLevel>

            <SheetCard title={t('plaster.wallsToPlaster')}>
                <p className="mb-3 text-[12px] text-gray-500">{t('plaster.thePlasteredSidesArePreset')}</p>
                <div className="flex flex-col gap-2">{groups.map(group)}</div>
            </SheetCard>

            <AdvancedSection title={t('plaster.plasterItemSettings')}>
                <PlasterTable rows={input.rows} onChange={rows => update({ rows })} setRow={setRow} ctx={ctx}
                    brickNet={brickNet} structuralDefault={0} />
            </AdvancedSection>

            <ResultSummary
                items={[
                    { label: t('plaster.exteriorWallPlaster'), value: outputs.exterior, unit: t('common.sqM') },
                    { label: t('plaster.interiorWallPlaster'), value: outputs.interior, unit: t('common.sqM') },
                    { label: t('plaster.totalPlasterArea'), value: outputs.total, unit: t('common.sqM') },
                ]}
                note={t('plaster.theExteriorInteriorPlasterAreas')} />
        </CalculatorShell>
    );
}
