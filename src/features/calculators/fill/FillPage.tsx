'use client';

import { fill, type FillInput } from '@/domain/calculators/fill';
import { CalcField, InputNumberField, InputTextField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { JNumber, JText, PlanNumber, ResultSummary } from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';
import { useTranslations } from 'next-intl';

export default function FillPage() {
    const t = useTranslations('calculators');
    const calc = useCalculator(fill);
    const inJourney = useJourneyMode();
    const { input, update, reset, outputs, result, isDefault } = calc;

    return (
        <CalculatorShell def={fill} result={result} isDefault={isDefault} onReset={reset}>
            {inJourney ? <JourneyView calc={calc} /> : (
                <>
                    <SheetCard title={t('fill.fillSoilQuantityCalculatorCu')}>
                        <div className="max-w-xl">
                            <div className="text-[13px] font-medium text-gray-800 pt-1">{t('fill.landSize')}</div>
                            <div className="pl-4">
                                <InputNumberField label={t('common.width')} value={input.width} unit={t('fill.metres')} onChange={v => update({ width: v })} />
                                <InputNumberField label={t('common.length2')} value={input.length} unit={t('fill.metres')} onChange={v => update({ length: v })} />
                            </div>
                            <InputNumberField label={t('fill.fillHeight')} value={input.height} unit={t('fill.metres')} onChange={v => update({ height: v })} />
                            <InputNumberField label={t('fill.settlementAllowance')} value={input.settlementPct} unit="%"
                                onChange={v => update({ settlementPct: v })} />
                            <div className="mt-3 border-t border-gray-100 pt-2">
                                <CalcField label={t('fill.soilQuantityToOrder')} value={outputs.volume} unit={t('fill.cuMCubicMetres')} strong />
                            </div>
                        </div>
                    </SheetCard>

                    <SheetCard title={t('fill.fillMaterial')}>
                        <InputTextField label={t('fill.fillMaterialRemark')} value={input.material} placeholder={t('fill.eGFillSoilFill')}
                            onChange={v => update({ material: v })} />
                        <p className="mt-2 text-[12px] text-gray-500">
                            {t('fill.fillMaterialIfAnyGoes')}{formatNumber(outputs.volume)} {t('fill.cuMGoesIntoThe')}
                        </p>
                    </SheetCard>
                </>
            )}
        </CalculatorShell>
    );
}

/** Guided journey: fill area and height off the site plan; the settlement allowance is folded. */
function JourneyView({ calc }: { calc: UseCalculator<FillInput> }) {
    const t = useTranslations('calculators');
    const { input, update, outputs } = calc;
    const volume = outputs.volume ?? 0;
    const area = (Number.isFinite(input.width) ? input.width : 0) * (Number.isFinite(input.length) ? input.length : 0);
    return (
        <>
            <SheetCard title={t('fill.areaToFill')}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                    <JNumber label={t('fill.fillAreaWidth')} fieldKey="width" value={input.width} unit={t('common.m')} onChange={v => update({ width: v })} />
                    <JNumber label={t('fill.fillAreaLength')} fieldKey="length" value={input.length} unit={t('common.m')} onChange={v => update({ length: v })} />
                    <PlanNumber label={t('fill.fillHeight2')} fieldKey="height" value={input.height} unit={t('common.m')} range={[0.05, 3]}
                        hint={t('fill.requiredLevelMinusTheExisting')} onChange={v => update({ height: v })} />
                    <JText wide label={t('fill.fillMaterial')} value={input.material} placeholder={t('fill.eGFillSoilFill')}
                        onChange={v => update({ material: v })} />
                </div>
            </SheetCard>

            <AdvancedSection>
                <div className="max-w-xl">
                    <InputNumberField label={t('fill.settlementAllowance')} value={input.settlementPct} digits={0} unit="%"
                        hint={t('fill.fillSettlesWhenCompactedNormally')} onChange={v => update({ settlementPct: v })} />
                </div>
            </AdvancedSection>

            <ResultSummary
                items={volume > 0 ? [{
                    label: t('fill.fillSoilQuantity'), value: volume, unit: t('common.cuM'),
                    detail: t('fill.areaVSqMHeight', { v: formatNumber(area), v2: formatNumber(input.height), v3: formatNumber(input.settlementPct, 0) }),
                }] : []}
                empty={<>{t('fill.enterTheWidthLengthAnd')}</>} />
        </>
    );
}
