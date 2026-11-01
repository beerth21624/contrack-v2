'use client';

import type { ReactNode } from 'react';
import {
    precastSlab, precastPanel, precastSlabTotals, PS_BAR_SIZES, type PrecastPanelRow,
} from '@/domain/calculators/precast-slab';
import { REBAR_SIZES } from '@/domain/boq/slots';
import type { BoqItemRow } from '@/domain/boq/types';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { PrecastSlabJourney } from './PrecastSlabJourney';
import { useTranslations } from 'next-intl';

/** Column title with the Excel group header (row 3/4) above the column header (row 7). */
const head = (group: string, title: string): ReactNode => (
    <>
        <div className="text-[10px] font-normal text-gray-500 leading-tight">{group}</div>
        <div>{title}</div>
    </>
);

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center';
const td = 'border border-gray-200 px-2 py-1 text-[13px] text-right tabular-nums';

export default function PrecastSlabPage() {
    const t = useTranslations('calculators');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(precastSlab);
    const inJourney = useJourneyMode();
    if (inJourney) {
        return (
            <CalculatorShell def={precastSlab} result={result} isDefault={isDefault} onReset={reset}>
                <PrecastSlabJourney input={input} outputs={outputs} onChange={panels => update({ panels })} />
            </CalculatorShell>
        );
    }
    const totals = precastSlabTotals(input);
    const shearKeyRows = result.boq.sections.flatMap(s => s.rows)
        .filter((r): r is BoqItemRow => r.type === 'item' && r.key.startsWith('precast-slab:shear-key:'));

    const newRow = (): PrecastPanelRow => {
        const last = input.panels[input.panels.length - 1];
        return last
            ? { ...last, width: 0, length: 0 }
            : { width: 0, length: 0, keySize: 'RB6', keySpacing: 0.35, keyBarLength: 0.8, topping: 0.05 };
    };

    return (
        <CalculatorShell def={precastSlab} result={result} isDefault={isDefault} onReset={reset}
            aside={(
                <SheetCard title={t('precastSlab.sentToBoqSection8')}>
                    {shearKeyRows.length === 0
                        ? <p className="text-[12px] text-gray-500">{t('precastSlab.noEndLockBars')}</p>
                        : shearKeyRows.map(r => (
                            <div key={r.key}>
                                <CalcField label={t('precastSlab.descNet', { desc: r.desc })} value={r.qty} unit={t('common.kg')} />
                                <CalcField label={t('precastSlab.materialLabourAllowanceV', { v: formatNumber(r.waste * 100, 0) })} value={r.total} unit={t('common.baht')} />
                            </div>
                        ))}
                    <p className="mt-1 text-[12px] text-gray-500">{t('precastSlab.noTieWireRow')}</p>
                </SheetCard>
            )}>
            <SheetCard title={t('precastSlab.precastSlabQuantitySummary')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <CalcField label={t('precastSlab.precastSlab2')} value={outputs.area} unit={t('common.sqM')} strong />
                    <CalcField label={t('precastSlab.wireMesh2')} value={outputs.wiremesh} unit={t('common.sqM')} strong />
                    <CalcField label={t('common.formwork')} value={outputs.formwork} unit={t('common.sqM')} strong />
                    <CalcField label={t('precastSlab.toppingConcrete2')} value={outputs.concrete} unit={t('common.cuM')} digits={4} strong />
                </div>
                <div className="mt-3 overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={th}>{t('precastSlab.endLockBarQuantityKg')}</th>
                                {REBAR_SIZES.map(s => <th key={s} className={th}>{s}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-gray-200 px-2 py-1 text-[13px]">{t('common.total')}</td>
                                {REBAR_SIZES.map(s => (
                                    <td key={s} className={`${td} font-semibold`} style={{ background: SHEET_COLORS.calc }}>
                                        {formatNumber(totals.shearKey[s])}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </SheetCard>

            <SheetCard title={t('precastSlab.precastSlabData')}>
                <EditableTable<PrecastPanelRow>
                    rows={input.panels}
                    onChange={panels => update({ panels })}
                    newRow={newRow}
                    addLabel={t('precastSlab.addSlab')}
                    columns={[
                        { kind: 'number', key: 'width', title: t('common.widthM'), width: 70, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'length', title: t('common.lengthM2'), width: 70, get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'calc', key: 'area', title: head(t('precastSlab.slab'), t('precastSlab.slabSqM')), width: 80, get: r => precastPanel(r).area },
                        { kind: 'calc', key: 'wiremesh', title: head(t('precastSlab.wireMesh2'), t('precastSlab.wireMeshSqM')), width: 80, get: r => precastPanel(r).wiremesh },
                        { kind: 'select', key: 'keySize', title: head(t('precastSlab.slabEndLockBars'), t('common.size')), width: 90,
                            options: PS_BAR_SIZES.map(s => ({ value: s })), get: r => r.keySize, set: (r, v) => ({ ...r, keySize: v }) },
                        { kind: 'number', key: 'keySpacing', title: head(t('precastSlab.slabEndLockBars'), t('common.spacingM')), width: 70,
                            get: r => r.keySpacing, set: (r, v) => ({ ...r, keySpacing: v }) },
                        { kind: 'number', key: 'keyBarLength', title: head(t('precastSlab.slabEndLockBars'), t('common.lengthBarM')), width: 70,
                            get: r => r.keyBarLength, set: (r, v) => ({ ...r, keyBarLength: v }) },
                        { kind: 'calc', key: 'keyCount', title: head(t('precastSlab.slabEndLockBars'), t('common.numberBars')), width: 70, digits: 0,
                            get: r => precastPanel(r).keyCount },
                        { kind: 'calc', key: 'keyTotalLength', title: head(t('precastSlab.slabEndLockBars'), t('common.totalLengthM')), width: 80,
                            get: r => precastPanel(r).keyTotalLength },
                        { kind: 'calc', key: 'keyWeight', title: head(t('precastSlab.slabEndLockBars'), t('common.weightKg')), width: 80,
                            get: r => precastPanel(r).keyWeight },
                        { kind: 'calc', key: 'perimeter', title: head(t('common.formwork'), t('common.lengthM2')), width: 70, get: r => precastPanel(r).perimeter },
                        { kind: 'calc', key: 'formwork', title: head(t('common.formwork'), t('common.quantitySqM')), width: 80, get: r => precastPanel(r).formwork },
                        { kind: 'number', key: 'topping', title: head(t('precastSlab.toppingConcrete'), t('common.thicknessM')), width: 70,
                            get: r => r.topping, set: (r, v) => ({ ...r, topping: v }) },
                        { kind: 'calc', key: 'concrete', title: head(t('precastSlab.toppingConcrete'), t('precastSlab.concreteCuM')), width: 80, digits: 4,
                            get: r => precastPanel(r).concrete },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>{t('precastSlab.n1Row1PanelWidth')}</li>
                    <li>{t('precastSlab.endLockBarsNumberRound')}</li>
                    <li>{t('precastSlab.formworkPerimeter2WidthLength')}</li>
                    <li>
                        {t('precastSlab.sentToBoqSection10')}{formatNumber(outputs.area)} {t('precastSlab.sqMProps01')}{formatNumber(outputs.wiremesh)} {t('precastSlab.sqMFormwork')}{formatNumber(outputs.formwork)} {t('precastSlab.sqMConcrete')}{formatNumber(outputs.concrete, 4)} {t('precastSlab.cuMEndLockBars')}
                    </li>
                </ul>
            </SheetCard>
        </CalculatorShell>
    );
}
