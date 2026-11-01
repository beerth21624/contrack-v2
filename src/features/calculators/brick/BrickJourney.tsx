'use client';

import { Alert, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
    brick, brickOpenings, brickWallResults, unmatchedOpenings, BRICK_BOQ_ROWS, WALL_SHAPES, type BrickInput, type BrickWall,
} from '@/domain/calculators/brick';
import { LIGHT_WALL } from '@/domain/calculators/door-window';
import type { CalcContext } from '@/domain/calculators/types';
import { SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, ChoiceButtons, EmptyState, FillProgress, FromLevel, MissingRing, PlanCard, PlanField, PlanNumber, ResultSummary,
    SumInput, countFill, fillState, outOfRange, type FillState,
} from '@/components/sheet/journey';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { BRICK_CHOICES, THICKNESS_CHOICES, wallPartChoices, wallPartHints } from './wallParts';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const shapeChoices = (t: CalcT) => WALL_SHAPES.map(s => ({ value: s.value, label: s.value === 'triangle' ? t('brick.triangleGable') : s.label }));

const keyParts = (k: string) => {
    const [, wallPart = '', brickType = '', thickness = ''] = k.split('|');
    return { wallPart, brickType, thickness };
};

/** Plan values a wall card still needs, in reading order. */
function missingOf(t: CalcT, w: BrickWall): string[] {
    const out: string[] = [];
    if (w.wallPart.trim() === '') out.push(t('common.wallPart'));
    if (w.brickType.trim() === '' || w.thickness.trim() === '') out.push(t('brick.brickType'));
    if (!(w.length > 0)) out.push(t('common.length'));
    if (!(w.height > 0)) out.push(t('common.height'));
    return out;
}

// A new wall copies the previous height, so a card counts as started once its length is typed.
const stateOf = (t: CalcT, w: BrickWall): FillState => fillState([missingOf(t, w).length === 0], w.length > 0);

export default function BrickJourney() {
    const t = useTranslations('calculators');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(brick);
    const ctx: CalcContext = { outputs: id => result.calcOutputs[id] };
    const openings = brickOpenings(ctx);
    const rows = brickWallResults(input, openings);
    // Openings in a light (non-brick) wall are never deducted on purpose: not a warning.
    const unmatchedOf = (walls: BrickInput) =>
        Object.entries(unmatchedOpenings(walls, openings)).filter(([k]) => keyParts(k).brickType !== LIGHT_WALL);
    const unmatched = unmatchedOf(input);
    const openingTotal = Object.entries(openings).reduce((s, [k, v]) => s + (keyParts(k).brickType === LIGHT_WALL ? 0 : v), 0);

    const newWall = (walls: BrickWall[], p?: Partial<BrickWall>): BrickWall => {
        const last = walls[walls.length - 1];
        return {
            // eslint-disable-next-line no-restricted-syntax -- stored domain values, not UI text
            wallPart: last?.wallPart ?? 'ผนังรอบบ้าน', brickType: last?.brickType ?? 'อิฐมอญ', thickness: last?.thickness ?? 'ครึ่งแผ่น',
            length: 0, height: last?.height ?? 0, shape: 'rect', ...p,
        };
    };
    const addWall = (p?: Partial<BrickWall>) => update(prev => ({ ...prev, walls: [...prev.walls, newWall(prev.walls, p)] }));
    /** One wall per door/window group that has no wall yet (same part, brick and thickness). */
    const addWallsForOpenings = () => update(prev => {
        let walls = prev.walls;
        for (const [k] of unmatchedOf(prev)) {
            const p = keyParts(k);
            if (p.wallPart === '' || p.brickType === '') continue;
            walls = [...walls, newWall(walls, { wallPart: p.wallPart, brickType: p.brickType, thickness: p.thickness })];
        }
        return { ...prev, walls };
    });
    const setWall = (i: number, patch: Partial<BrickWall>) =>
        update(prev => ({ ...prev, walls: prev.walls.map((w, j) => (j === i ? { ...w, ...patch } : w)) }));
    const duplicate = (i: number) => update(prev => {
        const w = prev.walls[i];
        return w === undefined ? prev : { ...prev, walls: [...prev.walls.slice(0, i + 1), { ...w }, ...prev.walls.slice(i + 1)] };
    });
    const remove = (i: number) => update(prev => ({ ...prev, walls: prev.walls.filter((_, j) => j !== i) }));

    const byType = BRICK_BOQ_ROWS.map(b => ({ label: `${b.brickType} ${b.thickness}`, value: outputs[b.line] ?? 0, unit: t('common.sqM') }));
    const total = byType.reduce((s, b) => s + b.value, 0);
    const states = input.walls.map(w => stateOf(t, w));
    const addableGroups = unmatched.filter(([k]) => keyParts(k).wallPart !== '' && keyParts(k).brickType !== '').length;

    const card = (w: BrickWall, i: number) => {
        const r = rows[i];
        const state = states[i] ?? 'empty';
        const missing = state === 'missing' ? new Set(missingOf(t, w)) : new Set<string>();
        const triangle = w.shape === 'triangle';
        const net = r?.net ?? 0;
        return (
            <PlanCard key={i} index={i + 1} state={state} scope={{ listKey: 'walls', itemIndex: i }}
                title={w.wallPart.trim() === '' ? t('brick.wallV', { v: String(i + 1) }) : `${w.wallPart} · ${w.brickType} ${w.thickness}`}
                result={(r?.area ?? 0) > 0
                    ? <span className={net < 0 ? 'text-red-600' : ''}>{t('brick.masonry')}{formatNumber(net)} {t('common.sqM')}</span>
                    : undefined}
                onDuplicate={() => duplicate(i)} onDelete={() => remove(i)} hasData={w.length > 0}
                deleteTitle={t('brick.deleteThisWall')} missingText={t('common.missingV', { v: missingOf(t, w).join(', ') })}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    <PlanField className="sm:col-span-2" label={t('common.wallPart')}
                        hint={wallPartHints(t)[w.wallPart.trim()]}>
                        <ChoiceButtons ariaLabel={t('common.wallPart')} size="small" options={wallPartChoices(t)}
                            value={w.wallPart.trim() === '' ? undefined : w.wallPart.trim()}
                            onChange={wallPart => setWall(i, { wallPart })} />
                    </PlanField>
                    <PlanField className="sm:col-span-2" label={t('brick.brickType')}>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                            <ChoiceButtons ariaLabel={t('brick.brickType')} size="small" options={BRICK_CHOICES}
                                value={w.brickType.trim() === '' ? undefined : w.brickType.trim()}
                                onChange={brickType => setWall(i, { brickType })} />
                            <ChoiceButtons ariaLabel={t('common.thickness')} size="small" options={THICKNESS_CHOICES}
                                value={w.thickness.trim() === '' ? undefined : w.thickness.trim()}
                                onChange={thickness => setWall(i, { thickness })} />
                        </div>
                    </PlanField>
                    <PlanField label={t('brick.wallShape')}
                        hint={triangle ? t('brick.lengthGableBaseHeightGable') : undefined}>
                        <ChoiceButtons ariaLabel={t('brick.wallShape')} size="small" options={shapeChoices(t)} value={w.shape ?? 'rect'}
                            onChange={shape => setWall(i, { shape })} />
                    </PlanField>
                    <div className="hidden sm:block" />
                    <PlanField label={triangle ? t('brick.gableBaseWidthM') : t('brick.totalLengthM')} fieldKey="length" ringControl={false}
                        note={outOfRange(w.length, 0.3, 500, t('common.m'))}>
                        <MissingRing fieldKey="length" missing={missing.has(t('common.length'))} className="max-w-[180px]">
                            <SumInput value={w.length} ariaLabel={t('brick.wallLengthM')} onChange={length => setWall(i, { length })} />
                        </MissingRing>
                    </PlanField>
                    <PlanNumber label={triangle ? t('brick.gableApexHeight') : t('brick.wallHeight')} fieldKey="height" unit={t('common.m')} value={w.height}
                        range={[0.5, 10]} missing={missing.has(t('common.height'))}
                        onChange={height => setWall(i, { height })} />
                </div>
                {r !== undefined && r.openings > 0 && (
                    <div className="mt-2 text-[12px] text-gray-500 tabular-nums">
                        {t('brick.openingsDeducted')}{formatNumber(r.openings)} {t('common.sqM')}
                    </div>
                )}
                {net < 0 && (
                    <div className="mt-1 text-[12px] text-red-600">
                        {t('brick.doorsAndWindowsExceedThe')}
                    </div>
                )}
            </PlanCard>
        );
    };

    return (
        <CalculatorShell def={brick} result={result} isDefault={isDefault} onReset={reset}>
            <FromLevel levelId="door-window">
                {openingTotal > 0
                    ? <>{t('brick.totalDoorsAndWindows')}<b>{formatNumber(openingTotal)} {t('common.sqM')}</b> {t('brick.theSystemDeductsThemFrom')}</>
                    : <>{t('brick.thereAreNoDoorsAnd')}</>}
            </FromLevel>

            <SheetCard title={t('brick.brickWalls')}>
                {input.walls.length === 0
                    ? (
                        <EmptyState
                            text={t('brick.noWallsYetCheckThe')}
                            addLabel={t('brick.addWall')} onAdd={() => addWall()}
                            actions={addableGroups > 1
                                ? [{ label: t('brick.addWallsForDoorsAnd', { v: String(addableGroups) }), onClick: addWallsForOpenings }]
                                : []} />
                    )
                    : (
                        <div className="flex flex-col gap-2">
                            {input.walls.length >= 5 && <FillProgress {...countFill(states)} noun={t('brick.wall')} />}
                            {input.walls.map(card)}
                            <AddButton label={t('brick.addWall')} onClick={() => addWall()} />
                        </div>
                    )}

                {unmatched.length > 0 && (
                    <Alert className="mt-3" type="warning" showIcon
                        title={t('brick.someDoorsAndWindowsHave')}
                        description={(
                            <div className="flex flex-col gap-1 text-[12px]">
                                {unmatched.map(([k, v]) => {
                                    const p = keyParts(k);
                                    return (
                                        <div key={k} className="flex flex-wrap items-center gap-2">
                                            <span>{p.wallPart} · {p.brickType} {p.thickness}: {formatNumber(v)} {t('common.sqM')}</span>
                                            {p.wallPart !== '' && p.brickType !== '' && (
                                                <Button size="small" icon={<PlusOutlined />}
                                                    onClick={() => addWall({ wallPart: p.wallPart, brickType: p.brickType, thickness: p.thickness })}>
                                                    {t('brick.addThisWall')}
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}
                                <div className="text-gray-500">{t('brick.addThisWallTypeOr')}</div>
                            </div>
                        )} />
                )}
            </SheetCard>

            <ResultSummary
                items={[
                    ...byType.filter(b => b.value !== 0),
                    { label: t('brick.totalBrickArea'), value: total, unit: t('common.sqM') },
                ]}
                note={t('brick.theMasonryAreaAfterDeducting')} />
        </CalculatorShell>
    );
}
