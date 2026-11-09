'use client';

// ─── Step trace panel (dev mode): ① values used ② calculation steps ③ where the results go, ⚠ things to check ───
// Rendered under a step's form (calculator page and journey step). Nothing at all unless dev mode is active.
import Link from 'next/link';
import { Collapse, Tag, Tooltip } from 'antd';
import { getCalculator } from '@/domain/calculators/registry';
import type { CalcTrace, TraceLabelSet } from '@/domain/trace';
import { termLabel, termUnit } from '@/domain/trace';
import { FlagButton } from './ReviewFlags';
import { useCalcTrace } from './useTrace';
import { SOURCE_ICON, boqLineHref, stepHref, useTraceText, type InputRow, type StepRow, type TraceText } from './useTraceText';

const td = 'border border-gray-200 px-2 py-1 text-[12px] align-top';
const th = `${td} bg-gray-50 font-semibold text-left whitespace-nowrap`;
const tdNum = `${td} text-right tabular-nums whitespace-nowrap`;

const SOURCE_TONE: Record<InputRow['source'], string> = {
    user: 'text-blue-700', default: 'text-red-600 font-semibold', constant: 'text-red-600 font-semibold', dependency: 'text-green-700',
};

export function SourceBadge({ source, from, tx }: { source: InputRow['source']; from?: string; tx: TraceText }) {
    const label = `${SOURCE_ICON[source]} ${tx.t(`source.${source}`)}`;
    const body = source === 'dependency' && from !== undefined
        ? <Link href={stepHref(from)} className="text-green-700 hover:underline">{SOURCE_ICON.dependency} {tx.stepName(from)}</Link>
        : <span className={SOURCE_TONE[source]}>{label}</span>;
    return <Tooltip title={tx.t(`source.hint.${source}`)}>{body}</Tooltip>;
}

/** Rows grouped by `group` (row label), keeping their order; the ungrouped ones first. */
function grouped<T extends { group: string }>(rows: T[]): [string, T[]][] {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.group, [...(m.get(r.group) ?? []), r]);
    return [...m.entries()];
}

function InputsTable({ rows, tx }: { rows: InputRow[]; tx: TraceText }) {
    if (rows.length === 0) return <div className="text-[12px] text-gray-500">{tx.t('trace.noInputs')}</div>;
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className={th}>{tx.t('trace.col.name')}</th>
                        <th className={th}>{tx.t('trace.col.value')}</th>
                        <th className={th}>{tx.t('trace.col.unit')}</th>
                        <th className={th}>{tx.t('trace.col.source')}</th>
                        <th className={th}>{tx.t('trace.col.defaultValue')}</th>
                    </tr>
                </thead>
                <tbody>
                    {grouped(rows).map(([group, list]) => [
                        group !== '' && (
                            <tr key={`g:${group}`}><td className={`${td} font-semibold bg-orange-50`} colSpan={5}>{group}</td></tr>
                        ),
                        ...list.map(r => (
                            <tr key={r.path}>
                                <td className={td}>{r.name}</td>
                                <td className={tdNum}>{r.value}</td>
                                <td className={td}>{r.unit}</td>
                                <td className={`${td} whitespace-nowrap`}><SourceBadge source={r.source} from={r.from} tx={tx} /></td>
                                <td className={tdNum}>{r.defaultValue ?? ''}</td>
                            </tr>
                        )),
                    ])}
                </tbody>
            </table>
        </div>
    );
}

function StepsTable({ rows, tx }: { rows: StepRow[]; tx: TraceText }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className={th}>{tx.t('trace.col.step')}</th>
                        <th className={th}>{tx.t('trace.col.formulaWords')}</th>
                        <th className={th}>{tx.t('trace.col.formulaNumbers')}</th>
                        <th className={th}>{tx.t('trace.col.result')}</th>
                        <th className={th}>{tx.t('trace.col.unit')}</th>
                    </tr>
                </thead>
                <tbody>
                    {grouped(rows).map(([group, list]) => [
                        <tr key={`g:${group}`}>
                            <td className={`${td} font-semibold bg-orange-50`} colSpan={5}>{group === '' ? tx.t('trace.totals') : group}</td>
                        </tr>,
                        ...list.map(r => (
                            <tr key={r.key}>
                                <td className={`${td} font-medium`}>{r.label}</td>
                                <td className={`${td} min-w-[180px]`}>{r.words}</td>
                                <td className={`${td} min-w-[140px] tabular-nums`}>{r.numbers}</td>
                                <td className={`${tdNum} font-semibold`}>{r.value}</td>
                                <td className={td}>{r.unit}</td>
                            </tr>
                        )),
                    ])}
                </tbody>
            </table>
        </div>
    );
}

function OutputsTable({ trace, labels, tx }: { trace: CalcTrace; labels: TraceLabelSet | undefined; tx: TraceText }) {
    if (trace.outputs.length === 0 && trace.slotRows.length === 0) {
        return <div className="text-[12px] text-gray-500">{tx.t('trace.noOutputs')}</div>;
    }
    return (
        <div className="flex flex-col gap-3">
            {trace.outputs.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={th}>{tx.t('trace.col.output')}</th>
                                <th className={th}>{tx.t('trace.col.value')}</th>
                                <th className={th}>{tx.t('trace.col.unit')}</th>
                                <th className={th}>{tx.t('trace.col.destination')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trace.outputs.map(o => (
                                <tr key={o.key}>
                                    <td className={td}>
                                        <span className="inline-flex items-center gap-1">
                                            {termLabel(labels, o.key)}
                                            <FlagButton target={{ kind: 'output', calc: trace.calcId, output: o.key }}
                                                title={`${tx.stepName(trace.calcId)} · ${termLabel(labels, o.key)}`} />
                                        </span>
                                    </td>
                                    <td className={`${tdNum} font-semibold`}>{tx.num(o.value)}</td>
                                    <td className={td}>{termUnit(labels, o.key)}</td>
                                    <td className={td}>
                                        <div className="flex flex-col gap-0.5">
                                            {o.links.map(l => (
                                                <div key={`${l.line}:${l.field}`} className="flex flex-wrap items-center gap-1">
                                                    <Link href={boqLineHref(l.line)} className="text-blue-600 hover:underline">
                                                        {tx.t('trace.toBoqLine', { item: l.itemNo ?? '', desc: tx.lineText(undefined, l.line, l.desc), field: tx.fieldName(l.field) })}
                                                    </Link>
                                                    {l.overridden && <Tag color="orange" className="!text-[11px] !m-0">{tx.t('trace.overridden')}</Tag>}
                                                    {!l.applied && !l.overridden && <Tag className="!text-[11px] !m-0">{tx.t('trace.notApplied')}</Tag>}
                                                </div>
                                            ))}
                                            {o.usedBy.map(c => (
                                                <Link key={c} href={stepHref(c)} className="text-green-700 hover:underline">
                                                    {tx.t('trace.toStep', { step: tx.stepName(c) })}
                                                </Link>
                                            ))}
                                            {o.links.length === 0 && o.usedBy.length === 0 && <span className="text-gray-500">{tx.t('trace.notUsed')}</span>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {trace.slotRows.length > 0 && (
                <div>
                    <div className="text-[12px] font-semibold text-gray-700 mb-1">{tx.t('trace.slotRows')}</div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <tbody>
                                {trace.slotRows.map(r => (
                                    <tr key={r.line}>
                                        <td className={td}>
                                            <Link href={boqLineHref(r.line)} className="text-blue-600 hover:underline">{tx.lineText(r.itemNo, r.line, r.desc)}</Link>
                                        </td>
                                        <td className={tdNum}>{r.qty === null ? '' : tx.num(r.qty)}</td>
                                        <td className={td}>{tx.unit(r.unit)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {trace.dependents.length > 0 && (
                <div className="text-[12px] text-gray-700 flex flex-wrap gap-x-3 gap-y-1">
                    <span className="font-semibold">{tx.t('trace.dependents')}:</span>
                    {trace.dependents.map(c => (
                        <Link key={c} href={stepHref(c)} className="text-green-700 hover:underline">{tx.stepName(c)}</Link>
                    ))}
                </div>
            )}
        </div>
    );
}

export function TraceChecks({ trace, tx }: { trace: CalcTrace; tx: TraceText }) {
    return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="text-[13px] font-semibold text-amber-800">{tx.t('trace.checks')}</div>
            {trace.warnings.length === 0
                ? <div className="text-[12px] text-gray-600">{tx.t('trace.noChecks')}</div>
                : (
                    <ul className="list-disc pl-5 text-[12px] text-amber-900 m-0">
                        {trace.warnings.map((w, i) => (
                            <li key={i}>
                                {tx.warningText(w)}
                                {w.kind === 'dependencyMissing' && (
                                    <> · <Link href={stepHref(w.calc)} className="text-blue-600 hover:underline">{tx.t('trace.openStep')}</Link></>
                                )}
                                {w.kind === 'boqOverride' && (
                                    <> · <Link href={boqLineHref(w.line)} className="text-blue-600 hover:underline">{tx.t('trace.openBoqLine')}</Link></>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
        </div>
    );
}

function Legend({ tx }: { tx: TraceText }) {
    return (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-gray-600">
            <span className="font-semibold">{tx.t('source.legend')}:</span>
            {(['user', 'default', 'constant', 'dependency'] as const).map(s => (
                <Tooltip key={s} title={tx.t(`source.hint.${s}`)}><span className={SOURCE_TONE[s]}>{SOURCE_ICON[s]} {tx.t(`source.${s}`)}</span></Tooltip>
            ))}
        </div>
    );
}

/** The trace of one step; renders nothing unless dev mode is active. */
export function CalcTracePanel({ calcId }: { calcId: string }) {
    const def = getCalculator(calcId);
    // useCalcTrace needs a def; an unknown id gets a stub that traces to nothing.
    const data = useCalcTrace(def ?? { id: calcId });
    const tx = useTraceText();
    if (!data) return null;
    const { trace, labels } = data;
    const inputs = tx.inputRows(trace, labels);
    const steps = tx.stepRows(trace, labels);
    return (
        <section className="bg-white border-2 border-dashed border-amber-300 rounded-card p-3 sm:p-4 shadow-card flex flex-col gap-3 min-w-0"
            aria-label={tx.t('trace.title')} data-dev-trace={calcId}>
            <div className="text-[14px] font-semibold text-gray-800">{tx.t('trace.title')}</div>
            <Legend tx={tx} />
            <TraceChecks trace={trace} tx={tx} />
            <Collapse size="small" defaultActiveKey={['steps', 'outputs']}
                items={[
                    { key: 'inputs', label: `${tx.t('trace.inputs')} (${String(inputs.length)})`, children: <InputsTable rows={inputs} tx={tx} /> },
                    {
                        key: 'steps',
                        label: `${tx.t('trace.steps')} (${String(steps.length)})`,
                        children: !trace.instrumented
                            ? <div className="text-[12px] text-gray-500">{tx.t('trace.notInstrumented')}</div>
                            : steps.length === 0 ? <div className="text-[12px] text-gray-500">{tx.t('trace.noSteps')}</div>
                                : <StepsTable rows={steps} tx={tx} />,
                    },
                    { key: 'outputs', label: tx.t('trace.outputs'), children: <OutputsTable trace={trace} labels={labels} tx={tx} /> },
                ]}
            />
        </section>
    );
}

export { InputsTable as TraceInputsTable, StepsTable as TraceStepsTable };
