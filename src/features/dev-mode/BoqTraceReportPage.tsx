'use client';

// ─── /print/boq-trace: "รายงานที่มาของตัวเลข BOQ" — the printed trace of the open project (dev mode only) ───
// Cover, project-wide ⚠ summary, every BOQ line with its numbers, source and formula, then an appendix per step
// (values used, calculation steps, where the results go). Every number comes from computeBoq / the calculators
// (explainBoq, traceProjectCalculator); the BOQ page opens this page in the same tab so a cloud project held in
// memory is still there.
import { useEffect, useMemo, useState } from 'react';
import { Alert, Skeleton } from 'antd';
import { useLocale } from 'next-intl';
import { calculatorsInOrder } from '@/domain/calculators/registry';
import { ENGINE_VERSION } from '@/domain/project';
import {
    explainProjectBoq, projectTraceBase, traceLabelSet, traceProjectCalculator, termLabel, termUnit,
    type BoqExplanation, type BoqLineExplanation, type CalcTrace,
} from '@/domain/trace';
import { resolveLocale } from '@/i18n/config';
import { useFormat } from '@/i18n/useFormat';
import { useProjectStore } from '@/store/project-store';
import { useBoqText } from '@/features/boq-home/useBoqText';
import { PrintFrame } from '@/features/erp/shared/PrintFrame';
import { loadDevModeAllowed } from './config';
import { useDevMode } from './useDevMode';
import { SOURCE_ICON, useTraceText, type TraceText } from './useTraceText';

const CSS = `
.dtr { font-size: 9pt; }
.dtr h1 { font-size: 18pt; margin: 0 0 4mm; }
.dtr h2 { font-size: 12pt; margin: 6mm 0 2mm; padding-bottom: 1mm; border-bottom: 0.4mm solid #f97316; break-after: avoid; }
.dtr h3 { font-size: 10.5pt; margin: 5mm 0 1.5mm; break-after: avoid; }
.dtr h4 { font-size: 9.5pt; margin: 3mm 0 1mm; break-after: avoid; }
.dtr table { width: 100%; border-collapse: collapse; margin-bottom: 2mm; }
.dtr th, .dtr td { border: 0.2mm solid #d1d5db; padding: 0.6mm 1.2mm; vertical-align: top; text-align: left; }
.dtr th { background: #f3f4f6; font-weight: 600; }
.dtr thead { display: table-header-group; }
.dtr tr { break-inside: avoid; }
.dtr .num { text-align: right; white-space: nowrap; }
.dtr .grp td { background: #fff7ed; font-weight: 600; }
.dtr .sec td { background: #e5e7eb; font-weight: 700; }
.dtr .small { font-size: 8pt; color: #374151; }
.dtr .warn { background: #fffbeb; border: 0.3mm solid #fcd34d; padding: 2mm 3mm; border-radius: 1.5mm; }
.dtr .warn ul { margin: 0; padding-left: 5mm; }
.dtr .cover { border: 0.3mm solid #d1d5db; border-radius: 2mm; padding: 4mm 5mm; margin-bottom: 4mm; }
.dtr .cover td { border: 0; padding: 0.8mm 2mm 0.8mm 0; }
.dtr .step { break-before: auto; }
.dtr .muted { color: #6b7280; }
`;

interface StepTrace { calc: string; name: string; trace: CalcTrace }

function LineSource({ expl, line: l, tx }: { expl: BoqExplanation; line: BoqLineExplanation; tx: TraceText }) {
    return (
        <div className="small">
            <div>{tx.t('explain.cell.qty')}: {tx.netSource(expl, l.net.source)}{l.net.cleaned ? ` ⚠ ${tx.t('explain.cleaned')}` : ''}</div>
            <div>{tx.t('explain.cell.waste')}: {tx.t(`explain.waste.${l.waste.source}`)}</div>
            <div>{tx.t('explain.cell.matUnit')}: {tx.priceSource(expl, l.mat)}</div>
            <div>{tx.t('explain.cell.labUnit')}: {tx.priceSource(expl, l.lab)}</div>
        </div>
    );
}

function LineFormula({ expl, line: l, tx }: { expl: BoqExplanation; line: BoqLineExplanation; tx: TraceText }) {
    const parts = [
        tx.netNumbers(l) !== '' ? `${tx.t('explain.cell.qty')}: ${tx.netNumbers(l)}` : '',
        l.gross.rule.kind === 'none' ? '' : `${tx.grossRule(expl, l.gross.rule)}: ${tx.grossNumbers(l)}`,
        `${tx.t('explain.cell.matTotal')}: ${tx.priceTotalNumbers(l.mat)} (${tx.t(`explain.basis.${l.mat.basis}`)})`,
        `${tx.t('explain.cell.labTotal')}: ${tx.priceTotalNumbers(l.lab)} (${tx.t(`explain.basis.${l.lab.basis}`)})`,
        `${tx.t('explain.cell.total')}: ${tx.totalNumbers(l)}`,
    ].filter(p => p !== '');
    return <div className="small">{parts.map(p => <div key={p}>{p}</div>)}</div>;
}

function StepAppendix({ s, tx, locale }: { s: StepTrace; tx: TraceText; locale: string }) {
    const def = calculatorsInOrder().find(c => c.id === s.calc);
    const labels = traceLabelSet(def?.traceLabels, locale);
    const inputs = tx.inputRows(s.trace, labels);
    const steps = tx.stepRows(s.trace, labels);
    return (
        <section className="step">
            <h3>{s.name}</h3>
            {s.trace.warnings.length > 0 && (
                <div className="warn"><ul>{s.trace.warnings.map((w, i) => <li key={i}>{tx.warningText(w)}</li>)}</ul></div>
            )}
            <h4>{tx.t('trace.inputs')}</h4>
            {inputs.length === 0 ? <div className="muted">{tx.t('trace.noInputs')}</div> : (
                <table>
                    <thead><tr>
                        <th>{tx.t('trace.col.name')}</th><th>{tx.t('trace.col.value')}</th><th>{tx.t('trace.col.unit')}</th>
                        <th>{tx.t('trace.col.source')}</th><th>{tx.t('trace.col.defaultValue')}</th>
                    </tr></thead>
                    <tbody>
                        {inputs.flatMap((r, i) => {
                            const rows = [];
                            if (r.group !== '' && r.group !== inputs[i - 1]?.group) rows.push(<tr key={`g:${r.path}`} className="grp"><td colSpan={5}>{r.group}</td></tr>);
                            rows.push(
                                <tr key={r.path}>
                                    <td>{r.name}</td><td className="num">{r.value}</td><td>{r.unit}</td>
                                    <td>{SOURCE_ICON[r.source]} {r.source === 'dependency' && r.from !== undefined ? tx.stepName(r.from) : tx.t(`source.${r.source}`)}</td>
                                    <td className="num">{r.defaultValue ?? ''}</td>
                                </tr>,
                            );
                            return rows;
                        })}
                    </tbody>
                </table>
            )}
            <h4>{tx.t('trace.steps')}</h4>
            {!s.trace.instrumented ? <div className="muted">{tx.t('trace.notInstrumented')}</div>
                : steps.length === 0 ? <div className="muted">{tx.t('trace.noSteps')}</div> : (
                    <table>
                        <thead><tr>
                            <th>{tx.t('trace.col.step')}</th><th>{tx.t('trace.col.formulaWords')}</th><th>{tx.t('trace.col.formulaNumbers')}</th>
                            <th>{tx.t('trace.col.result')}</th><th>{tx.t('trace.col.unit')}</th>
                        </tr></thead>
                        <tbody>
                            {steps.flatMap((r, i) => {
                                const rows = [];
                                if (i === 0 || r.group !== steps[i - 1]?.group) rows.push(<tr key={`g:${r.key}`} className="grp"><td colSpan={5}>{r.group === '' ? tx.t('trace.totals') : r.group}</td></tr>);
                                rows.push(
                                    <tr key={r.key}>
                                        <td>{r.label}</td><td>{r.words}</td><td>{r.numbers}</td><td className="num">{r.value}</td><td>{r.unit}</td>
                                    </tr>,
                                );
                                return rows;
                            })}
                        </tbody>
                    </table>
                )}
            <h4>{tx.t('trace.outputs')}</h4>
            {s.trace.outputs.length === 0 ? <div className="muted">{tx.t('trace.noOutputs')}</div> : (
                <table>
                    <thead><tr>
                        <th>{tx.t('trace.col.output')}</th><th>{tx.t('trace.col.value')}</th><th>{tx.t('trace.col.unit')}</th><th>{tx.t('trace.col.destination')}</th>
                    </tr></thead>
                    <tbody>
                        {s.trace.outputs.map(o => (
                            <tr key={o.key}>
                                <td>{termLabel(labels, o.key)}</td><td className="num">{tx.num(o.value)}</td><td>{termUnit(labels, o.key)}</td>
                                <td>
                                    {o.links.map(l => (
                                        <div key={`${l.line}:${l.field}`}>
                                            {tx.t('trace.toBoqLine', { item: l.itemNo ?? '', desc: tx.lineText(undefined, l.line, l.desc), field: tx.fieldName(l.field) })}
                                            {l.overridden ? ` (${tx.t('trace.overridden')})` : !l.applied ? ` (${tx.t('trace.notApplied')})` : ''}
                                        </div>
                                    ))}
                                    {o.usedBy.map(c => <div key={c}>{tx.t('trace.toStep', { step: tx.stepName(c) })}</div>)}
                                    {o.links.length === 0 && o.usedBy.length === 0 && <span className="muted">{tx.t('trace.notUsed')}</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {s.trace.slotRows.length > 0 && (
                <>
                    <h4>{tx.t('trace.slotRows')}</h4>
                    <table><tbody>
                        {s.trace.slotRows.map(r => (
                            <tr key={r.line}><td>{tx.lineText(r.itemNo, r.line, r.desc)}</td><td className="num">{r.qty === null ? '' : tx.num(r.qty)}</td><td>{tx.unit(r.unit)}</td></tr>
                        ))}
                    </tbody></table>
                </>
            )}
        </section>
    );
}

function Report() {
    const locale = useLocale();
    const tx = useTraceText();
    const fmt = useFormat();
    const bt = useBoqText();
    const project = useProjectStore(s => s.project);
    const [generatedAt] = useState(() => new Date());
    const data = useMemo(() => {
        const base = projectTraceBase(project);
        const expl = explainProjectBoq(project, base);
        const steps: StepTrace[] = [];
        for (const def of calculatorsInOrder()) {
            const trace = traceProjectCalculator(project, def.id, base);
            if (trace) steps.push({ calc: def.id, name: bt.calc(def), trace });
        }
        return { base, expl, steps };
    }, [project, bt]);
    const { base, expl, steps } = data;
    const cleanedLines = expl.order.map(k => expl.lines[k]).filter((l): l is BoqLineExplanation =>
        l !== undefined && (l.net.cleaned || l.mat.cleaned || l.lab.cleaned));
    const withWarnings = steps.filter(s => s.trace.warnings.length > 0);
    const sectionTitle = new Map(base.boq.sections.map(s => [s.no, bt.section(s.no, s.title)]));
    const title = `${tx.t('report.title')} ${project.meta.projectName}`.trim();
    // Shown without the spreadsheet prefix of the internal id (never mention the spreadsheet on screen).
    const engine = ENGINE_VERSION.replace(/^excel-?/i, '');

    return (
        <PrintFrame language={resolveLocale(locale)} title={title} orientation="landscape" ready>
            <style>{CSS}</style>
            <div className="dtr">
                <h1>{tx.t('report.title')}</h1>
                <div className="cover">
                    <table><tbody>
                        <tr><td><b>{tx.t('report.project')}</b></td><td>{project.meta.projectName}</td></tr>
                        <tr><td><b>{tx.t('report.revision')}</b></td><td>{project.meta.revision}</td></tr>
                        <tr><td><b>{tx.t('report.generatedAt')}</b></td><td>{fmt.dateTime(generatedAt)}</td></tr>
                        <tr><td><b>{tx.t('report.engineVersion')}</b></td><td>{engine}</td></tr>
                        <tr><td><b>{tx.t('source.legend')}</b></td><td>
                            {(['user', 'default', 'constant', 'dependency'] as const).map(s => `${SOURCE_ICON[s]} ${tx.t(`source.${s}`)}`).join(' · ')}
                        </td></tr>
                    </tbody></table>
                </div>

                <h2>{tx.t('report.summary')}</h2>
                {withWarnings.length === 0 && cleanedLines.length === 0
                    ? <div className="muted">{tx.t('report.noWarnings')}</div>
                    : (
                        <div className="warn">
                            <ul>
                                {withWarnings.map(s => (
                                    <li key={s.calc}><b>{s.name}</b>: {s.trace.warnings.map(w => tx.warningText(w)).join(' · ')}</li>
                                ))}
                                {cleanedLines.map(l => (
                                    <li key={l.key}><b>{tx.lineText(l.itemNo, l.key, l.desc)}</b>: {tx.t('explain.cleaned')}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                <h2>{tx.t('report.lines')}</h2>
                <table>
                    <thead><tr>
                        <th>{tx.t('report.col.item')}</th><th>{tx.t('report.col.desc')}</th><th>{tx.t('report.col.qty')}</th>
                        <th>{tx.t('report.col.unit')}</th><th>{tx.t('report.col.gross')}</th><th>{tx.t('report.col.matUnit')}</th>
                        <th>{tx.t('report.col.matTotal')}</th><th>{tx.t('report.col.labUnit')}</th><th>{tx.t('report.col.labTotal')}</th>
                        <th>{tx.t('report.col.total')}</th><th>{tx.t('report.col.source')}</th><th>{tx.t('report.col.formula')}</th>
                    </tr></thead>
                    <tbody>
                        {expl.order.flatMap((k, i) => {
                            const l = expl.lines[k];
                            if (!l) return [];
                            const prev = i > 0 ? expl.lines[expl.order[i - 1] ?? ''] : undefined;
                            const rows = [];
                            if (prev?.section !== l.section) {
                                rows.push(<tr key={`s:${String(l.section)}:${k}`} className="sec"><td colSpan={12}>{l.section}. {sectionTitle.get(l.section) ?? ''}</td></tr>);
                            }
                            rows.push(
                                <tr key={k}>
                                    <td>{l.itemNo ?? ''}</td>
                                    <td>{bt.line(l.key, l.desc)}</td>
                                    <td className="num">{l.net.source.kind === 'none' ? '' : tx.num(l.net.value)}</td>
                                    <td>{tx.unit(l.unit)}</td>
                                    <td className="num">{l.gross.value === null ? '' : tx.num(l.gross.value)}</td>
                                    <td className="num">{tx.num(l.mat.unit)}</td>
                                    <td className="num">{tx.num(l.mat.total)}</td>
                                    <td className="num">{tx.num(l.lab.unit)}</td>
                                    <td className="num">{tx.num(l.lab.total)}</td>
                                    <td className="num"><b>{tx.num(l.total)}</b></td>
                                    <td style={{ minWidth: '45mm' }}><LineSource expl={expl} line={l} tx={tx} /></td>
                                    <td style={{ minWidth: '45mm' }}><LineFormula expl={expl} line={l} tx={tx} /></td>
                                </tr>,
                            );
                            return rows;
                        })}
                    </tbody>
                </table>

                <h2>{tx.t('report.appendix')}</h2>
                {steps.map(s => <StepAppendix key={s.calc} s={s} tx={tx} locale={locale} />)}
            </div>
        </PrintFrame>
    );
}

export function BoqTraceReportPage() {
    const tx = useTraceText();
    const hasHydrated = useProjectStore(s => s.hasHydrated);
    const { enabled } = useDevMode();
    const [allowed, setAllowed] = useState<boolean | undefined>(undefined);
    useEffect(() => {
        let live = true;
        void loadDevModeAllowed().then(a => { if (live) setAllowed(a); });
        return () => { live = false; };
    }, []);
    if (allowed === undefined || !hasHydrated) return <div className="p-6"><Skeleton active /></div>;
    if (!allowed || !enabled) return <div className="p-4"><Alert type="info" showIcon title={tx.t('report.unavailable')} /></div>;
    return <Report />;
}
