'use client';

// Guided-journey view of the pedestal sheet: one card per pedestal type, each standing on a footing type of
// the footing level. Same input and calculation as the Excel-mirror table.
import { Button, Popconfirm } from 'antd';
import { totalKg, type FootingRow } from '@/domain/calculators/footing';
import {
    footingRefFor, newPedestalRow, pedestalRow, pedestalTotals, pedestalsForFootings, PEDESTAL_BAR_SIZES, type PedestalRow,
} from '@/domain/calculators/pedestal';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, BarField, ChoiceButtons, EmptyState, JSelect, JText, PlanCard, PlanField, PlanGroup, PlanNumber, ResultSummary,
    isPositive, planChecks, removeAt, resultText,
} from '@/components/sheet/journey';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const label = (t: CalcT, r: PedestalRow, i: number) => (r.name.trim() === '' ? t('common.typeV', { v: i + 1 }) : r.name.trim());
const footingLabel = (t: CalcT, f: FootingRow, i: number) => (f.name.trim() === '' ? t('pedestal.footingTypeV', { v: i + 1 }) : f.name.trim());

const labelsOf = (t: CalcT) => ({
    footing: t('pedestal.standingOnFooting'), count: t('common.numberOfColumns'), width: t('common.width2'), length: t('common.length'), height: t('common.height'),
    main: t('common.verticalBars'), stirrup: t('common.stirrups'),
}) as const;
type Labels = ReturnType<typeof labelsOf>;

const checksOf = (L: Labels, r: PedestalRow, onFooting: boolean) => planChecks([
    { label: L.footing, ok: onFooting },
    { label: L.count, ok: isPositive(r.count) },
    { label: L.width, ok: isPositive(r.width) },
    { label: L.length, ok: isPositive(r.length) },
    { label: L.height, ok: isPositive(r.height) },
    { label: L.main, ok: isPositive(r.mainBarCount) && r.mainBarSize !== '' },
    { label: L.stirrup, ok: isPositive(r.stirrupSpacing) && r.stirrupSize !== '' },
// The footing, count and bars come pre-filled on a new pedestal: only its own size marks it as started.
], [r.width, r.length, r.height, r.mainBarCount].some(isPositive));

export function PedestalJourney({ rows, onChange, footings, footingSkipped, footingOutputs, backfill }: {
    rows: PedestalRow[];
    onChange: (rows: PedestalRow[]) => void;
    /** Footing types of the footing level (pedestal rows refer to them by index). */
    footings: FootingRow[];
    /** The footing level is marked "ไม่มีในโครงการนี้". */
    footingSkipped: boolean;
    footingOutputs: Record<string, number> | undefined;
    backfill: number | undefined;
}) {
    const t = useTranslations('calculators');
    const L = labelsOf(t);
    const tot = pedestalTotals(rows, footingOutputs);
    const set = (i: number, patch: Partial<PedestalRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const add = () => onChange([...rows, newPedestalRow(rows, footings)]);

    if (footings.length === 0 || footingSkipped) {
        return (
            <EmptyState text={<>
                {footingSkipped ? t('pedestal.theFootingStepIsMarked') : t('pedestal.noFootingsYet')} {t('pedestal.pedestalsStandOnFootingsFill')}
            </>} goToLevel="footing">
                {rows.length > 0 && (
                    <div className="mt-1 text-[12px] text-orange-600">
                        {t('pedestal.thereAreStill')}{rows.length} {t('pedestal.pedestalTypesLeftConcrete')}{formatNumber(tot.concrete)} {t('pedestal.cuMThatDoNot')}
                        <Popconfirm title={t('pedestal.deleteAllPedestals')} okText={t('pedestal.delete')} cancelText={t('common.cancel')} onConfirm={() => onChange([])}>
                            <Button className="ml-2" size="small" danger>{t('pedestal.deleteAllPedestals2')}</Button>
                        </Popconfirm>
                    </div>
                )}
            </EmptyState>
        );
    }

    if (rows.length === 0) {
        const names = footings.map((f, i) => footingLabel(t, f, i)).join(', ');
        return (
            <EmptyState
                text={<>{t('pedestal.noPedestalsYetNormallyEach')}{names}{t('pedestal.checkTheSizesInThe')}</>}
                addLabel={footings.length > 1 ? t('pedestal.addPedestalsForFootingNames', { names }) : t('pedestal.addPedestalsOnFootingNames', { names })}
                onAdd={() => onChange(pedestalsForFootings(footings))} />
        );
    }

    const footingOptions = footings.map((f, i) => ({ value: i, label: footingLabel(t, f, i) }));

    return (
        <div className="flex flex-col gap-4">
            {rows.map((r, i) => {
                const c = pedestalRow(r, footingRefFor(footingOutputs, r.footing));
                const onFooting = r.footing >= 0 && r.footing < footings.length;
                const k = checksOf(L, r, onFooting);
                return (
                    <PlanCard key={i} index={i + 1} scope={{ listKey: 'rows', itemIndex: i }} state={k.state} hasData={k.hasData} missingText={k.missingText}
                        title={t('pedestal.pedestalV', { v: label(t, r, i) })}
                        result={k.state === 'empty' ? undefined : resultText([
                            { label: t('common.concrete'), value: c.concrete, unit: t('common.cuM') },
                            { label: t('common.steel'), value: c.mainKg + c.stirrupKg, unit: t('common.kg'), digits: 1 },
                        ])}
                        onDelete={() => onChange(removeAt(rows, i))} deleteTitle={t('pedestal.deletePedestalV', { v: label(t, r, i) })}>
                        <PlanGroup title={t('pedestal.locationAndNumber')}>
                            <PlanField label={L.footing} fieldKey="footing" className="col-span-2">
                                {footingOptions.length <= 5
                                    ? (
                                        <ChoiceButtons<number> size="small" ariaLabel={L.footing} value={onFooting ? r.footing : undefined}
                                            options={footingOptions} onChange={v => set(i, { footing: v })} />
                                    )
                                    : (
                                        <JSelect<number> label="" value={onFooting ? r.footing : undefined} placeholder={t('pedestal.selectFooting')}
                                            options={footingOptions} width={140} onChange={v => set(i, { footing: v ?? -1 })} />
                                    )}
                            </PlanField>
                            <JText label={t('pedestal.pedestalName')} value={r.name} placeholder={t('pedestal.eGC1')} onChange={v => set(i, { name: v })} />
                            <PlanNumber label={L.count} fieldKey="count" value={r.count} unit={t('common.pcs')} digits={0} hint={t('pedestal.normallyEqualToTheNumber')}
                                onChange={v => set(i, { count: v })} />
                        </PlanGroup>
                        <PlanGroup title={t('pedestal.pedestalSizeFromThePedestal')}>
                            <PlanNumber label={L.width} fieldKey="width" value={r.width} unit={t('common.m')} range={[0.1, 1.5]} onChange={v => set(i, { width: v })} />
                            <PlanNumber label={L.length} fieldKey="length" value={r.length} unit={t('common.m')} range={[0.1, 1.5]} onChange={v => set(i, { length: v })} />
                            <PlanNumber label={L.height} fieldKey="height" value={r.height} unit={t('common.m')} range={[0.1, 4]} hint={t('pedestal.fromTheTopOfThe')}
                                onChange={v => set(i, { height: v })} />
                        </PlanGroup>
                        <PlanGroup title={t('common.reinforcementPerColumn')} hint={t('pedestal.eG4Db12Stirrups')} layout="wide">
                            <BarField label={L.main} sizes={PEDESTAL_BAR_SIZES} size={r.mainBarSize} onSize={v => set(i, { mainBarSize: v })}
                                amount={r.mainBarCount} onAmount={v => set(i, { mainBarCount: v })} />
                            <BarField label={L.stirrup} sizes={PEDESTAL_BAR_SIZES} size={r.stirrupSize} onSize={v => set(i, { stirrupSize: v })}
                                amount={r.stirrupSpacing} onAmount={v => set(i, { stirrupSpacing: v })} amountLabel={t('common.spacing')}
                                amountUnit={t('common.m')} amountDigits={2} presets={[0.15, 0.2]} range={[0.05, 0.5]} />
                        </PlanGroup>
                    </PlanCard>
                );
            })}

            <AddButton label={t('pedestal.addTheNextPedestalType')} onClick={add} />

            <ResultSummary items={[
                { label: t('pedestal.pedestalConcrete'), value: tot.concrete, unit: t('common.cuM') },
                { label: t('common.reinforcement'), value: totalKg(tot.rebar), unit: t('common.kg') },
                { label: t('common.formwork'), value: tot.formwork, unit: t('common.sqM') },
            ]} note={backfill === undefined || backfill === 0 ? undefined
                : t('pedestal.backfillAroundTheFootingsV', { v: formatNumber(backfill) })} />
        </div>
    );
}
