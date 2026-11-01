'use client';

// CashFLOW_Basic (Excel v5 sheet 04): quotation, installments (cash-in), S-Curve-weighted cost (cash-out),
// the cumulative cash position and the EVM dashboard.
import { Alert, Button, Tooltip } from 'antd';
import { EditableTable, type SheetColumn } from '@/components/sheet/EditableTable';
import { formatNumber } from '@/components/sheet/NumberCell';
import { CalcField, InputNumberField, SheetCard } from '@/components/sheet/SheetFields';
import { bucketIndexOf, isoToSerial, type CashFlowInput, type CashInstallmentInput } from '@/domain/planning';
import { CashFlowChart } from '../shared/charts';
import { usePlanningText } from '../usePlanningText';
import {
    DetailSection, NoBoqYet, PlanningHeader, StatTile, SummaryBanner, bucketLabel, bucketOptions, bucketRange, formatDate, money,
    usePlanning, usedBucketCount,
} from '../shared/planning-ui';
import { CashFlowDetailGrid } from './CashFlowDetailGrid';
import { EvmPanel } from './EvmPanel';

const NONE = 'none';

export function CashFlowPage() {
    const { planning, input, stored, setPlanning, result } = usePlanning();
    const { t: tr, locale, installment } = usePlanningText();
    const ci = input.cashflow;
    const cf = planning.cashflow;
    const sched = planning.schedule;
    const save = (next: CashFlowInput) => setPlanning({ cashflow: next });
    const saveInstallments = (installments: CashInstallmentInput[]) => save({ ...ci, installments });

    const min = cf.minCumulative;
    /** Lowest cumulative cash position when it is below zero (the peak funding need). */
    const neg = min !== null && min.value < 0 ? min : null;
    const minBucket = neg ? cf.buckets[neg.bucket] : undefined;
    const endCash = cf.cumulative.at(-1) ?? 0;
    const pctOff = Math.abs(cf.installmentPctTotal - 1) > 1e-9;
    const unplaced = ci.installments.filter(i => i.bucket === null).length;
    const count = usedBucketCount(cf.buckets, cf.incomeWeekly, cf.outflowWeekly);

    /** Week bucket in which the S-Curve งวด `no` finishes (the sample bills most งวด there). */
    const finishBucket = (no: number) => {
        const inst = sched.installments.find(x => x.no === no);
        const serial = isoToSerial(inst?.finish);
        return { inst, bucket: serial === null ? -1 : bucketIndexOf(cf.buckets, serial) };
    };

    const options = [{ value: NONE, label: tr('cashflow.unset') }, ...bucketOptions(cf.buckets, locale)];
    const columns: SheetColumn<CashInstallmentInput>[] = [
        { kind: 'text', key: 'label', title: tr('cashflow.installment'), width: 150, get: r => installment(r.label), set: (r, v) => ({ ...r, label: v }) },
        { kind: 'number', key: 'pct', title: tr('cashflow.share'), width: 84, percent: true, get: r => r.pct, set: (r, v) => ({ ...r, pct: v }) },
        {
            kind: 'select', key: 'bucket', title: tr('cashflow.billWeek'), width: 250, options,
            get: r => (r.bucket === null ? NONE : String(r.bucket)),
            set: (r, v) => ({ ...r, bucket: v === NONE ? null : Number(v) }),
        },
        { kind: 'calc', key: 'amount', title: tr('cashflow.amount'), width: 130, get: (_, i) => cf.installments[i]?.amount ?? null },
        {
            kind: 'label', key: 'hint', title: tr('cashflow.finishedAt'), width: 230,
            get: (r, i) => {
                if (i === 0) return <span className="text-[12px] text-gray-400">{tr('cashflow.depositNote')}</span>;
                const { inst, bucket } = finishBucket(i);
                if (!inst?.finish) return <span className="text-[12px] text-gray-400">–</span>;
                return (
                    <span className="text-[12px] text-gray-600 flex items-center gap-1 whitespace-nowrap">
                        {formatDate(inst.finish)} ({bucketLabel(cf.buckets[bucket], locale)})
                        {bucket >= 0 && bucket !== r.bucket && (
                            <Tooltip title={tr('cashflow.billWhenDone')}>
                                <Button size="small" type="link" className="!px-1"
                                    aria-label={tr('cashflow.billInAria', { label: installment(r.label), bucket: bucketLabel(cf.buckets[bucket], locale) })}
                                    onClick={() => saveInstallments(ci.installments.map((x, j) => (j === i ? { ...x, bucket } : x)))}>{tr('cashflow.use')}</Button>
                            </Tooltip>
                        )}
                    </span>
                );
            },
        },
    ];

    return (
        <div className="flex flex-col gap-4">
            <PlanningHeader current="/cashflow" title={tr('cashflow.title')} sheetName="CashFLOW_Basic"
                isDefault={stored.cashflow === undefined} onReset={() => setPlanning({ cashflow: undefined })} />
            <NoBoqYet constructionTotal={result.boq.constructionTotal} />

            <SummaryBanner headline={neg
                ? <>{tr('cashflow.lowest', { amount: money(-neg.value), bucket: bucketLabel(minBucket, locale), range: bucketRange(minBucket) })}</>
                : <>{tr('cashflow.neverNegative')}</>}>
                {neg && <span>{tr('cashflow.reserve', { amount: money(-neg.value) })}</span>}
                <span>
                    {tr.rich('cashflow.quotationLine', {
                        b: chunks => <b>{chunks}</b>,
                        quotation: money(cf.quotation), cost: money(cf.cost), factor: formatNumber(ci.quotationFactor, 2), end: money(endCash),
                    })}
                </span>
            </SummaryBanner>

            {(pctOff || unplaced > 0) && (
                <Alert type="warning" showIcon
                    title={[
                        pctOff ? tr('cashflow.pctOff', { pct: formatNumber(cf.installmentPctTotal * 100, 0) }) : null,
                        unplaced > 0 ? tr('cashflow.unplaced', { n: unplaced }) : null,
                    ].filter(Boolean).join(' · ')} />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <SheetCard title={tr('cashflow.priceCard')} className="h-full">
                    <CalcField label={tr('cashflow.cost')} value={cf.cost} unit={tr('unit.baht')} />
                    <InputNumberField label={tr('cashflow.factor')} value={ci.quotationFactor} unit={tr('cashflow.factorUnit')} onChange={v => save({ ...ci, quotationFactor: v })} />
                    <CalcField label={tr('cashflow.quotation')} value={cf.quotation} unit={tr('unit.baht')} strong />
                    <InputNumberField label={tr('cashflow.opex')} percent value={ci.operatingCostRate} unit={tr('cashflow.ofCost')}
                        onChange={v => save({ ...ci, operatingCostRate: v })} />
                    <InputNumberField label={tr('cashflow.profit')} percent value={ci.profitRate} unit={tr('cashflow.ofCost')} onChange={v => save({ ...ci, profitRate: v })} />
                    <div className="text-[12px] text-gray-500 mt-1">{tr('cashflow.noVat')}</div>
                </SheetCard>
                {/* The lowest cash point is the banner headline: not repeated as a tile. */}
                <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4 md:grid-rows-[auto_1fr]">
                    <StatTile label={tr('cashflow.totalIncome')} value={money(cf.totalIncome)} unit={tr('unit.baht')} />
                    <StatTile label={tr('cashflow.totalOutflow')} value={money(cf.totalOutflow)} unit={tr('unit.baht')} />
                    <StatTile label={tr('cashflow.planProfit')} value={money(cf.evm.profitPlan)} unit={tr('unit.baht')} tone="good" />
                    <div className="col-span-2 md:col-span-3">
                        <SheetCard title={tr('cashflow.chartCard')} className="h-full">
                            <CashFlowChart buckets={cf.buckets.slice(0, count)} income={cf.incomeWeekly.slice(0, count)}
                                outflow={cf.outflowWeekly.slice(0, count)} cumulative={cf.cumulative.slice(0, count)}
                                min={min && min.bucket < count ? min : null} />
                        </SheetCard>
                    </div>
                </div>
            </div>

            <SheetCard title={tr('cashflow.installmentsCard')}>
                <EditableTable rows={ci.installments} columns={columns} onChange={saveInstallments}
                    newRow={i => ({ label: tr('cashflow.installmentN', { n: i }), pct: 0, bucket: null })} addLabel={tr('cashflow.addInstallment')}
                    footer={(
                        <tr className="font-semibold bg-gray-50">
                            <td className="border border-gray-200 px-2 py-1 text-right text-[13px]" colSpan={2}>{tr('cashflow.total')}</td>
                            <td className={`border border-gray-200 px-2 py-1 text-right tabular-nums text-[13px] ${pctOff ? 'text-red-600' : ''}`}>
                                {formatNumber(cf.installmentPctTotal * 100, 0)}%
                            </td>
                            <td className="border border-gray-200" />
                            <td className="border border-gray-200 px-2 py-1 text-right tabular-nums text-[13px]">
                                {formatNumber(cf.installments.reduce((s, x) => s + x.amount, 0), 2)}
                            </td>
                            <td className="border border-gray-200" colSpan={2} />
                        </tr>
                    )} />
                <div className="text-[12px] text-gray-500 mt-2">
                    {tr('cashflow.installmentsNote')}
                </div>
            </SheetCard>

            <DetailSection label={tr('cashflow.evmSection')}
                extra={<span className="text-[12px] text-gray-500">SPI {formatNumber(cf.evm.spi, 3)} · CPI {formatNumber(cf.evm.cpi, 3)}</span>}>
                <EvmPanel cf={cf} input={ci} onChange={save} />
            </DetailSection>

            <DetailSection label={tr('cashflow.detailSection')}>
                <CashFlowDetailGrid cf={cf} opexRate={ci.operatingCostRate} profitRate={ci.profitRate} />
            </DetailSection>
        </div>
    );
}

export default CashFlowPage;
