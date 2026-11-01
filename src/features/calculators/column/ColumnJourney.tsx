'use client';

// Journey-mode body of the column level: one card per column type (C1, C2 …) read off the column plan and
// detail, the formulas folded away, and a short result at the end. Same input and formulas as /calc.
import {
    columnRowCalc, COLUMN_BAR_SIZES, COLUMN_NAMES, newColumnRow, type ColumnInput, type ColumnRow,
} from '@/domain/calculators/column';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import {
    AddButton, BarField, ChoiceButtons, EmptyState, PlanCard, PlanField, PlanGroup, PlanNumber, ResultSummary, insertAfter,
    isPositive, nextFreeName, planChecks, rebarSummaryItem, removeAt, resultText,
} from '@/components/sheet/journey';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const nameOptions = COLUMN_NAMES.map(v => ({ value: v as string, label: v }));
const label = (t: CalcT, r: ColumnRow, i: number) => (r.name === '' ? t('common.typeV', { v: i + 1 }) : r.name);

const labelsOf = (t: CalcT) => ({
    count: t('common.numberOfColumns'), width: t('common.width2'), depth: t('common.length'), height: t('column.columnHeight'), main: t('common.verticalBars'), stirrup: t('common.stirrups'),
}) as const;
type Labels = ReturnType<typeof labelsOf>;

const checksOf = (L: Labels, r: ColumnRow) => planChecks([
    { label: L.count, ok: isPositive(r.count) },
    { label: L.width, ok: isPositive(r.width) },
    { label: L.depth, ok: isPositive(r.depth) },
    { label: L.height, ok: isPositive(r.height) },
    { label: L.main, ok: isPositive(r.mainCount) && r.mainSize !== '' },
    { label: L.stirrup, ok: isPositive(r.stirrupSpacing) && r.stirrupSize !== '' },
// Height and bars may be copied from the previous column: the count or the size marks a column as started.
], [r.count, r.width, r.depth].some(isPositive));

export function ColumnJourney({ input, outputs, onChange }: {
    input: ColumnInput; outputs: Record<string, number>; onChange: (columns: ColumnRow[]) => void;
}) {
    const t = useTranslations('calculators');
    const L = labelsOf(t);
    const rows = input.columns;
    const set = (i: number, patch: Partial<ColumnRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const freeName = () => nextFreeName(COLUMN_NAMES, rows.map(r => r.name));
    const add = () => onChange([...rows, { ...newColumnRow(rows[rows.length - 1]), name: freeName() }]);
    /** Same size, height and bars; the count to fill. */
    const duplicate = (r: ColumnRow, i: number) => onChange(insertAfter(rows, i, { ...r, name: freeName(), count: 0 }));

    if (rows.length === 0) {
        return (
            <EmptyState text={t('column.noColumnsYetCheckThe')}
                addLabel={t('column.addColumnC1')} onAdd={add} />
        );
    }

    const nextName = freeName();

    return (
        <div className="flex flex-col gap-4">
            {rows.map((r, i) => {
                const c = columnRowCalc(r);
                const k = checksOf(L, r);
                return (
                    <PlanCard key={i} index={i + 1} scope={{ listKey: 'columns', itemIndex: i }} state={k.state} hasData={k.hasData} missingText={k.missingText}
                        title={t('column.columnV', { v: label(t, r, i) })}
                        result={k.state === 'empty' ? undefined : resultText([
                            { label: t('common.concrete'), value: c.concrete, unit: t('common.cuM') },
                            { label: t('common.steel'), value: c.mainWeight + c.stirrupWeight, unit: t('common.kg'), digits: 1 },
                        ])}
                        onDuplicate={() => duplicate(r, i)}
                        onDelete={() => onChange(removeAt(rows, i))} deleteTitle={t('column.deleteColumnV', { v: label(t, r, i) })}>
                        <PlanGroup title={t('column.fromTheColumnPlan')}>
                            <PlanField label={t('common.columnName')}>
                                <ChoiceButtons<string> size="small" ariaLabel={t('common.columnName')} value={r.name === '' ? undefined : r.name}
                                    options={nameOptions} onChange={v => set(i, { name: v })} />
                            </PlanField>
                            <PlanNumber label={L.count} fieldKey="count" value={r.count} unit={t('common.pcs')} digits={0} onChange={v => set(i, { count: v })} />
                        </PlanGroup>
                        <PlanGroup title={t('column.columnSizeFromTheColumn')}>
                            <PlanNumber label={L.width} fieldKey="width" value={r.width} unit={t('common.m')} range={[0.1, 1.5]} onChange={v => set(i, { width: v })} />
                            <PlanNumber label={L.depth} fieldKey="depth" value={r.depth} unit={t('common.m')} range={[0.1, 1.5]} onChange={v => set(i, { depth: v })} />
                            <PlanNumber label={L.height} fieldKey="height" value={r.height} unit={t('common.m')} range={[1, 12]} placeholder={t('column.eG0553')}
                                hint={t('column.fromTheTopOfThe')} onChange={v => set(i, { height: v })} />
                        </PlanGroup>
                        <PlanGroup title={t('common.reinforcementPerColumn')} hint={t('column.eG6Db12Stirrups')} layout="wide">
                            <BarField label={L.main} sizes={COLUMN_BAR_SIZES} size={r.mainSize} onSize={v => set(i, { mainSize: v })}
                                amount={r.mainCount} onAmount={v => set(i, { mainCount: v })} />
                            <BarField label={L.stirrup} sizes={COLUMN_BAR_SIZES} size={r.stirrupSize} onSize={v => set(i, { stirrupSize: v })}
                                amount={r.stirrupSpacing} onAmount={v => set(i, { stirrupSpacing: v })} amountLabel={t('common.spacing')}
                                amountUnit={t('common.m')} amountDigits={2} presets={[0.15, 0.2]} range={[0.05, 0.5]} />
                        </PlanGroup>
                    </PlanCard>
                );
            })}

            <AddButton label={nextName === '' ? t('column.addAnotherColumnType') : t('column.addColumnNextname', { nextName })} onClick={add} />

            <AdvancedSection title={t('common.howItIsCalculated')} hint={t('common.calculatedAutomatically')}>
                <ul className="list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>{t('column.concreteNumberOfColumnsWidth')}</li>
                    <li>{t('column.verticalBarsNumberOfColumns')}</li>
                    <li>{t('column.stirrupsRoundUpHeightSpacing')}</li>
                    <li>{t('column.columnReinforcementIsCountedIn')}</li>
                </ul>
            </AdvancedSection>

            <ResultSummary items={[
                { label: t('common.concrete'), value: outputs.concrete ?? 0, unit: t('common.cuM') },
                { label: t('common.formwork'), value: outputs.formwork ?? 0, unit: t('common.sqM') },
                rebarSummaryItem(outputs),
            ]} />
        </div>
    );
}
