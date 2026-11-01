'use client';

// Guided-journey view of the two pipe-run sheets (ท่อน้ำทิ้ง / ท่อน้ำดี): the fixed main rows (one per pipe size the
// BOQ prices) with only their lengths to fill, optional extra runs, prices folded away, and a short length summary.
// Same input and calculation as the Excel-mirror table in PipeRunsSheet.
import { Button, Tag } from 'antd';
import type { CalculatorDef } from '@/domain/calculators/types';
import type { BoqItemRow } from '@/domain/boq/types';
import type { ProjectResult } from '@/domain/project';
import {
    normalizeSize, plainLabel, runLength, sizeFromLabel, sizeMismatches, unlinkedRuns,
    type PipeBoqLine, type PipePlainLabel, type PipeRun, type PipeRunsInput,
} from '@/domain/calculators/waste-pipe/pipe-runs';
import { SheetCard } from '@/components/sheet/SheetFields';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, ChoiceButtons, EmptyState, PlanCard, PlanField, RequiredArea, RequiredMark, ResultSummary, SumInput, fillState, outOfRange,
} from '@/components/sheet/journey';
import { useTranslations } from 'next-intl';

const NO_DEPS = { outputs: () => undefined };
const EMPTY_RUN: PipeRun = { label: '', size: '', horizontal: 0, vertical: 0 };

/** A pipe length read off the plan (segments can be typed as a sum), with a plausibility note. */
function LengthField({ label, hint, value, onChange, fieldKey }: {
    label: string; hint?: string; value: number; onChange: (v: number) => void; fieldKey: 'horizontal' | 'vertical';
}) {
    const t = useTranslations('calculators');
    return (
        <PlanField label={label} hint={hint} note={outOfRange(value, 0.2, 200, t('common.m'))} fieldKey={fieldKey}>
            <span className="max-w-[150px]">
                <SumInput value={value} ariaLabel={label} placeholder={t('wastePipe.eG435')} onChange={onChange} />
            </span>
        </PlanField>
    );
}

export function PipeRunsJourney({ def, input, onChange, result, items, sizes, lines, plain, noun }: {
    def: CalculatorDef<PipeRunsInput>;
    input: PipeRunsInput;
    onChange: (runs: PipeRun[]) => void;
    result: ProjectResult;
    items: readonly string[];
    sizes: readonly string[];
    lines: readonly PipeBoqLine[];
    plain: Record<string, PipePlainLabel>;
    /** What the pipes are, e.g. "ท่อน้ำทิ้ง". */
    noun: string;
}) {
    const t = useTranslations('calculators');
    const n = lines.length;
    const template = (def.blank?.() ?? def.defaults()).runs;
    const fixed = lines.map((_, i) => input.runs[i] ?? template[i] ?? EMPTY_RUN);
    const extras = input.runs.slice(n);
    const out = def.compute(input, NO_DEPS);
    const setFixed = (rows: PipeRun[]) => onChange([...rows, ...extras]);
    const setExtras = (rows: PipeRun[]) => onChange([...fixed, ...rows]);
    const addExtra = () => setExtras([...extras, EMPTY_RUN]);

    /** Plain name of a main row: its own item when known, else its own text, else the Excel item of that row. */
    const fixedName = (i: number): string => {
        const own = fixed[i]?.label ?? '';
        const known = plainLabel(own, plain);
        if (known) return known.name;
        if (own.trim() !== '') return own.trim();
        return plainLabel(template[i]?.label ?? '', plain)?.name ?? t('wastePipe.pipe', { v: lines[i]?.size ?? '' });
    };
    const fixedHint = (i: number) => plainLabel(fixed[i]?.label ?? '', plain)?.hint
        ?? plainLabel(template[i]?.label ?? '', plain)?.hint;

    const sectionNo = def.sections[0] ?? 0;
    const boqRow = (line: PipeBoqLine) => result.boq.sections.find(s => s.no === sectionNo)?.rows
        .find((r): r is BoqItemRow => r.type === 'item' && r.key === line.line);

    const mismatches = sizeMismatches(input, lines);
    const unlinked = unlinkedRuns(input, lines);
    const itemOptions = items.map(v => ({ value: v, label: plainLabel(v, plain)?.name ?? v }));
    const sizeOptions = sizes.map(v => ({ value: v, label: v }));
    const waste = lines.map(boqRow).find(r => r !== undefined)?.waste;

    return (
        <>
            <SheetCard title={<>{t('wastePipe.mainPipe')}<RequiredMark required /></>}>
                <p className="mb-2 text-[13px] text-gray-600">
                    {t('wastePipe.enterTheLengthOfEach')}
                </p>
                <RequiredArea className="flex flex-col gap-2">
                    {fixed.map((r, i) => {
                        const len = runLength(r);
                        return (
                            <div key={lines[i]?.line ?? i} className="rounded-md border border-gray-200 px-3 py-2.5">
                                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_150px_150px_110px] items-start gap-x-3 gap-y-2">
                                    <div className="min-w-0">
                                        <div className="text-[13px] font-medium text-gray-800">{fixedName(i)}</div>
                                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                            <Tag color="blue" className="!mr-0">{lines[i]?.size}</Tag>
                                            <span className="text-[11px] text-gray-400">{fixedHint(i)}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <LengthField label={t('wastePipe.horizontalM')} fieldKey="horizontal" value={r.horizontal}
                                            onChange={horizontal => setFixed(fixed.map((x, j) => (j === i ? { ...x, horizontal } : x)))} />
                                    </div>
                                    <div>
                                        <LengthField label={t('wastePipe.verticalM')} fieldKey="vertical" hint={t('wastePipe.risersDropsThroughWallsFloors')} value={r.vertical}
                                            onChange={vertical => setFixed(fixed.map((x, j) => (j === i ? { ...x, vertical } : x)))} />
                                    </div>
                                    <span className="md:self-center text-[13px] tabular-nums md:text-right">
                                        {len > 0
                                            ? <span className="px-2 py-0.5 rounded" style={{ background: SHEET_COLORS.calc }}>{t('wastePipe.total')}{formatNumber(len)}{t('common.m3')}</span>
                                            : <span className="text-gray-400">—</span>}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </RequiredArea>
                {mismatches.map(m => (
                    <div key={m.index} className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-orange-50 border border-orange-200 px-3 py-2 text-[13px] text-orange-700">
                        <span>
                            &quot;{fixedName(m.index)}{t('wastePipe.wasChangedToPipe')}{m.size}{t('wastePipe.butThePriceUsedIs')}{m.line.size}
                        </span>
                        <Button size="small" onClick={() => setFixed(fixed.map((r, i) => (i === m.index
                            ? { ...r, size: m.line.size, label: template[i]?.label ?? r.label }
                            : r)))}>
                            {t('wastePipe.backToPipe')}{m.line.size}
                        </Button>
                    </div>
                ))}
            </SheetCard>

            <SheetCard title={t('wastePipe.additionalIfAny', { noun })}>
                {extras.length === 0
                    ? (
                        <EmptyState
                            text={t('wastePipe.toEnterRunsSeparatelyE')}
                            addLabel={t('wastePipe.addAnotherRun', { noun })} onAdd={addExtra} />
                    )
                    : (
                        <div className="flex flex-col gap-2">
                            {extras.map((r, i) => {
                                const len = runLength(r);
                                const size = normalizeSize(r.size);
                                const problem = unlinked.find(u => u.index === n + i);
                                const state = fillState([len > 0 && problem === undefined], len > 0);
                                const setExtra = (patch: Partial<PipeRun>) => setExtras(extras.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                                return (
                                    <PlanCard key={i} index={i + 1} state={state} compact
                                        title={plainLabel(r.label, plain)?.name ?? (r.label.trim() === '' ? t('wastePipe.run', { noun, v: String(i + 1) }) : r.label)}
                                        result={len > 0 ? <>{t('wastePipe.total')}{formatNumber(len)}{t('common.m3')}</> : undefined}
                                        onDelete={() => setExtras(extras.filter((_, j) => j !== i))} hasData={len > 0}
                                        deleteTitle={t('wastePipe.deleteThisPipeRun')}
                                        missingText={problem === undefined ? undefined
                                            : t('wastePipe.lengthMIsNotCounted', { v: problem.size === '' ? t('wastePipe.pipeSizeNotSelectedYet') : t('wastePipe.noPriceForPipeSize', { size: problem.size }), v2: formatNumber(problem.length) })}>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 items-start">
                                            <PlanField label={t('wastePipe.conduitType')} className="sm:col-span-2">
                                                <ChoiceButtons ariaLabel={t('wastePipe.conduitType')} size="small" options={itemOptions}
                                                    value={r.label === '' ? undefined : items.find(it => it.trim() === r.label.trim())}
                                                    // The item ends with its pipe size: pick that size too (it can still be changed).
                                                    onChange={v => {
                                                        const fromLabel = sizeFromLabel(v, sizes);
                                                        setExtra({ label: v, size: fromLabel === '' ? r.size : fromLabel });
                                                    }} />
                                            </PlanField>
                                            <PlanField label={t('wastePipe.pipeSize')}>
                                                <ChoiceButtons ariaLabel={t('wastePipe.pipeSize')} size="small" options={sizeOptions}
                                                    value={size === '' ? undefined : size} onChange={v => setExtra({ size: v })} />
                                            </PlanField>
                                            <div className="hidden sm:block" />
                                            <LengthField label={t('wastePipe.horizontalM')} fieldKey="horizontal" value={r.horizontal}
                                                onChange={horizontal => setExtra({ horizontal })} />
                                            <LengthField label={t('wastePipe.verticalM')} fieldKey="vertical" hint={t('wastePipe.risersDropsThroughWallsFloors')} value={r.vertical}
                                                onChange={vertical => setExtra({ vertical })} />
                                        </div>
                                    </PlanCard>
                                );
                            })}
                            <AddButton label={t('wastePipe.addAnotherRun', { noun })} onClick={addExtra} />
                        </div>
                    )}
            </SheetCard>

            <AdvancedSection>
                <table className="w-full max-w-lg border-collapse text-[13px]">
                    <thead>
                        <tr className="text-gray-600">
                            <th className="text-left font-semibold py-1">{t('wastePipe.pipe2')}</th>
                            <th className="text-right font-semibold py-1">{t('wastePipe.pipeCostM')}</th>
                            <th className="text-right font-semibold py-1">{t('wastePipe.labourM')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((l, i) => {
                            const row = boqRow(l);
                            return (
                                <tr key={l.line} className="border-t border-gray-100">
                                    <td className="py-1">{l.size} <span className="text-gray-400">{fixedName(i)}</span></td>
                                    <td className="py-1 text-right tabular-nums">{formatNumber(row?.matUnit, 0)}{t('common.baht2')}</td>
                                    <td className="py-1 text-right tabular-nums">{formatNumber(row?.labUnit, 0)}{t('common.baht2')}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <ul className="mt-2 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    {waste !== undefined && <li>{t('wastePipe.allowForPipeOffcuts')}{formatNumber(waste * 100, 0)}{t('wastePipe.labourIsCalculatedFromThe')}</li>}
                    <li>{t('wastePipe.fittingsAndConsumablesAdd50')}</li>
                    <li>{t('wastePipe.editPricesOnTheBOQ')}</li>
                </ul>
            </AdvancedSection>

            <ResultSummary
                items={[
                    ...lines.map((l, i) => ({ label: t('wastePipe.pipe3', { size: l.size }), value: out[l.line], unit: t('common.m'), detail: fixedName(i) })),
                    ...(lines.length > 1
                        ? [{ label: t('wastePipe.ofAllSizes', { noun }), value: (out.total ?? 0) - (out.unlinked ?? 0), unit: t('common.m') }]
                        : []),
                ]} />
        </>
    );
}
