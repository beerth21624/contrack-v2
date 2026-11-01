'use client';

import { Alert, Select, type SelectProps } from 'antd';
import {
    piles, composePileSpec, missingPileSpec, PILE_TYPES, PILE_SECTION_GROUPS,
} from '@/domain/calculators/piles';
import type { BoqItemRow } from '@/domain/boq/types';
import { CalcField, InputNumberField, InputTextField, SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { PilesJourney } from './PilesJourney';
import { useCalculator } from '../useCalculator';
import { useTranslations } from 'next-intl';

/** Labelled yellow dropdown, same layout as InputTextField. */
function InputSelectField({ label, value, onChange, options, placeholder }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string;
    options: SelectProps<string>['options'];
}) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-2 py-1">
            <span className="text-[13px] text-gray-700">{label}</span>
            <div style={{ background: SHEET_COLORS.input, borderRadius: 3 }}>
                <Select size="small" variant="borderless" allowClear style={{ width: '100%' }} aria-label={label}
                    placeholder={placeholder} value={value || undefined} options={options}
                    onChange={(v: string | undefined) => onChange(v ?? '')} />
            </div>
        </div>
    );
}

export default function PilesPage() {
    const t = useTranslations('calculators');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(piles);
    const inJourney = useJourneyMode();
    const spec = composePileSpec(input);
    const missing = missingPileSpec(input);
    const cutHeads = result.boq.sections.flatMap(s => s.rows)
        .find((r): r is BoqItemRow => r.type === 'item' && r.key === 'R39');

    if (inJourney) {
        return (
            <CalculatorShell def={piles} result={result} isDefault={isDefault} onReset={reset}>
                <PilesJourney input={input} update={update} />
            </CalculatorShell>
        );
    }

    return (
        <CalculatorShell def={piles} result={result} isDefault={isDefault} onReset={reset}
            aside={cutHeads && (
                <SheetCard title={t('piles.linkToOtherSections')}>
                    <CalcField label={t('piles.pileHeadCutting6Footing')} value={cutHeads.qty} unit={t('common.pcs')} digits={0} />
                    <CalcField label={t('piles.pileHeadCuttingCost2')} value={cutHeads.total} unit={t('common.baht')} />
                </SheetCard>
            )}>
            <SheetCard title={t('piles.pileDetails')}>
                <InputSelectField label={t('piles.pileType')} value={input.pileType} placeholder={t('piles.selectPileType')}
                    options={PILE_TYPES.map(tot => ({ value: tot }))} onChange={v => update({ pileType: v })} />
                <InputSelectField label={t('piles.sectionShape2')} value={input.section} placeholder={t('piles.selectSection')}
                    options={PILE_SECTION_GROUPS.map(g => ({ label: g.label, options: g.options.map(o => ({ value: o })) }))}
                    onChange={v => update({ section: v })} />
                <InputNumberField label={t('common.length')} value={input.length} unit={t('common.m')} onChange={v => update({ length: v })} />
                <InputTextField label={t('piles.additionalDetailsIfAny')} value={input.extraSpec}
                    placeholder={t('piles.eGCapacity15Tons')} onChange={v => update({ extraSpec: v })} />

                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-2">
                    <span className="text-[13px] font-semibold text-gray-900">{t('piles.remarkInBoq')}</span>
                    <span className="px-2 py-1 rounded-sm text-[13px]" style={{ background: SHEET_COLORS.calc }}>
                        {spec || '—'}
                    </span>
                </div>
                {missing.length > 0 && (
                    <Alert className="mt-3" type="warning" showIcon title={t('piles.thePileDetailsMustBe')}
                        description={t('piles.notSpecifiedV', { v: missing.join(', ') })} />
                )}
            </SheetCard>

            <SheetCard title={t('piles.lumpSumPrice')}>
                <InputNumberField label={t('common.number')} value={input.count} unit={t('common.pcs')} digits={0} onChange={v => update({ count: v })} />
                <InputNumberField label={t('piles.lumpSumPricePerPile2')} value={input.pricePerPile} unit={t('common.baht')}
                    onChange={v => update({ pricePerPile: v })} />
                <div className="mt-1">
                    <CalcField label={t('piles.totalPileCost')} value={(outputs.count ?? 0) * (outputs.pricePerPile ?? 0)} unit={t('common.baht')} strong />
                </div>
                <p className="mt-2 text-[12px] text-gray-500">
                    {t('piles.noteLumpSumEstimatePile')}{formatNumber(outputs.count, 0)} {t('piles.piles2')}{formatNumber(outputs.pricePerPile)} {t('piles.bahtSentToTheBoq')}
                </p>
            </SheetCard>
        </CalculatorShell>
    );
}
