'use client';

import {
    demolition, lineTotal, DEMOLITION_FIXED_ITEMS, type DemolitionInput, type DemolitionLine,
} from '@/domain/calculators/demolition';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { TextCell, formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, JText, PlanCard, PlanNumber, ResultSummary, isPositive, patchAt, planChecks, removeAt,
} from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

/** Rows 4–10 of the Excel sheet keep their fixed label / unit / hint; rows added after them are free text. */
const FIXED_ROWS = DEMOLITION_FIXED_ITEMS.length;
const newLine = (): DemolitionLine => ({ label: '', unit: '', qty: 0, rate: 0, check: '' });

export default function DemolitionPage() {
    const t = useTranslations('calculators');
    const calc = useCalculator(demolition);
    const inJourney = useJourneyMode();
    const { input, update, reset, outputs, result, isDefault } = calc;

    const setText = (i: number, patch: Partial<DemolitionLine>) =>
        update(p => ({ ...p, items: p.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

    /** Fixed Excel rows show their text as a label; added rows get a text input. */
    function cell(field: 'label' | 'unit' | 'check', placeholder: string, r: DemolitionLine, i: number) {
        if (i < FIXED_ROWS) return r[field];
        return <TextCell value={r[field]} placeholder={placeholder} onCommit={v => setText(i, { [field]: v ?? '' })} />;
    }

    return (
        <CalculatorShell def={demolition} result={result} isDefault={isDefault} onReset={reset}>
            {inJourney ? <JourneyView calc={calc} /> : (
                <SheetCard title={t('demolition.demolitionItems')}>
                    <EditableTable<DemolitionLine>
                        rows={input.items}
                        onChange={items => update({ items })}
                        lockedRows={FIXED_ROWS}
                        newRow={newLine}
                        addLabel={t('common.addItem')}
                        columns={[
                            { kind: 'label', key: 'label', title: t('common.item'), get: (r, i) => cell('label', t('common.itemName'), r, i) },
                            { kind: 'label', key: 'unit', title: t('common.unit'), width: 80, get: (r, i) => cell('unit', t('common.unit'), r, i) },
                            { kind: 'number', key: 'qty', title: t('common.quantity'), width: 100, get: r => r.qty, set: (r, v) => ({ ...r, qty: v }) },
                            { kind: 'number', key: 'rate', title: t('demolition.demolitionCostPerUnit'), width: 110, get: r => r.rate, set: (r, v) => ({ ...r, rate: v }) },
                            { kind: 'calc', key: 'total', title: t('common.total'), width: 120, get: r => lineTotal(r) },
                            {
                                kind: 'label', key: 'check', title: t('demolition.detailsToCheck'), width: 200,
                                get: (r, i) => cell('check', t('demolition.details'), r, i),
                            },
                        ]}
                    />
                    <div className="mt-3 max-w-md ml-auto">
                        <CalcField label={t('common.grandTotal')} value={outputs.total} unit={t('common.baht')} strong />
                    </div>
                    <p className="mt-2 text-[12px] text-gray-500 italic">
                        {t('demolition.rateLabourBasicToolsInitial')}
                    </p>
                    <p className="mt-1 text-[12px] text-gray-500">
                        {(outputs.total ?? 0) > 0
                            ? <>{t('demolition.amount')}{formatNumber(outputs.total)} {t('demolition.bahtSentToTheBoq')}</>
                            : <>{t('demolition.noDemolitionItemsYetThe')}</>}
                    </p>
                </SheetCard>
            )}
        </CalculatorShell>
    );
}

/** A demolition kind is "on site" once it has a quantity or a rate; it costs something once it has both. */
const lineChecks = (t: CalcT, l: DemolitionLine) => planChecks([
    { label: t('common.quantity'), ok: isPositive(l.qty) },
    { label: t('demolition.demolitionCostPerUnit'), ok: isPositive(l.rate) },
]);

/**
 * Guided journey: the kinds of demolition listed as cards, the user fills only the ones on site (a kind left
 * empty stays grey). Excel has no rates, so the per-unit price stays on each card (hiding it would leave the
 * level at 0 บาท); a quantity without a rate is flagged.
 */
function JourneyView({ calc }: { calc: UseCalculator<DemolitionInput> }) {
    const t = useTranslations('calculators');
    const { input, update, outputs } = calc;
    const total = outputs.total ?? 0;
    const setLine = (i: number, patch: Partial<DemolitionLine>) => update(p => ({ ...p, items: patchAt(p.items, i, patch) }));
    const checks = input.items.map(l => lineChecks(t, l));
    return (
        <>
            <SheetCard title={t('demolition.demolitionWorkOnTheLand')}>
                <p className="mb-3 text-[12px] text-gray-500">
                    {t('demolition.fillInOnlyTheWork')}
                </p>
                <div className="flex flex-col gap-2">
                    {input.items.map((r, i) => {
                        const k = checks[i] ?? lineChecks(t, r);
                        const fixed = i < FIXED_ROWS;
                        const unit = r.unit === '' ? t('common.unit') : r.unit;
                        return (
                            <PlanCard key={i} index={i + 1} state={k.state} hasData={k.hasData} compact scope={{ listKey: 'items', itemIndex: i }}
                                missingText={k.missingText === undefined ? undefined
                                    : t('demolition.missingtextThisItemStillCounts', { missingText: k.missingText })}
                                title={fixed
                                    ? <>{r.label}{r.check !== '' && <span className="ml-2 text-[12px] font-normal text-gray-500">{t('demolition.see')}{r.check}</span>}</>
                                    : (r.label === '' ? t('demolition.otherDemolitionWork') : r.label)}
                                result={isPositive(lineTotal(r)) ? t('demolition.totalVBaht', { v: formatNumber(lineTotal(r), 0) }) : undefined}
                                onDelete={fixed ? undefined : () => update(p => ({ ...p, items: removeAt(p.items, i) }))}
                                deleteTitle={r.label === '' ? t('demolition.deleteThisItem') : t('demolition.deleteLabel', { label: r.label })}>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                                    {!fixed && (
                                        <>
                                            <JText label={t('demolition.workName')} value={r.label} placeholder={t('demolition.eGDemolishTheOld')} onChange={v => setLine(i, { label: v })} />
                                            <JText label={t('common.unit')} value={r.unit} placeholder={t('demolition.eGSqM')} onChange={v => setLine(i, { unit: v })} />
                                        </>
                                    )}
                                    <PlanNumber label={t('common.quantity')} value={r.qty} unit={unit}
                                        onChange={v => setLine(i, { qty: v })} />
                                    <PlanNumber label={t('demolition.demolitionCostPerUnit')} value={r.rate} unit={t('demolition.bahtUnit', { unit })} digits={0} fieldKey="rate"
                                        onChange={v => setLine(i, { rate: v })} />
                                </div>
                            </PlanCard>
                        );
                    })}
                </div>
                <div className="mt-3">
                    <AddButton label={t('demolition.addOtherDemolitionWork')} onClick={() => update(p => ({ ...p, items: [...p.items, newLine()] }))} />
                </div>
            </SheetCard>

            {/* The money is มูลค่าขั้นตอนนี้ in the bottom bar; here only what is counted. */}
            <ResultSummary
                items={total > 0 ? [{
                    label: t('demolition.demolitionWork'), value: input.items.filter(r => isPositive(lineTotal(r))).length, unit: t('common.item'), digits: 0,
                    detail: t('demolition.combinedAs1LumpSum'),
                }] : []}
                empty={<>{t('demolition.noDemolitionWorkYetIf')}</>} />
        </>
    );
}
