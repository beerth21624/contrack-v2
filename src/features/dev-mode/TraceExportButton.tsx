'use client';

// ─── "Export the number sources as a spreadsheet" (dev mode, BOQ page) ───
// Sheets: BOQ lines (numbers, source, formula) · values used per step (with source) · calculation steps ·
// things to check · flagged values. Same text as the panels and the report (useTraceText); numbers are raw so the
// sheets can be filtered and sorted. Renders nothing unless dev mode is active.
import { useState } from 'react';
import { Button, message } from 'antd';
import { TableOutlined } from '@ant-design/icons';
import { useLocale } from 'next-intl';
import { calculatorsInOrder } from '@/domain/calculators/registry';
import { listReviewFlags } from '@/domain/review-flags';
import {
    explainProjectBoq, projectTraceBase, traceLabelSet, traceProjectCalculator,
    type BoqExplanation, type BoqLineExplanation,
} from '@/domain/trace';
import { useFormat } from '@/i18n/useFormat';
import { useProjectStore } from '@/store/project-store';
import { useBoqText } from '@/features/boq-home/useBoqText';
import { useDevMode } from './useDevMode';
import { flagTargetText } from './ReviewFlags';
import { downloadTraceWorkbook, type TraceSheet } from './trace-xlsx';
import { SOURCE_ICON, useTraceText, type TraceText } from './useTraceText';

function lineSourceText(tx: TraceText, expl: BoqExplanation, l: BoqLineExplanation): string {
    return [
        `${tx.t('explain.cell.qty')}: ${tx.netSource(expl, l.net.source)}${l.net.cleaned ? ` ⚠ ${tx.t('explain.cleaned')}` : ''}`,
        `${tx.t('explain.cell.waste')}: ${tx.t(`explain.waste.${l.waste.source}`)}`,
        `${tx.t('explain.cell.matUnit')}: ${tx.priceSource(expl, l.mat)}`,
        `${tx.t('explain.cell.labUnit')}: ${tx.priceSource(expl, l.lab)}`,
    ].join('\n');
}

function lineFormulaText(tx: TraceText, expl: BoqExplanation, l: BoqLineExplanation): string {
    return [
        tx.netNumbers(l) !== '' ? `${tx.t('explain.cell.qty')}: ${tx.netNumbers(l)}` : '',
        l.gross.rule.kind === 'none' ? '' : `${tx.grossRule(expl, l.gross.rule)}: ${tx.grossNumbers(l)}`,
        `${tx.t('explain.cell.matTotal')}: ${tx.priceTotalNumbers(l.mat)} (${tx.t(`explain.basis.${l.mat.basis}`)})`,
        `${tx.t('explain.cell.labTotal')}: ${tx.priceTotalNumbers(l.lab)} (${tx.t(`explain.basis.${l.lab.basis}`)})`,
        `${tx.t('explain.cell.total')}: ${tx.totalNumbers(l)}`,
    ].filter(p => p !== '').join('\n');
}

export function TraceExportButton() {
    const { active } = useDevMode();
    const tx = useTraceText();
    const bt = useBoqText();
    const fmt = useFormat();
    const locale = useLocale();
    const project = useProjectStore(s => s.project);
    const [busy, setBusy] = useState(false);
    const [msg, holder] = message.useMessage();
    if (!active) return null;

    const build = (): TraceSheet[] => {
        const base = projectTraceBase(project);
        const expl = explainProjectBoq(project, base);
        const sectionTitle = new Map(base.boq.sections.map(s => [s.no, bt.section(s.no, s.title)]));
        const c = tx.t;

        const lines: TraceSheet = {
            name: c('export.sheetLines'),
            columns: [
                { header: c('report.col.item'), width: 8 }, { header: c('report.col.desc'), width: 40 },
                { header: c('report.col.qty'), width: 12 }, { header: c('report.col.unit'), width: 8 },
                { header: c('report.col.gross'), width: 12 }, { header: c('report.col.matUnit'), width: 12 },
                { header: c('report.col.matTotal'), width: 14 }, { header: c('report.col.labUnit'), width: 12 },
                { header: c('report.col.labTotal'), width: 14 }, { header: c('report.col.total'), width: 14 },
                { header: c('report.col.source'), width: 50 }, { header: c('report.col.formula'), width: 50 },
                { header: c('export.col.section'), width: 24 },
            ],
            rows: expl.order.flatMap(k => {
                const l = expl.lines[k];
                if (!l) return [];
                return [[
                    l.itemNo ?? '', bt.line(l.key, l.desc), l.net.source.kind === 'none' ? '' : l.net.value, tx.unit(l.unit),
                    l.gross.value ?? '', l.mat.unit, l.mat.total, l.lab.unit, l.lab.total, l.total,
                    lineSourceText(tx, expl, l), lineFormulaText(tx, expl, l), `${String(l.section)}. ${sectionTitle.get(l.section) ?? ''}`,
                ]];
            }),
        };

        const inputs: TraceSheet = {
            name: c('export.sheetInputs'),
            columns: [
                { header: c('export.col.step'), width: 28 }, { header: c('export.col.group'), width: 18 },
                { header: c('trace.col.name'), width: 36 }, { header: c('trace.col.value'), width: 12 },
                { header: c('trace.col.unit'), width: 8 }, { header: c('trace.col.source'), width: 30 },
                { header: c('trace.col.defaultValue'), width: 14 },
            ],
            rows: [],
        };
        const steps: TraceSheet = {
            name: c('export.sheetSteps'),
            columns: [
                { header: c('export.col.step'), width: 28 }, { header: c('export.col.group'), width: 18 },
                { header: c('trace.col.step'), width: 30 }, { header: c('trace.col.formulaWords'), width: 50 },
                { header: c('trace.col.formulaNumbers'), width: 40 }, { header: c('trace.col.result'), width: 14 },
                { header: c('trace.col.unit'), width: 8 },
            ],
            rows: [],
        };
        const warnings: TraceSheet = {
            name: c('export.sheetWarnings'),
            columns: [{ header: c('export.col.step'), width: 30 }, { header: c('export.col.warning'), width: 90 }],
            rows: [],
        };

        for (const def of calculatorsInOrder()) {
            const trace = traceProjectCalculator(project, def.id, base);
            if (!trace) continue;
            const name = bt.calc(def);
            const labels = traceLabelSet(def.traceLabels, locale);
            tx.inputRows(trace, labels).forEach((r, i) => {
                const raw = trace.inputs[i]?.value;
                const source = r.source === 'dependency' && r.from !== undefined
                    ? `${SOURCE_ICON.dependency} ${tx.stepName(r.from)}` : `${SOURCE_ICON[r.source]} ${tx.t(`source.${r.source}`)}`;
                inputs.rows.push([name, r.group, r.name, typeof raw === 'number' ? raw : r.value, r.unit, source, r.defaultValue ?? '']);
            });
            tx.stepRows(trace, labels).forEach((r, i) => {
                steps.rows.push([name, r.group === '' ? tx.t('trace.totals') : r.group, r.label, r.words, r.numbers, trace.steps[i]?.value ?? '', r.unit]);
            });
            for (const w of trace.warnings) warnings.rows.push([name, tx.warningText(w)]);
        }
        for (const k of expl.order) {
            const l = expl.lines[k];
            if (l && (l.net.cleaned || l.mat.cleaned || l.lab.cleaned)) {
                warnings.rows.push([tx.lineText(l.itemNo, l.key, l.desc), tx.t('explain.cleaned')]);
            }
        }

        const flags: TraceSheet = {
            name: c('export.sheetFlags'),
            columns: [
                { header: c('export.col.flagTarget'), width: 50 }, { header: c('export.col.comment'), width: 60 },
                { header: c('export.col.by'), width: 20 }, { header: c('export.col.at'), width: 20 },
                { header: c('export.col.status'), width: 12 },
            ],
            rows: listReviewFlags(project.reviewFlags).map(({ flag }) => [
                flagTargetText(tx, expl, flag.target), flag.comment, flag.by, fmt.dateTime(flag.at),
                flag.status === 'open' ? tx.t('flag.statusOpen') : tx.t('flag.statusResolved'),
            ]),
        };
        return [lines, inputs, steps, warnings, flags];
    };

    const onClick = async () => {
        setBusy(true);
        try {
            const name = project.meta.projectName.trim();
            const file = `${tx.t('export.fileName')}${name === '' ? '' : `_${name}`}`.replace(/[\\/:*?"<>|]/g, '-');
            await downloadTraceWorkbook(build(), file);
        } catch (e) {
            console.error('trace export failed', e);
            void msg.error(tx.t('export.failed'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            {holder}
            <Button icon={<TableOutlined />} loading={busy} onClick={() => { void onClick(); }}>{tx.t('export.excel')}</Button>
        </>
    );
}
