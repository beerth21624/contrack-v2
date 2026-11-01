'use client';

import type { ReactNode } from 'react';
import {
    groundBeam, groundBeamRow, groundBeamTotals, BEAM_BAR_SIZES, BEAM_NAMES, type GroundBeamRow,
} from '@/domain/calculators/ground-beam';
import { REBAR_SIZES } from '@/domain/boq/slots';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { GroundBeamJourney } from './GroundBeamJourney';
import { useCalculator } from '../useCalculator';
import { useTranslations } from 'next-intl';

/** Column title with the Excel group header (row 3/4) above the column header (row 7). */
const head = (group: string, title: string): ReactNode => (
    <>
        <div className="text-[10px] font-normal text-gray-500 leading-tight">{group}</div>
        <div>{title}</div>
    </>
);

const sizeOptions = BEAM_BAR_SIZES.map(s => ({ value: s }));

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center';
const td = 'border border-gray-200 px-2 py-1 text-[13px] text-right tabular-nums';

export default function GroundBeamPage() {
    const t = useTranslations('calculators');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(groundBeam);
    const totals = groundBeamTotals(input);
    const inJourney = useJourneyMode();

    const newRow = (): GroundBeamRow => {
        const last = input.beams[input.beams.length - 1];
        return last
            ? { ...last, name: '', length: 0 }
            : { name: '', width: 0.2, depth: 0.4, length: 0, leanThickness: 0.05, mainSize: 'DB12', mainCount: 6, stirrupSize: 'RB6', stirrupSpacing: 0.15 };
    };

    if (inJourney) {
        return (
            <CalculatorShell def={groundBeam} result={result} isDefault={isDefault} onReset={reset}>
                <GroundBeamJourney beams={input.beams} onChange={beams => update({ beams })} />
            </CalculatorShell>
        );
    }

    return (
        <CalculatorShell def={groundBeam} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title={t('groundBeam.groundBeamQuantitySummary')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <CalcField label={t('groundBeam.beddingMaterialLeanConcrete')} value={outputs.lean} unit={t('common.cuM')} digits={3} strong />
                    <CalcField label={t('common.formwork')} value={outputs.formwork} unit={t('common.sqM')} strong />
                    <CalcField label={t('common.structuralConcrete')} value={outputs.concrete} unit={t('common.cuM')} digits={3} strong />
                </div>
                <div className="mt-3 overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={th}>{t('groundBeam.reinforcementKg')}</th>
                                {REBAR_SIZES.map(s => <th key={s} className={th}>{s}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {([
                                [t('groundBeam.mainReinforcementQuantity'), totals.main],
                                [t('groundBeam.stirrupQuantity'), totals.stirrup],
                            ] as const).map(([label, w]) => (
                                <tr key={label}>
                                    <td className="border border-gray-200 px-2 py-1 text-[13px]">{label}</td>
                                    {REBAR_SIZES.map(s => (
                                        <td key={s} className={td} style={{ background: SHEET_COLORS.calc }}>{formatNumber(w[s])}</td>
                                    ))}
                                </tr>
                            ))}
                            <tr>
                                <td className="border border-gray-200 px-2 py-1 text-[13px] font-semibold">{t('groundBeam.totalSentToBoq8')}</td>
                                {REBAR_SIZES.map(s => (
                                    <td key={s} className={`${td} font-semibold`} style={{ background: SHEET_COLORS.calc }}>
                                        {formatNumber(outputs[`rebar.${s}`])}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </SheetCard>

            <SheetCard title={t('groundBeam.groundBeamData')}>
                <EditableTable<GroundBeamRow>
                    rows={input.beams}
                    onChange={beams => update({ beams })}
                    newRow={newRow}
                    addLabel={t('common.addBeam')}
                    columns={[
                        { kind: 'select', key: 'name', title: t('common.beamName'), width: 80, options: BEAM_NAMES.map(n => ({ value: n })),
                            get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
                        { kind: 'number', key: 'width', title: t('common.widthM'), width: 70, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'depth', title: t('common.depthM'), width: 70, get: r => r.depth, set: (r, v) => ({ ...r, depth: v }) },
                        { kind: 'number', key: 'length', title: t('common.lengthM2'), width: 80, get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'number', key: 'leanThickness', title: head(t('common.leanConcrete'), t('common.thicknessM')), width: 70,
                            get: r => r.leanThickness, set: (r, v) => ({ ...r, leanThickness: v }) },
                        { kind: 'calc', key: 'lean', title: head(t('common.leanConcrete'), t('common.quantityCuM')), width: 80, digits: 3,
                            get: r => groundBeamRow(r).lean },
                        { kind: 'select', key: 'mainSize', title: head(t('common.mainReinforcement'), t('common.size')), width: 90, options: sizeOptions,
                            get: r => r.mainSize, set: (r, v) => ({ ...r, mainSize: v }) },
                        { kind: 'number', key: 'mainCount', title: head(t('common.mainReinforcement'), t('common.numberBars')), width: 70, digits: 0,
                            get: r => r.mainCount, set: (r, v) => ({ ...r, mainCount: v }) },
                        { kind: 'calc', key: 'mainLength', title: head(t('common.mainReinforcement'), t('common.totalLengthM')), width: 80,
                            get: r => groundBeamRow(r).mainLength },
                        { kind: 'calc', key: 'mainWeight', title: head(t('common.mainReinforcement'), t('common.weightKg')), width: 80,
                            get: r => groundBeamRow(r).mainWeight },
                        { kind: 'select', key: 'stirrupSize', title: head(t('common.stirrups'), t('common.size')), width: 90, options: sizeOptions,
                            get: r => r.stirrupSize, set: (r, v) => ({ ...r, stirrupSize: v }) },
                        { kind: 'number', key: 'stirrupSpacing', title: head(t('common.stirrups'), t('common.spacingM')), width: 70,
                            get: r => r.stirrupSpacing, set: (r, v) => ({ ...r, stirrupSpacing: v }) },
                        { kind: 'calc', key: 'stirrupCount', title: head(t('common.stirrups'), t('common.numberStirrups')), width: 70, digits: 0,
                            get: r => groundBeamRow(r).stirrupCount },
                        { kind: 'calc', key: 'stirrupLength', title: head(t('common.stirrups'), t('common.lengthBarM')), width: 70,
                            get: r => groundBeamRow(r).stirrupLength },
                        { kind: 'calc', key: 'stirrupTotalLength', title: head(t('common.stirrups'), t('common.totalLengthM')), width: 80,
                            get: r => groundBeamRow(r).stirrupTotalLength },
                        { kind: 'calc', key: 'stirrupWeight', title: head(t('common.stirrups'), t('common.weightKg')), width: 80,
                            get: r => groundBeamRow(r).stirrupWeight },
                        { kind: 'calc', key: 'formwork', title: head(t('common.formwork'), t('common.formworkSqM')), width: 80,
                            get: r => groundBeamRow(r).formwork },
                        { kind: 'calc', key: 'concrete', title: head(t('common.concrete'), t('common.structuralConcreteCuM')), width: 90, digits: 3,
                            get: r => groundBeamRow(r).concrete },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>{t('groundBeam.n1Row1BeamLine')}</li>
                    <li>{t('groundBeam.numberOfStirrupsRoundUp')}</li>
                    <li>{t('groundBeam.formwork2Sides2Depth')}</li>
                    <li>
                        {t('groundBeam.sentToBoqSection8')}{formatNumber(outputs.lean, 3)} {t('groundBeam.cuMReinforcementBySize')}{formatNumber(outputs.formwork)} {t('groundBeam.sqMBattensNailsAre')}{formatNumber(outputs.concrete, 3)} {t('common.cuM')}
                    </li>
                    <li>{t('groundBeam.backfill81IsCalculated')}</li>
                </ul>
            </SheetCard>
        </CalculatorShell>
    );
}
