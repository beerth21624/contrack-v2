'use client';

import { useState } from 'react';
import { Button } from 'antd';
import { UndoOutlined } from '@ant-design/icons';
import {
    paint, paintLinkedSources, paintSuggestions, applyPaintSuggestions, pendingPaintSuggestions, mouldingArea, PAINT_LINES,
    type MouldingRun, type PaintInput, type PaintLineKey, type PaintSuggestions,
} from '@/domain/calculators/paint';
import type { CalcContext } from '@/domain/calculators/types';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { JNumber, LevelLink, ResultSummary, SuggestedValue, levelTitle } from '@/components/sheet/journey';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, InputNumberField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber, SHEET_COLORS } from '@/components/sheet/NumberCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { useProjectStore } from '@/store/project-store';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center';
const td = 'border border-gray-200 px-2 py-1 text-[13px] align-middle';

/** Excel rows 5–6 of the moulding list are the sheet's fixed runs (บัว 0.3, บัว 0.1). */
const FIXED_MOULDINGS = 2;

/** PAINT_LINES[].boq lists the rows of these sections, in this order. */
const SECTIONS = paint.sections;

/** "ใช้ค่าจาก …" — the value another sheet offers for a hand-typed Excel number (decision D20 pending). */
function SourceHint({ sheet, value, current, unit, onUse }: {
    sheet: string; value: number | undefined; current: number; unit: string; onUse: (v: number) => void;
}) {
    const t = useTranslations('calculators');
    if (value === undefined) {
        return <span className="text-[12px] text-gray-400">{t('paint.noValueFrom')}{sheet}</span>;
    }
    const same = Math.abs(value - current) < 1e-9;
    return (
        <span className="inline-flex flex-wrap items-center gap-2 text-[12px] text-gray-600">
            <span>{t('paint.valueFrom')}{sheet}: <b className="tabular-nums">{formatNumber(value, 2)}</b> {unit}</span>
            <Button size="small" disabled={same} onClick={() => onUse(value)}>
                {same ? t('paint.matchesTheValueInThe') : t('paint.useTheValueFromSheet', { sheet })}
            </Button>
        </span>
    );
}

// ─── Journey mode: a review of the areas earlier levels gave, plus the three numbers to confirm ───

/** Where each line's area comes from, in plain words. */
const journeySource = (t: CalcT): Partial<Record<PaintLineKey, { level: string; what: string }>> => ({
    wallExterior: { level: 'plaster', what: t('paint.plasteredExteriorWalls') },
    wallInterior: { level: 'plaster', what: t('paint.plasteredInteriorWalls') },
    ceilingExterior: { level: 'ceiling', what: t('paint.ceilingsPaintedOutside') },
    ceilingInterior: { level: 'ceiling', what: t('paint.ceilingsPaintedInside') },
    ceilingSlat: { level: 'ceiling', what: t('paint.slatCeilingsWoodStain') },
    skim: { level: 'plaster', what: t('paint.plasteredExteriorInteriorWalls') },
});

/** The hand-typed values before an "ใช้ค่า…ทั้งหมด" (for เลิกทำ). */
interface AppliedSnapshot { slatWallArea: number; fasciaLength: number; mouldingLengths: number[]; count: number }

function PaintJourney({ input, update, outputs, linked, suggest }: {
    input: PaintInput; update: UseCalculator<PaintInput>['update']; outputs: Record<string, number>;
    linked: ReturnType<typeof paintLinkedSources>; suggest: PaintSuggestions;
}) {
    const t = useTranslations('calculators');
    const pending = pendingPaintSuggestions(input, suggest);
    // Set by the "ใช้ทั้งหมด" click only; cleared by เลิกทำ.
    const [applied, setApplied] = useState<AppliedSnapshot | null>(null);
    const applyAll = () => {
        setApplied({
            slatWallArea: input.slatWallArea, fasciaLength: input.fasciaLength,
            mouldingLengths: input.mouldings.map(m => m.length), count: pending,
        });
        update(p => applyPaintSuggestions(p, suggest));
    };
    const undoApply = (snap: AppliedSnapshot) => {
        update(p => ({
            ...p, slatWallArea: snap.slatWallArea, fasciaLength: snap.fasciaLength,
            mouldings: p.mouldings.map((m, i) => ({ ...m, length: snap.mouldingLengths[i] ?? m.length })),
        }));
        setApplied(null);
    };
    const isLinked = (key: PaintLineKey) =>
        key === 'ceilingExterior' || key === 'ceilingInterior' || key === 'ceilingSlat' ? linked[key] : linked.plaster;
    const fromLevels = PAINT_LINES.filter(l => journeySource(t)[l.key] !== undefined);
    const setMoulding = (i: number, patch: Partial<MouldingRun>) => update(p => ({
        ...p, mouldings: p.mouldings.map((m, j) => (j === i ? { ...m, ...patch } : m)),
    }));
    const sum = (keys: PaintLineKey[]) => keys.reduce((s, k) => s + (outputs[k] ?? 0), 0);
    // The wall-finishing level was marked "ไม่มีในโครงการนี้" and nothing was typed here: no slat or moulding paint.
    const finishingSkipped = useProjectStore(s => s.project.journey?.['wall-finishing'] === 'skipped');
    const noFinishing = finishingSkipped && input.slatWallArea === 0 && input.mouldings.every(m => m.length === 0);

    return (
        <>
            <SheetCard title={t('paint.paintedAreaFromThePrevious')}>
                <p className="text-[12px] text-gray-500 mb-2">{t('paint.noNeedToFillIn')}</p>
                <div className="divide-y divide-gray-100">
                    {fromLevels.map(l => {
                        const src = journeySource(t)[l.key];
                        if (!src) return null;
                        const area = outputs[l.key] ?? 0;
                        return (
                            <div key={l.key} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5">
                                <span className="text-[13px] text-gray-800 min-w-[200px]">{l.label}</span>
                                <span className="tabular-nums px-2 py-0.5 rounded-sm min-w-[110px] text-right" style={{ background: SHEET_COLORS.calc }}>
                                    {area === 0 ? t('common.none') : t('common.vSqM', { v: formatNumber(area) })}
                                </span>
                                <span className="text-[12px] text-gray-500">
                                    {isLinked(l.key)
                                        ? <>{t('paint.from')}<LevelLink levelId={src.level} /> ({src.what})</>
                                        : <>{t('paint.sampleValueNoDataFrom')}{levelTitle(src.level)})</>}
                                </span>
                                {area === 0 && (
                                    <LevelLink levelId={src.level} className="text-[12px] text-orange-600">
                                        {t('paint.ifTheDrawingsHaveIt')}{levelTitle(src.level)}
                                    </LevelLink>
                                )}
                            </div>
                        );
                    })}
                </div>
            </SheetCard>

            <SheetCard title={t('paint.areasToConfirm')}>
                {/* One value on offer is handled by its own "ใช้ค่านี้"; the bulk action only earns its place for 2+. */}
                {pending > 1 && (
                    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2">
                        <span className="text-[13px] text-gray-800">{t('paint.thePreviousStepsHaveValues')}{pending} {t('paint.itemsTheOldAndNew')}</span>
                        <Button className="ml-auto" onClick={applyAll}>{t('paint.useAllValuesFromThe')}</Button>
                    </div>
                )}
                {pending === 0 && applied !== null && (
                    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] text-green-800">
                        <span>{t('paint.usingTheValuesFromThe')}{applied.count} {t('common.item')}</span>
                        <Button size="small" type="link" icon={<UndoOutlined />} onClick={() => undoApply(applied)}>{t('paint.undo')}</Button>
                    </div>
                )}

                <div className="flex flex-col gap-3">
                    {noFinishing ? (
                        <div className="text-[13px] text-gray-600">
                            {t('paint.paintingOfSlatWallsAnd')}<LevelLink levelId="wall-finishing" /> {t('paint.stateNotInThisProject')}
                        </div>
                    ) : (<>
                    <div>
                        <div className="text-[13px] font-semibold text-gray-800">{t('paint.slatWallPainting')}</div>
                        <JNumber label={t('paint.slatWallArea')} unit={t('common.sqM')} value={input.slatWallArea}
                            onChange={v => update({ slatWallArea: v })} />
                        <SuggestedValue levelId="wall-finishing" value={suggest.slatWallArea} current={input.slatWallArea}
                            unit={t('common.sqM')} onUse={v => update({ slatWallArea: v })} />
                    </div>

                    <div>
                        <div className="text-[13px] font-semibold text-gray-800">{t('paint.wallMouldingPainting')}</div>
                        {input.mouldings.length === 0 && <div className="text-[12px] text-gray-500 py-1">{t('paint.noMouldings')}</div>}
                        {input.mouldings.map((m, i) => (
                            <div key={i}>
                                <JNumber label={m.size.trim() === '' ? t('paint.mouldingLengthV', { v: i + 1 }) : t('paint.mouldingLengthSizeM', { size: m.size })}
                                    unit={t('common.m')} value={m.length} onChange={v => setMoulding(i, { length: v })}
                                    hint={mouldingArea(m) === 0 ? undefined : t('paint.paintingVSqM', { v: formatNumber(mouldingArea(m)) })} />
                                {m.size.trim() !== '' && (
                                    <SuggestedValue levelId="wall-finishing" value={suggest.mouldingLength(m.size)} current={m.length}
                                        unit={t('common.m')} onUse={v => setMoulding(i, { length: v })} />
                                )}
                            </div>
                        ))}
                    </div>
                    </>)}

                    <div>
                        <div className="text-[13px] font-semibold text-gray-800">{t('paint.fasciaPainting')}</div>
                        <JNumber label={t('paint.fasciaLength')} unit={t('common.m')} value={input.fasciaLength}
                            onChange={v => update({ fasciaLength: v })}
                            hint={(outputs.fascia ?? 0) === 0 ? undefined : t('paint.heightVMV2Sq', { v: formatNumber(input.fasciaHeight), v2: formatNumber(outputs.fascia) })} />
                        <SuggestedValue levelId="roofing" value={suggest.fasciaLength} current={input.fasciaLength}
                            unit={t('common.m')} onUse={v => update({ fasciaLength: v })} />
                    </div>
                </div>
            </SheetCard>

            <AdvancedSection title={t('paint.mouldingAndFasciaSizes')}>
                <EditableTable<MouldingRun>
                    rows={input.mouldings}
                    onChange={mouldings => update({ mouldings })}
                    lockedRows={FIXED_MOULDINGS}
                    newRow={() => ({ size: '', girth: 0, length: 0 })}
                    addLabel={t('paint.addMoulding')}
                    columns={[
                        { kind: 'text', key: 'size', title: t('paint.mouldingSizeM'), width: 90, placeholder: t('paint.eG03'),
                            get: r => r.size, set: (r, v) => ({ ...r, size: v.trim() }) },
                        { kind: 'number', key: 'girth', title: t('paint.paintedGirthWidthM'), width: 140,
                            get: r => r.girth, set: (r, v) => ({ ...r, girth: v }) },
                    ]}
                />
                <p className="mt-1 mb-3 text-[12px] text-gray-500">
                    {t('paint.girthWidthMouldingFace2')}
                </p>
                <InputNumberField label={t('paint.fasciaBoardHeight')} unit={t('common.m')} value={input.fasciaHeight}
                    onChange={v => update({ fasciaHeight: v })} />
                <p className="mt-1 text-[12px] text-gray-500">{t('paint.thePaintPricePerSq')}</p>
            </AdvancedSection>

            <ResultSummary
                items={[
                    { label: t('paint.wallPainting'), value: sum(['wallExterior', 'wallInterior']), unit: t('common.sqM') },
                    { label: t('common.ceilingPaint'), value: sum(['ceilingExterior', 'ceilingInterior']), unit: t('common.sqM') },
                    { label: t('paint.slatsMouldingsFascia'), value: sum(['ceilingSlat', 'wallSlat', 'moulding', 'fascia']), unit: t('common.sqM') },
                    { label: t('paint.skimCoat'), value: outputs.skim, unit: t('common.sqM') },
                ]}
                note={t('paint.paintAreaIsCountedFor')} />
        </>
    );
}

export default function PaintPage() {
    const t = useTranslations('calculators');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(paint);
    const inJourney = useJourneyMode();
    const ctx: CalcContext = { outputs: id => result.calcOutputs[id] };
    const linked = paintLinkedSources(ctx);
    const suggest = paintSuggestions(ctx);

    if (inJourney) {
        return (
            <CalculatorShell def={paint} result={result} isDefault={isDefault} onReset={reset}>
                <PaintJourney input={input} update={update} outputs={outputs} linked={linked} suggest={suggest} />
            </CalculatorShell>
        );
    }

    const fromExcel = (sheet: string) => t('paint.defaultValueNotFilledIn', { sheet });
    const source: Record<PaintLineKey, string> = {
        wallExterior: linked.plaster ? t('paint.plasterSheetTotalExteriorPlaster') : fromExcel(t('paint.plasterSheet')),
        wallInterior: linked.plaster ? t('paint.plasterSheetTotalInteriorPlaster') : fromExcel(t('paint.plasterSheet')),
        ceilingExterior: linked.ceilingExterior ? t('paint.ceilingSheetPaintingWorkCeiling') : fromExcel(t('paint.ceilingSheet')),
        ceilingInterior: linked.ceilingInterior ? t('paint.ceilingSheetPaintingWorkCeiling2') : fromExcel(t('paint.ceilingSheet')),
        ceilingSlat: linked.ceilingSlat ? t('paint.ceilingSheetPaintingWorkCeiling3') : fromExcel(t('paint.ceilingSheet')),
        wallSlat: t('paint.enterManuallyItem6Below'),
        moulding: t('paint.girthWidthLengthItem7'),
        fascia: t('paint.lengthFasciaHeightItem8'),
        skim: t('paint.item1Item2Exterior'),
    };

    const setMoulding = (i: number, patch: Partial<MouldingRun>) => update(p => ({
        ...p, mouldings: p.mouldings.map((m, j) => (j === i ? { ...m, ...patch } : m)),
    }));

    return (
        <CalculatorShell def={paint} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title={t('paint.paintingQuantityTable')}>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={th} style={{ width: 48 }}>{t('paint.no')}</th>
                                <th className={th}>{t('common.wallPart2')}</th>
                                <th className={th} style={{ width: 110 }}>{t('paint.areaSqM')}</th>
                                <th className={th}>{t('paint.source')}</th>
                                <th className={th} style={{ width: 120 }}>{t('common.sentToBoq')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {PAINT_LINES.map((l, i) => (
                                <tr key={l.key}>
                                    <td className={`${td} text-center text-gray-500`}>{i + 1}</td>
                                    <td className={td}>{l.label}</td>
                                    <td className={`${td} text-right tabular-nums`} style={{ background: SHEET_COLORS.calc }}>
                                        {formatNumber(outputs[l.key])}
                                    </td>
                                    <td className={`${td} text-[12px] text-gray-600`}>{source[l.key]}</td>
                                    <td className={`${td} text-[12px] text-gray-600`}>
                                        {l.boq.map((r, j) => t('paint.vRowV2', { v: String(SECTIONS[j]), v2: r.slice(1) })).join(' · ')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="mt-2 text-[12px] text-gray-500">
                    {t('paint.theAreasOfAll8')}
                </p>
            </SheetCard>

            <SheetCard title={t('paint.n6WallPaintingSlats')}>
                <InputNumberField label={t('paint.slatWallArea')} unit={t('common.sqM')} value={input.slatWallArea}
                    onChange={v => update({ slatWallArea: v })} />
                <div className="py-1">
                    <SourceHint sheet={t('paint.wallDecorationSlats')} value={suggest.slatWallArea} current={input.slatWallArea}
                        unit={t('common.sqM')} onUse={v => update({ slatWallArea: v })} />
                </div>
                <p className="mt-1 text-[12px] text-gray-500">{t('paint.templateSampleValue33')}</p>
            </SheetCard>

            <SheetCard title={t('paint.n7WallPaintingMouldings')}>
                <EditableTable<MouldingRun>
                    rows={input.mouldings}
                    onChange={mouldings => update({ mouldings })}
                    lockedRows={FIXED_MOULDINGS}
                    newRow={() => ({ size: '', girth: 0, length: 0 })}
                    addLabel={t('paint.addMoulding')}
                    columns={[
                        {
                            kind: 'text', key: 'size', title: t('paint.mouldingSizeM'), width: 90, placeholder: t('paint.eG03'),
                            get: r => r.size, set: (r, v) => ({ ...r, size: v.trim() }),
                        },
                        {
                            kind: 'number', key: 'girth', title: t('paint.girthWidthM'), width: 110,
                            get: r => r.girth, set: (r, v) => ({ ...r, girth: v }),
                        },
                        {
                            kind: 'number', key: 'length', title: t('common.lengthM'), width: 100,
                            get: r => r.length, set: (r, v) => ({ ...r, length: v }),
                        },
                        { kind: 'calc', key: 'area', title: t('paint.areaSqM'), width: 100, get: r => mouldingArea(r) },
                        {
                            kind: 'label', key: 'source', title: t('paint.lengthFromTheWallDecoration'),
                            get: (r, i) => (
                                <SourceHint sheet={t('paint.wallDecorationMouldingSize', { size: r.size })} value={suggest.mouldingLength(r.size)}
                                    current={r.length} unit={t('common.m')} onUse={v => setMoulding(i, { length: v })} />
                            ),
                        },
                    ]}
                />
                <div className="mt-3 max-w-md ml-auto">
                    <CalcField label={t('paint.totalMouldingPaintingArea')} value={outputs.moulding} unit={t('common.sqM')} strong />
                </div>
                <p className="mt-1 text-[12px] text-gray-500">
                    {t('paint.girthWidthMouldingFace22')}
                </p>
            </SheetCard>

            <SheetCard title={t('paint.n8WallPaintingFascia')}>
                <InputNumberField label={t('paint.fasciaLength')} unit={t('common.m')} value={input.fasciaLength}
                    onChange={v => update({ fasciaLength: v })} />
                <div className="py-1">
                    <SourceHint sheet={t('paint.roofingFasciaBoard')} value={suggest.fasciaLength} current={input.fasciaLength}
                        unit={t('common.m')} onUse={v => update({ fasciaLength: v })} />
                </div>
                <InputNumberField label={t('paint.fasciaHeight')} unit={t('common.m')} value={input.fasciaHeight}
                    onChange={v => update({ fasciaHeight: v })} />
                <CalcField label={t('paint.fasciaPaintingArea')} value={outputs.fascia} unit={t('common.sqM')} strong />
                <p className="mt-1 text-[12px] text-gray-500">
                    {t('paint.templateSampleValue632')}
                </p>
            </SheetCard>

            <p className="text-[12px] text-gray-500 px-1">
                {t('paint.items68UseThe')}
            </p>
        </CalculatorShell>
    );
}
