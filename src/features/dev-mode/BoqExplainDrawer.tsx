'use client';

// ─── "Explain this cell" (dev mode, BOQ page): every number of one BOQ line with where it comes from ───
// All numbers are computeBoq's (via explainBoq); the picked cell is highlighted. Links go back to the step, or to the
// line a value is derived from (which then opens in this drawer).
import { useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { Button, Drawer } from 'antd';
import type { BoqCellField, BoqExplanation, BoqLineExplanation } from '@/domain/trace';
import { stepHref, useTraceText, type TraceText } from './useTraceText';

export interface ExplainTarget { line: string; field: BoqCellField }

function Cell({ field, active, title, value, rule, numbers, source, extra }: {
    field: BoqCellField; active: boolean; title: string; value: string;
    rule?: string; numbers?: string; source?: string; extra?: ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => { if (active) ref.current?.scrollIntoView({ block: 'nearest' }); }, [active]);
    return (
        <div ref={ref} data-explain-cell={field}
            className={`rounded-lg border px-3 py-2 ${active ? 'border-orange-400 bg-orange-50 shadow-[0_0_0_2px_#fdba74]' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-semibold text-gray-800">{title}</span>
                <span className="text-[15px] font-semibold tabular-nums text-gray-900">{value}</span>
            </div>
            {rule !== undefined && rule !== '' && <div className="text-[12px] text-gray-700 mt-1">{rule}</div>}
            {numbers !== undefined && numbers !== '' && <div className="text-[12px] text-gray-600 tabular-nums mt-0.5">{numbers}</div>}
            {source !== undefined && source !== '' && <div className="text-[12px] text-blue-800 mt-1">{source}</div>}
            {extra}
        </div>
    );
}

/** Buttons to the lines a value is derived from (open them here) and to the step behind it. */
function Refs({ expl, refs, step, tx, onLine }: {
    expl: BoqExplanation; refs: string[]; step: string | undefined; tx: TraceText; onLine: (line: string) => void;
}) {
    if (refs.length === 0 && step === undefined) return null;
    return (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[12px]">
            {step !== undefined && (
                <Link href={stepHref(step)} className="text-green-700 hover:underline">{tx.t('explain.goToStep', { step: tx.stepName(step) })}</Link>
            )}
            {refs.map(r => (
                <button key={r} type="button" className="text-blue-600 hover:underline bg-transparent border-0 p-0 cursor-pointer text-left"
                    onClick={() => onLine(r)}>
                    {tx.t('explain.goToLine', { item: tx.refName(expl, r) })}
                </button>
            ))}
        </div>
    );
}

function LineBody({ expl, line: l, field, tx, onLine }: {
    expl: BoqExplanation; line: BoqLineExplanation; field: BoqCellField; tx: TraceText; onLine: (line: string) => void;
}) {
    const n = (v: number | null): string => (v === null ? '–' : tx.num(v));
    const netRefs = l.net.source.kind === 'line' ? [l.net.source.ref] : l.net.source.kind === 'sumLines' ? l.net.source.refs.map(r => r.line) : [];
    const grossRefs = l.gross.rule.kind === 'tieWire' ? l.gross.rule.refs.map(r => r.line) : [];
    const priceRefs = (p: BoqLineExplanation['mat']): string[] =>
        p.source.kind === 'linePrice' ? [p.source.ref] : p.source.kind === 'consumables' ? p.source.refs.map(r => r.line) : [];
    const cleaned = (on: boolean) => (on ? <div className="text-[12px] text-amber-700 mt-1">⚠ {tx.t('explain.cleaned')}</div> : null);
    const price = (kind: 'mat' | 'lab') => {
        const p = l[kind];
        const unitField: BoqCellField = kind === 'mat' ? 'matUnit' : 'labUnit';
        const totalField: BoqCellField = kind === 'mat' ? 'matTotal' : 'labTotal';
        const totalName = tx.t(`explain.cell.${totalField}`);
        return [
            <Cell key={unitField} field={unitField} active={field === unitField} title={tx.t(`explain.cell.${unitField}`)} value={n(p.unit)}
                source={`${tx.t('explain.sourceLabel')}: ${tx.priceSource(expl, p)}`} numbers={tx.priceUnitNumbers(p)}
                extra={<>{cleaned(p.cleaned)}<Refs expl={expl} refs={priceRefs(p)} step={tx.stepOfPrice(p)} tx={tx} onLine={onLine} /></>} />,
            <Cell key={totalField} field={totalField} active={field === totalField} title={totalName} value={n(p.total)}
                rule={tx.priceTotalRule(totalName, p)} numbers={tx.priceTotalNumbers(p)} />,
        ];
    };
    return (
        <div className="flex flex-col gap-2">
            <Cell field="qty" active={field === 'qty'} title={tx.t('explain.cell.qty')} value={`${n(l.net.source.kind === 'none' ? null : l.net.value)} ${tx.unit(l.unit)}`}
                source={`${tx.t('explain.sourceLabel')}: ${tx.netSource(expl, l.net.source)}`} numbers={tx.netNumbers(l)}
                extra={<>{cleaned(l.net.cleaned)}<Refs expl={expl} refs={netRefs} step={tx.stepOfNet(l.net.source)} tx={tx} onLine={onLine} /></>} />
            <Cell field="waste" active={field === 'waste'} title={tx.t('explain.cell.waste')} value={`${tx.num(l.waste.value * 100)}%`}
                source={`${tx.t('explain.sourceLabel')}: ${tx.t(`explain.waste.${l.waste.source}`)}`} />
            <Cell field="gross" active={field === 'gross'} title={tx.t('explain.cell.gross')} value={n(l.gross.value)}
                rule={tx.grossRule(expl, l.gross.rule)} numbers={tx.grossNumbers(l)}
                extra={<Refs expl={expl} refs={grossRefs} step={undefined} tx={tx} onLine={onLine} />} />
            {price('mat')}
            {price('lab')}
            <Cell field="total" active={field === 'total'} title={tx.t('explain.cell.total')} value={tx.num(l.total)}
                rule={tx.t('explain.total')} numbers={tx.totalNumbers(l)} />
        </div>
    );
}

export function BoqExplainDrawer({ expl, target, onClose, onLine }: {
    expl: BoqExplanation | undefined;
    target: ExplainTarget | null;
    onClose: () => void;
    /** Open another line (a line this one is derived from). */
    onLine: (line: string) => void;
}) {
    const tx = useTraceText();
    const line = target && expl ? expl.lines[target.line] : undefined;
    return (
        <Drawer open={line !== undefined} onClose={onClose} size="min(520px, 100vw)" destroyOnHidden mask={false}
            title={line ? (
                <div className="min-w-0">
                    <div className="text-[12px] font-normal text-gray-500">{tx.t('explain.title')}</div>
                    <div className="text-[14px] [overflow-wrap:anywhere]">{tx.lineText(line.itemNo, line.key, line.desc)}</div>
                </div>
            ) : tx.t('explain.title')}
            footer={<Button onClick={onClose}>{tx.t('explain.close')}</Button>}>
            {line && expl && target && <LineBody expl={expl} line={line} field={target.field} tx={tx} onLine={onLine} />}
        </Drawer>
    );
}
