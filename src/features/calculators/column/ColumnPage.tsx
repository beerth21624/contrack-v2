'use client';

import type { ReactNode } from 'react';
import {
    column, columnRowCalc, COLUMN_BAR_SIZES, COLUMN_NAMES, type ColumnRow,
} from '@/domain/calculators/column';
import { REBAR_SIZES } from '@/domain/boq/slots';
import { EditableTable } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { ColumnJourney } from './ColumnJourney';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center';
const td = 'border border-gray-200 px-2 py-1 text-[13px] text-right tabular-nums';

/** Column header with the sheet's group header (row 4) above the column label (row 7). */
const head = (group: string, label: string): ReactNode => (
    <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-normal text-gray-500">{group}</span>
        <span>{label}</span>
    </span>
);

const main = (t: CalcT) => t('common.mainReinforcement');
const stirrup = (t: CalcT) => t('common.stirrups');

const nameOptions = COLUMN_NAMES.map(v => ({ value: v }));
const sizeOptions = COLUMN_BAR_SIZES.map(v => ({ value: v }));

/** A new row keeps the previous row's height and bar settings; count and size start empty. */
const newColumn = (prev: ColumnRow | undefined): ColumnRow => ({
    name: '',
    count: 0,
    width: 0,
    depth: 0,
    height: prev?.height ?? 0,
    mainSize: prev?.mainSize ?? 'DB12',
    mainCount: prev?.mainCount ?? 0,
    stirrupSize: prev?.stirrupSize ?? 'RB6',
    stirrupSpacing: prev?.stirrupSpacing ?? 0,
});

export default function ColumnPage() {
    const t = useTranslations('calculators');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(column);
    const inJourney = useJourneyMode();

    if (inJourney) {
        return (
            <CalculatorShell def={column} result={result} isDefault={isDefault} onReset={reset}>
                <ColumnJourney input={input} outputs={outputs} onChange={columns => update({ columns })} />
            </CalculatorShell>
        );
    }

    return (
        <CalculatorShell def={column} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title={t('column.columnQuantitySummary')}>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={th} colSpan={REBAR_SIZES.length}>{t('common.mainReinforcementQuantityKg')}</th>
                                <th className={th} colSpan={REBAR_SIZES.length}>{t('common.stirrupQuantityKg')}</th>
                                <th className={th} rowSpan={2}>{t('common.formworkSqM')}</th>
                                <th className={th} rowSpan={2}>{t('common.structuralConcreteCuM')}</th>
                            </tr>
                            <tr>
                                {REBAR_SIZES.map(s => <th key={`m${s}`} className={th}>{s}</th>)}
                                {REBAR_SIZES.map(s => <th key={`s${s}`} className={th}>{s}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ background: SHEET_COLORS.calc }}>
                                {REBAR_SIZES.map(s => <td key={`m${s}`} className={td}>{formatNumber(outputs[`main.${s}`])}</td>)}
                                {REBAR_SIZES.map(s => <td key={`s${s}`} className={td}>{formatNumber(outputs[`stirrup.${s}`])}</td>)}
                                <td className={td}>{formatNumber(outputs.formwork)}</td>
                                <td className={td}>{formatNumber(outputs.concrete)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </SheetCard>

            <SheetCard title={t('column.columnData')}>
                <EditableTable<ColumnRow>
                    rows={input.columns}
                    onChange={columns => update({ columns })}
                    newRow={i => newColumn(input.columns[i - 1])}
                    addLabel={t('column.addColumn')}
                    columns={[
                        { kind: 'select', key: 'name', title: t('common.columnName'), width: 70, options: nameOptions,
                            get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
                        { kind: 'number', key: 'count', title: t('common.numberOfColumnsPcs'), width: 70, digits: 0,
                            get: r => r.count, set: (r, v) => ({ ...r, count: v }) },
                        { kind: 'number', key: 'width', title: t('common.widthM'), width: 70, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'depth', title: t('common.lengthM2'), width: 70, get: r => r.depth, set: (r, v) => ({ ...r, depth: v }) },
                        { kind: 'number', key: 'height', title: t('common.heightM'), width: 70, get: r => r.height, set: (r, v) => ({ ...r, height: v }) },
                        { kind: 'select', key: 'mainSize', title: head(main(t), t('common.size')), width: 80, options: sizeOptions,
                            get: r => r.mainSize, set: (r, v) => ({ ...r, mainSize: v }) },
                        { kind: 'number', key: 'mainCount', title: head(main(t), t('common.numberBars')), width: 70, digits: 0,
                            get: r => r.mainCount, set: (r, v) => ({ ...r, mainCount: v }) },
                        { kind: 'calc', key: 'mainBarLength', title: head(main(t), t('common.lengthBarM')), width: 80,
                            get: r => columnRowCalc(r).mainBarLength },
                        { kind: 'calc', key: 'mainTotalLength', title: head(main(t), t('common.totalLengthM')), width: 80,
                            get: r => columnRowCalc(r).mainTotalLength },
                        { kind: 'calc', key: 'mainWeight', title: head(main(t), t('common.weightKg')), width: 80,
                            get: r => columnRowCalc(r).mainWeight },
                        { kind: 'select', key: 'stirrupSize', title: head(stirrup(t), t('common.size')), width: 80, options: sizeOptions,
                            get: r => r.stirrupSize, set: (r, v) => ({ ...r, stirrupSize: v }) },
                        { kind: 'number', key: 'stirrupSpacing', title: head(stirrup(t), t('common.spacingM')), width: 70,
                            get: r => r.stirrupSpacing, set: (r, v) => ({ ...r, stirrupSpacing: v }) },
                        { kind: 'calc', key: 'stirrupCount', title: head(stirrup(t), t('common.numberStirrups')), width: 70, digits: 0,
                            get: r => columnRowCalc(r).stirrupCount },
                        { kind: 'calc', key: 'stirrupLength', title: head(stirrup(t), t('common.lengthBarM')), width: 80,
                            get: r => columnRowCalc(r).stirrupLength },
                        { kind: 'calc', key: 'stirrupTotalLength', title: head(stirrup(t), t('common.totalLengthM')), width: 80,
                            get: r => columnRowCalc(r).stirrupTotalLength },
                        { kind: 'calc', key: 'stirrupWeight', title: head(stirrup(t), t('common.weightKg')), width: 80,
                            get: r => columnRowCalc(r).stirrupWeight },
                        { kind: 'calc', key: 'formwork', title: t('common.formworkSqM'), width: 80, get: r => columnRowCalc(r).formwork },
                        { kind: 'calc', key: 'concrete', title: t('common.structuralConcreteCuM'), width: 90, get: r => columnRowCalc(r).concrete },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>{t('column.heightMIsTypedManually')}</li>
                    <li>{t('column.mainReinforcementLengthBarColumn')}</li>
                    <li>{t('column.stirrupsNumberRoundUpHeight')}</li>
                    <li>{t('column.formworkNumberOfColumns2')}</li>
                    <li>{t('column.columnReinforcementIsSentTo')}</li>
                </ul>
            </SheetCard>
        </CalculatorShell>
    );
}
