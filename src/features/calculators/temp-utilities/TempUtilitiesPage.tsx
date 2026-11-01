'use client';

import { tempUtilities, type TempUtilitiesInput, type TempUtilitiesPrices } from '@/domain/calculators/temp-utilities';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, InputNumberField, InputTextField, SheetCard } from '@/components/sheet/SheetFields';
import { NumberCell, formatNumber } from '@/components/sheet/NumberCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { CountStepper, JNumber, PlanField, ResultSummary } from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

/** One fixed row (18–24) of the Excel item table. */
interface ItemRow {
    label: string;                        // B รายการ
    qty: number | null;                   // C ปริมาณ (blank on the % rows)
    unit: string;                         // D หน่วย
    hint: string;                         // E สูตร/ที่มา
    price?: keyof TempUtilitiesPrices;    // F ราคาต่อหน่วย (yellow); none on the % rows
    total: number;                        // G รวมราคา
}

const warningsOf = (t: CalcT) => [
    t('tempUtilities.thisPriceIsAStarting'),
    t('tempUtilities.ifTheDistanceToThe'),
    t('tempUtilities.pipeAndElectricalFittingsAre'),
    t('tempUtilities.theMainBOQIsExported'),
];

/** Unit prices of the item table, in table order (for the journey's folded price list). */
const priceFieldsOf = (t: CalcT): { key: keyof TempUtilitiesPrices; label: string; unit: string }[] => [
    { key: 'pvcPipe', label: t('tempUtilities.pVCPipe12Inch'), unit: t('tempUtilities.bahtLength') },
    { key: 'faucet', label: t('tempUtilities.tap12Inch'), unit: t('tempUtilities.bahtPiece') },
    { key: 'powerBox', label: t('tempUtilities.temporaryDistributionBoard30A'), unit: t('tempUtilities.bahtSet') },
    { key: 'cable', label: t('tempUtilities.tHWWire1x10SqMm'), unit: t('tempUtilities.bahtRoll') },
    { key: 'lightPlug', label: t('tempUtilities.lightBulbSocket'), unit: t('tempUtilities.bahtSet') },
];

type Calc = UseCalculator<TempUtilitiesInput>;

/** Journey field labels (also the names in "ยังขาด: …"). */
const labelsOf = (t: CalcT) => ({
    powerDistance: t('tempUtilities.wiringDistanceFromTheMeter'), powerPoints: t('tempUtilities.numberOfLightPointsSockets'),
    waterDistance: t('tempUtilities.waterPipeDistanceFromThe'), waterPoints: t('tempUtilities.numberOfWaterPoints'),
}) as const;

export default function TempUtilitiesPage() {
    const t = useTranslations('calculators');
    const calc = useCalculator(tempUtilities);
    const inJourney = useJourneyMode();
    const { input, update, reset, outputs, result, isDefault } = calc;
    const o = (k: string) => outputs[k] ?? 0;
    const setPrice = (key: keyof TempUtilitiesPrices, v: number) =>
        update(p => ({ ...p, prices: { ...p.prices, [key]: v } }));

    const rows: ItemRow[] = [
        { label: t('tempUtilities.pVCPipe12Inch'), qty: o('pipeQty'), unit: t('common.pcs2'), hint: t('tempUtilities.roundUpWaterDistance4'), price: 'pvcPipe', total: o('pipeTotal') },
        { label: t('tempUtilities.tap12Inch'), qty: o('faucetQty'), unit: t('tempUtilities.piece'), hint: t('tempUtilities.equalToTheNumberOf'), price: 'faucet', total: o('faucetTotal') },
        { label: t('tempUtilities.waterPipeFittings'), qty: null, unit: '', hint: t('tempUtilities.ofMainMaterialCost'), total: o('waterFittings') },
        { label: t('tempUtilities.temporaryDistributionBoard30A'), qty: o('powerBoxQty'), unit: t('tempUtilities.set'), hint: '', price: 'powerBox', total: o('powerBoxTotal') },
        { label: t('tempUtilities.tHWWire1x10SqMm'), qty: o('cableQty'), unit: t('tempUtilities.roll'), hint: t('tempUtilities.roundUpPowerDistance50'), price: 'cable', total: o('cableTotal') },
        { label: t('tempUtilities.lightBulbSocket'), qty: o('lightPlugQty'), unit: t('tempUtilities.set'), hint: t('tempUtilities.equalToTheNumberOf2'), price: 'lightPlug', total: o('lightPlugTotal') },
        { label: t('tempUtilities.electricalAccessories'), qty: null, unit: '', hint: t('tempUtilities.ofMainMaterialCost'), total: o('electricalAcc') },
    ];

    return (
        <CalculatorShell def={tempUtilities} result={result} isDefault={isDefault} onReset={reset}>
            {inJourney ? <JourneyView calc={calc} setPrice={setPrice} /> : (
                <>
                    <SheetCard title={t('tempUtilities.projectInformation')}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                            <InputTextField label={t('tempUtilities.projectName')} value={input.projectName} onChange={v => update({ projectName: v })} />
                            <InputTextField label={t('tempUtilities.calculatedBy')} value={input.calculatedBy} onChange={v => update({ calculatedBy: v })} />
                            <InputTextField label={t('tempUtilities.calculationDate')} value={input.calcDate} placeholder={t('tempUtilities.ddMmYyyy')}
                                onChange={v => update({ calcDate: v })} />
                            <InputTextField label={t('common.remark')} value={input.remark} onChange={v => update({ remark: v })} />
                        </div>
                    </SheetCard>

                    <SheetCard title={t('common.requiredInput')}>
                        <InputNumberField label={t('tempUtilities.distanceFromTheElectricMeter')} value={input.powerDistance} unit={t('common.m')} hint={t('tempUtilities.usedToCalculateTHWWire')}
                            onChange={v => update({ powerDistance: v })} />
                        <InputNumberField label={t('tempUtilities.distanceFromTheWaterMeter')} value={input.waterDistance} unit={t('common.m')} hint={t('tempUtilities.usedToCalculatePVCPipe')}
                            onChange={v => update({ waterDistance: v })} />
                        <InputNumberField label={t('tempUtilities.numberOfWaterPoints')} value={input.waterPoints} digits={0} unit={t('common.point')} hint={t('tempUtilities.eGTapWashingPoint')}
                            onChange={v => update({ waterPoints: v })} />
                        <InputNumberField label={t('tempUtilities.numberOfLightPointsSockets')} value={input.powerPoints} digits={0} unit={t('tempUtilities.set')} hint={t('tempUtilities.lightBulbSocket')}
                            onChange={v => update({ powerPoints: v })} />
                        <Allowances calc={calc} />
                    </SheetCard>

                    <SheetCard title={t('common.materialItems')}>
                        <EditableTable<ItemRow>
                            rows={rows}
                            onChange={() => undefined}
                            canDelete={false}
                            columns={[
                                { kind: 'label', key: 'label', title: t('common.item'), get: r => r.label },
                                { kind: 'calc', key: 'qty', title: t('common.quantity'), width: 80, digits: 0, get: r => r.qty },
                                { kind: 'label', key: 'unit', title: t('common.unit'), width: 60, get: r => r.unit },
                                { kind: 'label', key: 'hint', title: t('tempUtilities.formulaSource'), get: r => <span className="text-[12px] text-gray-500">{r.hint}</span> },
                                {
                                    kind: 'label', key: 'price', title: t('common.pricePerUnit'), width: 110,
                                    get: r => {
                                        const key = r.price;
                                        return key === undefined ? null : (
                                            <NumberCell value={input.prices[key]} ariaLabel={t('tempUtilities.unitPrice', { label: r.label })}
                                                onCommit={v => setPrice(key, v ?? tempUtilities.defaults().prices[key])} />
                                        );
                                    },
                                },
                                { kind: 'calc', key: 'total', title: t('tempUtilities.totalPrice'), width: 110, get: r => r.total },
                            ]}
                        />
                    </SheetCard>

                    <SheetCard title={t('tempUtilities.temporaryWaterAndPowerPrice')}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <CalcField label={t('tempUtilities.temporaryWaterSupplyMaterialCost')} value={outputs.waterMaterial} unit={t('common.baht')} />
                                <CalcField label={t('tempUtilities.temporaryElectricalMaterialCost')} value={outputs.powerMaterial} unit={t('common.baht')} />
                                <CalcField label={t('tempUtilities.totalCost')} value={outputs.total} unit={t('common.baht')} strong />
                            </div>
                            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                                <div className="font-semibold text-[13px] text-gray-800 mb-1">{t('tempUtilities.warningsCautions')}</div>
                                <ol className="list-decimal pl-5 text-[12px] text-gray-600 space-y-0.5">
                                    {warningsOf(t).map(w => <li key={w}>{w}</li>)}
                                </ol>
                            </div>
                        </div>
                        <p className="mt-2 text-[12px] text-gray-500">
                            {t('tempUtilities.amount')}{formatNumber(outputs.total)}{t('tempUtilities.bahtSentToTheBOQ')}
                        </p>
                    </SheetCard>
                </>
            )}
        </CalculatorShell>
    );
}

/** Waste and the two % rows (C13:C15). */
function Allowances({ calc }: { calc: Calc }) {
    const t = useTranslations('calculators');
    const { input, update } = calc;
    return (
        <>
            <InputNumberField label={t('common.materialWastage')} value={input.waste} percent unit="%" hint={t('tempUtilities.recommended510')}
                onChange={v => update({ waste: v })} />
            <InputNumberField label={t('tempUtilities.waterPipeFittings')} value={input.waterFittingsPct} percent unit={t('tempUtilities.ofMainWaterMaterialCost')}
                hint={t('tempUtilities.elbowsCouplingsValvesTapeGlue')} onChange={v => update({ waterFittingsPct: v })} />
            <InputNumberField label={t('tempUtilities.electricalAccessories')} value={input.electricalAccPct} percent unit={t('tempUtilities.ofMainElectricalMaterialCost')}
                hint={t('tempUtilities.wireTapeClampsOther')} onChange={v => update({ electricalAccPct: v })} />
        </>
    );
}

/** Guided journey: distances and points on site first; waste, % rows and unit prices folded. */
function JourneyView({ calc, setPrice }: { calc: Calc; setPrice: (key: keyof TempUtilitiesPrices, v: number) => void }) {
    const t = useTranslations('calculators');
    const L = labelsOf(t);
    const { input, update, outputs } = calc;
    const o = (k: string) => outputs[k] ?? 0;
    const nothingYet = o('pipeQty') === 0 && o('cableQty') === 0 && o('faucetQty') === 0 && o('lightPlugQty') === 0;
    return (
        <>
            <SheetCard title={t('tempUtilities.waterAndPowerUsedDuring')}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
                    <JNumber label={L.powerDistance} value={input.powerDistance} unit={t('common.m')} onChange={v => update({ powerDistance: v })} />
                    <JNumber label={L.waterDistance} value={input.waterDistance} unit={t('common.m')} onChange={v => update({ waterDistance: v })} />
                    <PlanField label={L.waterPoints} hint={t('tempUtilities.tapWashingPoint')}>
                        <CountStepper value={input.waterPoints} unit={t('common.point')} ariaLabel={L.waterPoints} onChange={v => update({ waterPoints: v })} />
                    </PlanField>
                    <PlanField label={L.powerPoints} hint={t('tempUtilities.n1SetOfLightBulb')}>
                        <CountStepper value={input.powerPoints} unit={t('tempUtilities.set')} ariaLabel={L.powerPoints} onChange={v => update({ powerPoints: v })} />
                    </PlanField>
                </div>
            </SheetCard>
            <AdvancedSection>
                <Allowances calc={calc} />
                <div className="mt-3 text-[12px] font-semibold text-gray-600">{t('common.pricePerUnit')}</div>
                {priceFieldsOf(t).map(f => (
                    <InputNumberField key={f.key} label={f.label} value={input.prices[f.key]} unit={f.unit}
                        onChange={v => setPrice(f.key, v)} />
                ))}
            </AdvancedSection>

            {/* Quantities to order only: the money (with the fixed power box and labour) is มูลค่าขั้นตอนนี้ below. */}
            <ResultSummary
                items={nothingYet ? [] : [
                    { label: t('tempUtilities.pVCPipe'), value: o('pipeQty'), unit: t('common.pcs2'), digits: 0 },
                    { label: t('tempUtilities.wire'), value: o('cableQty'), unit: t('tempUtilities.roll'), digits: 0 },
                    { label: t('tempUtilities.tap'), value: o('faucetQty'), unit: t('tempUtilities.piece'), digits: 0 },
                    { label: t('tempUtilities.lightBulbSocket2'), value: o('lightPlugQty'), unit: t('tempUtilities.set'), digits: 0 },
                ]}
                empty={t('tempUtilities.enterTheDistanceFromThe')} />
        </>
    );
}
