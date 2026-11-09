'use client';

// ─── Text of the dev-mode screens: names of steps, lines and terms, input rows, step rows, BOQ cell sources ───
// Shared by the step trace panel, the BOQ "explain this cell" drawer and the printed trace report, so all three
// say the same thing. Never shows line keys or anything from the spreadsheet: lines are named by item no + description.
import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getCalculator } from '@/domain/calculators/registry';
import {
    renderStep, termLabel, termUnit, traceLabelSet,
    type BoqExplanation, type BoqGrossExplanation, type BoqLineExplanation, type BoqNetSource, type BoqPriceExplanation,
    type CalcTrace, type TraceInput, type TraceLabelSet, type TraceSourceKind, type TraceWarning,
} from '@/domain/trace';
import { useFormat } from '@/i18n/useFormat';
import { useBoqText } from '@/features/boq-home/useBoqText';

/** Symbol of each input source (✎ user · ⚠ hard-coded default · 🔒 hard-coded constant · ← another step). */
export const SOURCE_ICON: Record<TraceSourceKind, string> = { user: '✎', default: '⚠', constant: '🔒', dependency: '←' };

export interface InputRow {
    path: string;
    /** Row the input belongs to ('' outside rows). */
    group: string;
    name: string;
    value: string;
    unit: string;
    source: TraceSourceKind;
    /** For ← : the step it comes from. */
    from?: string;
    /** For ⚠ / ✎ : the hard-coded value at this field. */
    defaultValue?: string;
}

export interface StepRow {
    key: string;
    /** Row label ('' for totals). */
    group: string;
    label: string;
    words: string;
    numbers: string;
    value: string;
    unit: string;
}

/** Link to a step's page. */
export const stepHref = (calc: string): string => `/calc/${encodeURIComponent(calc)}`;
/** Link to a BOQ line on the BOQ page (highlighted on arrival). */
export const boqLineHref = (line: string): string => `/boq?line=${encodeURIComponent(line)}`;

export function useTraceText() {
    const t = useTranslations('devMode');
    const locale = useLocale();
    const fmt = useFormat();
    const bt = useBoqText();
    return useMemo(() => {
        const num = (v: number): string => (Number.isFinite(v) ? fmt.number(v, { max: 4 }) : String(v));
        const value = (v: number | string | boolean): string => (typeof v === 'number' ? num(v) : String(v));
        const stepName = (calc: string): string => {
            const def = getCalculator(calc);
            return def ? bt.calc(def) : calc;
        };
        const labelsOf = (calc: string): TraceLabelSet | undefined => traceLabelSet(getCalculator(calc)?.traceLabels, locale);
        const outputName = (calc: string, output: string): string => termLabel(labelsOf(calc), output);
        const lineText = (itemNo: string | undefined, key: string, desc: string): string =>
            [itemNo, bt.line(key, desc)].filter(x => x !== undefined && x !== '').join(' ');
        const fieldName = (f: 'qty' | 'mat' | 'lab'): string => t(`trace.field.${f}`);

        /** Row label of every row index that has steps (the name the calculator gave it). */
        const rowLabels = (trace: CalcTrace): Map<number, string> => {
            const m = new Map<number, string>();
            for (const s of trace.steps) if (s.row !== undefined && s.rowLabel !== undefined && !m.has(s.row)) m.set(s.row, s.rowLabel);
            return m;
        };
        const groupOf = (row: number | undefined, labels: Map<number, string>): string =>
            row === undefined ? '' : labels.get(row) ?? t('trace.rowLabel', { row: row + 1 });

        const inputRows = (trace: CalcTrace, labels: TraceLabelSet | undefined): InputRow[] => {
            const rl = rowLabels(trace);
            return trace.inputs.map((i: TraceInput) => {
                const fromLabels = i.from ? labelsOf(i.from.calc) : labels;
                const r: InputRow = {
                    path: i.path,
                    group: groupOf(i.row, rl),
                    name: termLabel(fromLabels, i.term, i.params),
                    value: value(i.value),
                    unit: termUnit(fromLabels, i.term),
                    source: i.source,
                };
                if (i.from) r.from = i.from.calc;
                if (i.defaultValue !== undefined && i.source === 'user') r.defaultValue = value(i.defaultValue);
                return r;
            });
        };

        const stepRows = (trace: CalcTrace, labels: TraceLabelSet | undefined): StepRow[] => {
            const rl = rowLabels(trace);
            return trace.steps.map(s => {
                const r = renderStep(labels, s, num);
                return { key: s.key, group: groupOf(s.row, rl), label: r.label, words: r.words, numbers: r.numbers, value: num(s.value), unit: r.unit };
            });
        };

        const warningText = (w: TraceWarning): string => {
            switch (w.kind) {
                case 'defaultsInUse': return t('warning.defaultsInUse', { count: w.paths.length });
                case 'dependencyMissing': return t('warning.dependencyMissing', { step: stepName(w.calc) });
                case 'invalidInput': return t('warning.invalidInput', { count: w.paths.length });
                case 'invalidOutput': return t('warning.invalidOutput', { count: w.outputs.length });
                case 'boqOverride': return t('warning.boqOverride', { item: w.itemNo ?? '', desc: bt.line(w.line, w.desc), field: fieldName(w.field) });
                case 'skipped': return t('warning.skipped');
            }
        };

        // ── BOQ cells ──
        const refName = (expl: BoqExplanation, key: string): string => {
            const l = expl.lines[key];
            return l ? lineText(l.itemNo, l.key, l.desc) : t('explain.unknownLine');
        };
        const refList = (expl: BoqExplanation, refs: readonly { line: string }[]): string => refs.map(r => refName(expl, r.line)).join(', ');

        const netSource = (expl: BoqExplanation, src: BoqNetSource): string => {
            switch (src.kind) {
                case 'override': return t('explain.net.override');
                case 'calc': return src.calc !== undefined && src.output !== undefined
                    ? t('explain.net.calc', { output: outputName(src.calc, src.output), step: stepName(src.calc) })
                    : t('explain.net.calcUnknown');
                case 'skipped': return t('explain.net.skipped');
                case 'slot': return t('explain.net.slot', { step: stepName(src.calc) });
                case 'template': return t('explain.net.template');
                case 'line': return t('explain.net.line', { line: refName(expl, src.ref), factor: num(src.factor) });
                case 'sumLines': return t('explain.net.sumLines', { lines: refList(expl, src.refs) });
                case 'none': return t('explain.net.none');
            }
        };
        /** The net quantity with numbers ('' when there is nothing to substitute). */
        const netNumbers = (l: BoqLineExplanation): string => {
            const s = l.net.source;
            if (s.kind === 'line') return `${num(s.refValue)} × ${num(s.factor)} = ${num(l.net.value)}`;
            if (s.kind === 'sumLines') return `${s.refs.map(r => num(r.value)).join(' + ') || '0'} = ${num(l.net.value)}`;
            return '';
        };

        const grossRule = (expl: BoqExplanation, g: BoqGrossExplanation): string =>
            g.kind === 'tieWire'
                ? t('explain.gross.tieWire', { lines: refList(expl, g.refs), ratio: num(g.ratio) })
                : t(`explain.gross.${g.kind}`);
        const grossNumbers = (l: BoqLineExplanation): string => {
            const g = l.gross.rule;
            const out = l.gross.value === null ? '–' : num(l.gross.value);
            switch (g.kind) {
                case 'none': return '';
                case 'std': return `${num(g.net)} × (1 + ${num(g.waste)}) = ${out}`;
                case 'ceilInt':
                case 'concrete': return `${num(g.net)} × (1 + ${num(g.waste)}) = ${num(g.unrounded)} → ${out}`;
                case 'tieWire': return `(${g.refs.map(r => num(r.value)).join(' + ') || '0'}) × ${num(g.ratio)} = ${out}`;
            }
        };

        const priceSource = (expl: BoqExplanation, p: BoqPriceExplanation): string => {
            const s = p.source;
            switch (s.kind) {
                case 'override': return t('explain.price.override');
                case 'calc': return s.calc !== undefined && s.output !== undefined
                    ? t('explain.price.calc', { output: outputName(s.calc, s.output), step: stepName(s.calc) })
                    : t('explain.price.calcUnknown');
                case 'slot': return t('explain.price.slot', { step: stepName(s.calc) });
                case 'template': return t('explain.price.template');
                case 'linePrice': return t('explain.price.linePrice', { line: refName(expl, s.ref), factor: num(s.factor) });
                case 'consumables': return t('explain.price.consumables', { pct: num(s.pct), lines: refList(expl, s.refs) });
            }
        };
        const priceUnitNumbers = (p: BoqPriceExplanation): string => {
            const s = p.source;
            if (s.kind === 'linePrice') return `${num(s.refValue)} × ${num(s.factor)} = ${num(p.unit)}`;
            if (s.kind === 'consumables') return `(${s.refs.map(r => num(r.value)).join(' + ') || '0'}) × ${num(s.pct)}% = ${num(p.unit)}`;
            return '';
        };
        const priceTotalRule = (name: string, p: BoqPriceExplanation): string =>
            t('explain.priceTotal', { name, basis: t(`explain.basis.${p.basis}`) });
        const priceTotalNumbers = (p: BoqPriceExplanation): string => `${num(p.unit)} × ${num(p.basisValue)} = ${num(p.total)}`;
        const totalNumbers = (l: BoqLineExplanation): string => `${num(l.mat.total)} + ${num(l.lab.total)} = ${num(l.total)}`;
        /** Calculation step behind a cell, for the "open step" link. */
        const stepOfNet = (s: BoqNetSource): string | undefined =>
            s.kind === 'calc' || s.kind === 'skipped' ? s.calc : s.kind === 'slot' ? s.calc : undefined;
        const stepOfPrice = (p: BoqPriceExplanation): string | undefined =>
            p.source.kind === 'calc' ? p.source.calc : p.source.kind === 'slot' ? p.source.calc : undefined;

        return {
            t, num, value, unit: bt.unit, stepName, outputName, lineText, fieldName, labelsOf, inputRows, stepRows, warningText,
            refName, netSource, netNumbers, grossRule, grossNumbers, priceSource, priceUnitNumbers, priceTotalRule,
            priceTotalNumbers, totalNumbers, stepOfNet, stepOfPrice,
        };
    }, [t, locale, fmt, bt]);
}

export type TraceText = ReturnType<typeof useTraceText>;
