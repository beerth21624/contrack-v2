'use client';

import Link from 'next/link';
import {
    BREAKER_SIZES, circuitTotal, electricalPipe, newCircuit, PIPE_TYPES, pipeTypeKey, setDeviceV,
    type Circuit, type ElectricalPipeInput,
} from '@/domain/calculators/electrical-pipe';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';
import { ElectricalPipeJourney } from './ElectricalPipeJourney';
import { useTranslations } from 'next-intl';

type Calc = UseCalculator<ElectricalPipeInput>;

const opts = (xs: readonly string[]) => xs.map(value => ({ value }));
const head = (group: string, label: string) => (
    <span className="flex flex-col leading-tight">
        <span className="text-[11px] font-normal text-gray-500">{group}</span>
        <span>{label}</span>
    </span>
);
const tf = 'border border-gray-200 px-2 py-1 text-[13px]';

export default function ElectricalPipePage() {
    const calc = useCalculator(electricalPipe);
    const inJourney = useJourneyMode();
    const { reset, result, isDefault } = calc;

    return (
        <CalculatorShell def={electricalPipe} result={result} isDefault={isDefault} onReset={reset}>
            {inJourney ? <ElectricalPipeJourney calc={calc} /> : <SheetPipe calc={calc} />}
        </CalculatorShell>
    );
}

/** The full Excel-mirror view (/calc). */
function SheetPipe({ calc }: { calc: Calc }) {
    const t = useTranslations('calculators');
    const { input, update, outputs } = calc;
    const types = [...new Set(input.circuits.map(c => c.pipeType.trim()).filter(tot => tot !== ''))];

    return (
        <>
            <SheetCard title={t('electricalPipe.electricalConduitLengthQuantityTable')}
                extra={(
                    <span className="text-[13px] text-gray-600">
                        {t('electricalPipe.electricalConduitLength')}{' '}
                        <span className="inline-block min-w-[80px] text-right font-bold tabular-nums px-2 py-0.5 rounded-sm"
                            style={{ background: SHEET_COLORS.calc }}>{formatNumber(outputs.total)}</span> {t('common.m')}
                    </span>
                )}>
                <EditableTable<Circuit>
                    rows={input.circuits}
                    onChange={circuits => update({ circuits })}
                    newRow={() => newCircuit(input.circuits)}
                    addLabel={t('electricalPipe.addCircuit2')}
                    columns={[
                        { kind: 'text', key: 'name', title: t('common.circuit'), width: 280, get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
                        { kind: 'select', key: 'breaker', title: t('common.cbSize'), width: 90, options: opts(BREAKER_SIZES),
                            get: r => r.breaker, set: (r, v) => ({ ...r, breaker: v }) },
                        { kind: 'select', key: 'pipeType', title: t('electricalPipe.conduitType'), width: 100, options: opts(PIPE_TYPES),
                            get: r => r.pipeType, set: (r, v) => ({ ...r, pipeType: v }) },
                        { kind: 'number', key: 'mainH', title: head(t('electricalPipe.horizontal'), t('electricalPipe.branchCircuitMMain')), width: 95,
                            get: r => r.mainH, set: (r, v) => ({ ...r, mainH: v }) },
                        { kind: 'number', key: 'deviceH', title: head(t('electricalPipe.horizontal'), t('electricalPipe.toEquipmentM')), width: 95,
                            get: r => r.deviceH, set: (r, v) => ({ ...r, deviceH: v }) },
                        { kind: 'number', key: 'mainV', title: head(t('electricalPipe.vertical'), t('electricalPipe.branchCircuitMMain')), width: 95,
                            get: r => r.mainV, set: (r, v) => ({ ...r, mainV: v }) },
                        { kind: 'number', key: 'deviceV', title: head(t('electricalPipe.vertical'), t('electricalPipe.toEquipmentM')), width: 95,
                            get: r => r.deviceV, set: (r, v) => setDeviceV(r, v) },
                        { kind: 'calc', key: 'total', title: t('electricalPipe.totalM'), width: 90, get: r => circuitTotal(r) },
                    ]}
                    footer={(
                        <tr style={{ background: SHEET_COLORS.subtotal }}>
                            <td className={`${tf} text-right font-semibold`} colSpan={8}>{t('electricalPipe.electricalConduitLength')}</td>
                            <td className={`${tf} text-right font-bold tabular-nums`} style={{ background: SHEET_COLORS.calc }}>
                                {formatNumber(outputs.total)}
                            </td>
                            <td className={tf} />
                        </tr>
                    )}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>{t('electricalPipe.totalMHorizontalBranchCircuit')}</li>
                    <li>
                        {t('electricalPipe.verticalToEquipmentInThe')}
                    </li>
                    <li>{t('electricalPipe.cbSizeAndConduitType')}</li>
                    <li>
                        {t('electricalPipe.thisCircuitListIsShared')}<Link href="/calc/electrical-cable" className="text-blue-600 hover:underline">{t('electricalPipe.cableProgram')}</Link>
                        {' '}{t('electricalPipe.cableLengthBranchCircuitHorizontal')}
                    </li>
                </ul>
            </SheetCard>

            <SheetCard title={t('electricalPipe.electricalConduitLengthSummarySent')}>
                <div className="max-w-lg">
                    <CalcField label={t('electricalPipe.electricalConduitPvc12')} value={outputs.total} unit={t('common.m')} strong />
                    {types.length > 1 && types.map(tot => (
                        <CalcField key={tot} label={t('electricalPipe.ofWhichTotConduit', { tot })} value={outputs[pipeTypeKey(tot)] ?? 0} unit={t('common.m')} />
                    ))}
                </div>
                {types.some(tot => tot !== 'PVC 1/2"') && (
                    <p className="mt-1 text-[12px] text-orange-600">
                        {t('electricalPipe.someCircuitsAreNotPvc')}
                    </p>
                )}
            </SheetCard>
        </>
    );
}
