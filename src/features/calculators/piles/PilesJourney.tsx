'use client';

// Guided-journey view of the piling level: the pile spec and count from the foundation plan; the lump price
// per pile folded away. Same input as the Excel-mirror form.
import {
    composePileSpec, missingPileSpec, PILE_SECTION_GROUPS, PILE_TYPES, type PilesInput,
} from '@/domain/calculators/piles';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    ChoiceButtons, JGroup, JNumber, JSelect, JText, PlanField, PlanNumber, ResultSummary,
} from '@/components/sheet/journey';
import { useTranslations } from 'next-intl';

const typeOptions = PILE_TYPES.map(tot => ({ value: tot as string, label: tot }));

export function PilesJourney({ input, update }: { input: PilesInput; update: (patch: Partial<PilesInput>) => void }) {
    const t = useTranslations('calculators');
    const spec = composePileSpec(input);
    const missing = missingPileSpec(input);
    const count = Number.isFinite(input.count) ? input.count : 0;
    const price = Number.isFinite(input.pricePerPile) ? input.pricePerPile : 0;

    return (
        <div className="flex flex-col gap-4">
            <div className="bg-white border border-gray-200 rounded-card shadow-card p-4">
                <JGroup title={t('piles.pilesFromTheFootingPlan')}>
                    <PlanField label={t('piles.pileType')} fieldKey="pileType" className="col-span-2">
                        <ChoiceButtons<string> size="small" ariaLabel={t('piles.pileType')} value={input.pileType === '' ? undefined : input.pileType}
                            options={typeOptions} onChange={v => update({ pileType: v })} />
                    </PlanField>
                    <JSelect<string> label={t('piles.sectionShape')} fieldKey="section" value={input.section || undefined} placeholder={t('piles.selectSection')}
                        options={PILE_SECTION_GROUPS.map(g => ({ label: g.label, options: g.options.map(o => ({ value: o })) }))}
                        onChange={v => update({ section: v ?? '' })} />
                    <PlanNumber label={t('piles.lengthPerPile')} fieldKey="length" value={input.length} unit={t('common.m')} range={[1, 40]} onChange={v => update({ length: v })} />
                    <JNumber label={t('piles.totalNumberOfPiles')} fieldKey="count" value={input.count} unit={t('common.pcs')} digits={0} onChange={v => update({ count: v })}
                        hint={t('piles.countFromTheFootingPlan')} />
                </JGroup>
                <JGroup title="">
                    <JText wide label={t('piles.additionalDetailsIfAny')} value={input.extraSpec} placeholder={t('piles.eGCapacity15Tons')}
                        onChange={v => update({ extraSpec: v })} />
                </JGroup>
                {count > 0 && missing.length > 0 && (
                    <div className="mt-3 text-[12px] text-red-600">{t('piles.missing')}{missing.join(', ')} {t('piles.aLumpSumPriceNeeds')}</div>
                )}
            </div>

            <AdvancedSection>
                <JGroup title={t('piles.lumpSumPrice')}>
                    <JNumber label={t('piles.lumpSumPricePerPile')} value={input.pricePerPile} unit={t('common.baht')}
                        onChange={v => update({ pricePerPile: v })} />
                </JGroup>
            </AdvancedSection>

            {/* The money is มูลค่าขั้นตอนนี้ in the bottom bar. */}
            <ResultSummary items={[
                { label: t('piles.piles'), value: count, unit: t('common.pcs'), digits: 0, detail: t('piles.lumpSumPriceVBaht', { v: formatNumber(price, 0) }) },
            ]} note={count > 0 ? <>
                {spec ? <>{t('piles.itemsInTheBoq')}{spec}</> : t('piles.pileTypeAndSectionNot')}
                {' · '}{t('piles.pileHeadCuttingCost')}{formatNumber(count, 0)} {t('piles.pilesIsCalculatedAutomaticallyAnd')}
            </> : undefined}
            empty={<>{t('piles.selectThePileTypeSection')}</>} />
        </div>
    );
}
