'use client';

import {
    layout, layoutLine, LAYOUT_FIXED_ROWS, LAYOUT_LIVE_PREVIEW, type LayoutInput, type LayoutMaterialLine,
} from '@/domain/calculators/layout';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, InputNumberField, SheetCard } from '@/components/sheet/SheetFields';
import { NumberCell, SHEET_COLORS, TextCell, formatNumber } from '@/components/sheet/NumberCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { JNumber, ResultSummary } from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';
import { useTranslations } from 'next-intl';

const td = 'border border-gray-200 px-2 py-1 text-[13px]';
const tdNum = `${td} text-right tabular-nums whitespace-nowrap`;

type Calc = UseCalculator<LayoutInput>;

export default function LayoutPage() {
    const t = useTranslations('calculators');
    const calc = useCalculator(layout);
    const inJourney = useJourneyMode();
    const { input, update, reset, outputs, result, isDefault } = calc;

    return (
        <CalculatorShell def={layout} result={result} isDefault={isDefault} onReset={reset}
            aside={inJourney ? undefined : (
                <SheetCard title={t('layout.result')}>
                    <CalcField label={t('layout.numberOfLayouts')} value={outputs.points} digits={0} unit={t('layout.layouts')} />
                    {LAYOUT_LIVE_PREVIEW.map(p => (
                        <CalcField key={p.output} label={p.label} value={outputs[p.output]} digits={0} unit={p.unit} />
                    ))}
                    <CalcField label={t('layout.totalMaterialCost')} value={outputs.materialTotal} unit={t('common.baht')} />
                    <CalcField label={t('common.labour')} value={outputs.labour} unit={t('common.baht')} />
                    <CalcField label={t('layout.totalLayoutStakingWork')} value={outputs.total} unit={t('common.baht')} strong />
                </SheetCard>
            )}>
            {inJourney ? <JourneyView calc={calc} /> : (
                <>
                    <SheetCard title={t('layout.enteredData')}>
                        <InputNumberField label={t('layout.numberOfLayoutsPoints')} value={input.points} digits={0} unit={t('common.point')}
                            onChange={v => update({ points: v })} />
                        <InputNumberField label={t('layout.numberOfStakesPcs')} value={input.stakes} digits={0} unit={t('common.pcs')}
                            hint={t('layout.example21TheNumberOf')} onChange={v => update({ stakes: v })} />
                        <Allowances calc={calc} />
                        <p className="mt-1 text-[12px] text-gray-500">{t('layout.noteFillInTheYellow')}</p>
                    </SheetCard>

                    <SheetCard title={t('layout.materialItems')}>
                        <MaterialTable calc={calc} />
                        <p className="mt-2 text-[12px] text-gray-500">
                            {t('layout.quantityBeforeAllowanceBasePer')}
                        </p>
                    </SheetCard>

                    <SheetCard title={t('layout.sampleBoqItems')}>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-[12px] text-gray-700">
                                        <th className={td}>{t('layout.section')}</th><th className={td}>{t('common.item')}</th><th className={td}>{t('common.unit')}</th>
                                        <th className={td}>{t('common.quantity')}</th><th className={td}>{t('common.material')}</th><th className={td}>{t('common.labour')}</th>
                                        <th className={td}>{t('common.total')}</th><th className={td}>{t('common.remark')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className={td}>{t('layout.section4')}</td>
                                        <td className={td}>{t('layout.layoutStaking')}</td>
                                        <td className={`${td} text-center`}>{t('layout.lumpSum')}</td>
                                        <td className={tdNum}>1</td>
                                        <td className={tdNum} style={{ background: SHEET_COLORS.calc }}>{formatNumber(outputs.materialTotal)}</td>
                                        <td className={tdNum} style={{ background: SHEET_COLORS.calc }}>{formatNumber(outputs.labour)}</td>
                                        <td className={tdNum} style={{ background: SHEET_COLORS.calc }}>{formatNumber(outputs.total)}</td>
                                        <td className={td}>{t('layout.totalMaterialsPerTheCalculation')}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-2 text-[12px] text-gray-500">
                            {t('layout.thisItemIsNotSent')}
                        </p>
                    </SheetCard>
                </>
            )}
        </CalculatorShell>
    );
}

/** เผื่อวัสดุ and the labour lump sum. */
function Allowances({ calc }: { calc: Calc }) {
    const t = useTranslations('calculators');
    const { input, update } = calc;
    return (
        <>
            <InputNumberField label={t('layout.materialAllowance')} value={input.waste} percent unit="%"
                onChange={v => update({ waste: v })} />
            <InputNumberField label={t('layout.layoutStakingLabour')} value={input.labour} unit={t('common.baht')}
                onChange={v => update({ labour: v })} />
        </>
    );
}

/** The material table (5 sheet rows plus added rows). */
function MaterialTable({ calc }: { calc: Calc }) {
    const t = useTranslations('calculators');
    const { input, update } = calc;
    const setRow = (i: number, patch: Partial<LayoutMaterialLine>) => update(p => ({
        ...p, materials: p.materials.map((x, j) => (j === i ? { ...x, ...patch } : x)),
    }));
    return (
        <EditableTable<LayoutMaterialLine>
            rows={input.materials}
            onChange={materials => update({ materials })}
            lockedRows={LAYOUT_FIXED_ROWS}
            newRow={() => ({ item: '', unit: '', perPoint: 0, fixed: 0, unitPrice: 0 })}
            addLabel={t('common.addItem')}
            columns={[
                {
                    kind: 'label', key: 'item', title: t('layout.materialItems'),
                    get: (r, i) => i < LAYOUT_FIXED_ROWS
                        ? r.item
                        : <TextCell value={r.item} placeholder={t('common.itemName')} onCommit={v => setRow(i, { item: v ?? '' })} />,
                },
                { kind: 'text', key: 'unit', title: t('common.unit'), width: 70, get: r => r.unit, set: (r, v) => ({ ...r, unit: v }) },
                { kind: 'number', key: 'perPoint', title: t('layout.basePerLayout'), width: 90, get: r => r.perPoint, set: (r, v) => ({ ...r, perPoint: v }) },
                {
                    kind: 'label', key: 'fixed', title: t('layout.fixedBase'), width: 90,
                    get: (r, i) => r.fixedFromStakes
                        ? (
                            <div className="text-right tabular-nums px-1 py-0.5 rounded-sm" style={{ background: SHEET_COLORS.calc }}
                                title={t('layout.numberOfStakesPcs2')}>
                                {formatNumber(input.stakes)}
                            </div>
                        )
                        : <NumberCell value={r.fixed} ariaLabel={t('layout.fixedBase')} onCommit={v => setRow(i, { fixed: v ?? 0 })} />,
                },
                { kind: 'calc', key: 'before', title: t('layout.quantityBeforeAllowance'), width: 100, get: r => layoutLine(r, input).beforeWaste },
                { kind: 'calc', key: 'order', title: t('layout.orderQuantity'), width: 100, get: r => layoutLine(r, input).orderQty },
                { kind: 'number', key: 'unitPrice', title: t('common.pricePerUnit'), width: 100, get: r => r.unitPrice, set: (r, v) => ({ ...r, unitPrice: v }) },
                { kind: 'calc', key: 'total', title: t('layout.totalPrice'), width: 100, get: r => layoutLine(r, input).total },
            ]}
        />
    );
}

/** Guided journey: the two counts off the foundation plan; recipe, waste and labour folded. */
function JourneyView({ calc }: { calc: Calc }) {
    const t = useTranslations('calculators');
    const { input, update, outputs, result } = calc;
    const row = result.boq.sections.find(s => s.no === 4)?.rows.find(r => r.key === 'R32');
    const lumpSum = row?.type === 'item' ? row.total : 0;
    const counted = (outputs.points ?? 0) > 0 || (outputs.stakes ?? 0) > 0;
    return (
        <>
            <SheetCard title={t('layout.layoutPointsAndStakes')}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 max-w-xl">
                    <JNumber label={t('layout.numberOfLayoutPoints')} value={input.points} digits={0} unit={t('common.point')}
                        hint={t('layout.countTheTimberLayoutPoints')} onChange={v => update({ points: v })} />
                    <JNumber label={t('layout.numberOfStakes')} value={input.stakes} digits={0} unit={t('common.pcs')}
                        hint={t('layout.normallyEqualToTheNumber')} onChange={v => update({ stakes: v })} />
                </div>
            </SheetCard>

            <AdvancedSection title={t('layout.materialItemsAndDefaults')}>
                <Allowances calc={calc} />
                <div className="mt-3">
                    <MaterialTable calc={calc} />
                </div>
            </AdvancedSection>

            <ResultSummary
                items={counted
                    ? LAYOUT_LIVE_PREVIEW.map(p => ({ label: p.label, value: outputs[p.output], unit: p.unit, digits: 0 }))
                    : []}
                empty={t('layout.enterTheNumberOfLayout')}
                note={<>{t('layout.layoutStakingLumpSum')}<b className="tabular-nums">{formatNumber(lumpSum, 0)}</b> {t('layout.bahtAlreadyIncludedInThe')}</>} />
        </>
    );
}
