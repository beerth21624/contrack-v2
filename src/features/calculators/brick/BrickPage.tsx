'use client';

import { Alert } from 'antd';
import {
    brick, brickOpenings, brickWallResults, unmatchedOpenings, BRICK_BOQ_ROWS, BRICK_THICKNESSES, BRICK_TYPES,
    BRICK_WALL_PARTS, WALL_SHAPES, type BrickWall,
} from '@/domain/calculators/brick';
import type { CalcContext } from '@/domain/calculators/types';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import BrickJourney from './BrickJourney';
import { useTranslations } from 'next-intl';
import { dt } from '../domainText';

const opts = (list: readonly string[]) => list.map(v => ({ value: v }));

export default function BrickPage() {
    return useJourneyMode() ? <BrickJourney /> : <BrickSheet />;
}

/** The Excel-mirror sheet (/calc/brick). */
function BrickSheet() {
    const t = useTranslations('calculators');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(brick);
    const ctx: CalcContext = { outputs: id => result.calcOutputs[id] };
    const openings = brickOpenings(ctx);
    const rows = brickWallResults(input, openings);
    const unmatched = Object.entries(unmatchedOpenings(input, openings));
    const noDoorWindow = result.calcOutputs['door-window'] === undefined;

    const newRow = (): BrickWall => {
        const last = input.walls[input.walls.length - 1];
        return {
            wallPart: last?.wallPart ?? '', brickType: last?.brickType ?? '', thickness: last?.thickness ?? '',
            length: 0, height: 0, shape: 'rect',
        };
    };

    return (
        <CalculatorShell def={brick} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title={t('brick.brickMasonryQuantityTable')}>
                <EditableTable<BrickWall>
                    rows={input.walls}
                    onChange={walls => update({ walls })}
                    newRow={newRow}
                    addLabel={t('brick.addWall2')}
                    columns={[
                        { kind: 'select', key: 'wallPart', title: t('common.wallPart'), width: 150, options: opts(BRICK_WALL_PARTS),
                            get: r => r.wallPart, set: (r, v) => ({ ...r, wallPart: v }) },
                        { kind: 'select', key: 'brickType', title: t('common.item'), width: 110, options: opts(BRICK_TYPES),
                            get: r => r.brickType, set: (r, v) => ({ ...r, brickType: v }) },
                        { kind: 'select', key: 'thickness', title: t('common.thickness'), width: 100, options: opts(BRICK_THICKNESSES),
                            get: r => r.thickness, set: (r, v) => ({ ...r, thickness: v }) },
                        { kind: 'select', key: 'shape', title: t('brick.wallShape'), width: 105,
                            options: WALL_SHAPES.map(s => ({ value: s.value, label: dt(s.label) })),
                            get: r => r.shape ?? 'rect', set: (r, v) => ({ ...r, shape: v === 'triangle' ? 'triangle' : 'rect' }) },
                        { kind: 'number', key: 'length', title: t('common.lengthM'), width: 85,
                            get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'number', key: 'height', title: t('brick.heightM'), width: 85,
                            get: r => r.height, set: (r, v) => ({ ...r, height: v }) },
                        { kind: 'calc', key: 'area', title: t('brick.wallAreaSqM'), width: 90, get: (_, i) => rows[i]?.area ?? null },
                        { kind: 'calc', key: 'openings', title: t('brick.openingAreaSqM'), width: 90, get: (_, i) => rows[i]?.openings ?? null },
                        { kind: 'calc', key: 'net', title: t('common.totalSqM'), width: 90, get: (_, i) => rows[i]?.net ?? null },
                    ]}
                />
                {unmatched.length > 0 && (
                    <Alert className="mt-3" type="warning" showIcon
                        title={t('brick.openingsWithoutAMatchingWall')}
                        description={(
                            <ul className="list-disc pl-5 text-[12px]">
                                {unmatched.map(([k, v]) => (
                                    <li key={k}>{k.split('|').slice(1).filter(Boolean).join(' / ')}: {formatNumber(v)} {t('common.sqM')}</li>
                                ))}
                            </ul>
                        )} />
                )}
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>{t('brick.wallAreaLengthHeightRectangle')}</li>
                    <li>
                        {t('brick.openingAreaTheDoorAnd')}
                    </li>
                    {noDoorWindow && <li>{t('brick.thereIsNoDoorAnd')}</li>}
                    <li>{t('brick.totalWallAreaOpeningArea')}</li>
                </ul>
            </SheetCard>

            <SheetCard title={t('brick.brickMasonryAreaSummarySent')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    {BRICK_BOQ_ROWS.map(b => (
                        <CalcField key={b.line} label={t('brick.masonryBricktypeThickness', { brickType: b.brickType, thickness: b.thickness })} value={outputs[b.line]} unit={t('common.sqM')} />
                    ))}
                    <CalcField label={t('brick.tieColumnsAndLintelsIncluded')} unit={t('common.sqM')} strong
                        value={BRICK_BOQ_ROWS.reduce((s, b) => s + (outputs[b.line] ?? 0), 0)} />
                </div>
            </SheetCard>
        </CalculatorShell>
    );
}
