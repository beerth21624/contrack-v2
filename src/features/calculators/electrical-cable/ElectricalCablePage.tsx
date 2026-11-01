'use client';

import Link from 'next/link';
import {
    CONDUCTOR_COUNTS, electricalCable, sizeKey, WIRE_BUCKETS, WIRE_SIZES,
} from '@/domain/calculators/electrical-cable';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { useCableRows, withWiring, type Calc, type Row } from './cableRows';
import { ElectricalCableJourney } from './ElectricalCableJourney';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const sizeOptions = (t: CalcT) => [{ value: '', label: t('electricalCable.blank') }, ...WIRE_SIZES.map(value => ({ value }))];
const tf = 'border border-gray-200 px-2 py-1 text-[13px]';
const header = (t: CalcT): Record<string, string> => ({ 'THW 1.5': t('electricalCable.thw15M'), 'THW 2.5': t('electricalCable.thw25M'), 'THW 4': t('electricalCable.thw4M'), 'THW 6': t('electricalCable.thw6M') });

export default function ElectricalCablePage() {
    const calc = useCalculator(electricalCable);
    const inJourney = useJourneyMode();
    const { reset, result, isDefault } = calc;

    return (
        <CalculatorShell def={electricalCable} result={result} isDefault={isDefault} onReset={reset}>
            {inJourney ? <ElectricalCableJourney calc={calc} /> : <SheetCable calc={calc} />}
        </CalculatorShell>
    );
}

/** The full Excel-mirror view (/calc). */
function SheetCable({ calc }: { calc: Calc }) {
    const t = useTranslations('calculators');
    const { update, outputs } = calc;
    const { rows } = useCableRows(calc);
    const total = (size: string) => outputs[sizeKey(size)] ?? 0;

    return (
        <>
            <SheetCard title={t('electricalCable.electricalCableLengthQuantityTable')}>
                <EditableTable<Row>
                    rows={rows}
                    onChange={next => update(p => ({
                        ...p, wiring: { ...p.wiring, ...Object.fromEntries(next.map(r => [r.circuit.id, r.wiring])) },
                    }))}
                    canDelete={false}
                    columns={[
                        { kind: 'label', key: 'name', title: t('common.circuit'), width: 260, get: r => <span className="px-1">{r.circuit.name}</span> },
                        { kind: 'label', key: 'breaker', title: t('common.cbSize'), width: 70,
                            get: r => <span className="block text-center">{r.circuit.breaker}</span> },
                        { kind: 'select', key: 'mainSize', title: t('electricalCable.cableSizeBranchCircuitMain'), width: 105, options: sizeOptions(t),
                            get: r => r.wiring.mainSize.trim(), set: (r, v) => withWiring(r, { mainSize: v }) },
                        { kind: 'select', key: 'deviceSize', title: t('electricalCable.cableSizeToEquipment'), width: 105, options: sizeOptions(t),
                            get: r => r.wiring.deviceSize.trim(), set: (r, v) => withWiring(r, { deviceSize: v }) },
                        { kind: 'select', key: 'conductors', title: t('electricalCable.numberOfWiresPcs'), width: 75,
                            options: CONDUCTOR_COUNTS.map(n => ({ value: String(n) })),
                            get: r => (r.wiring.conductors ? String(r.wiring.conductors) : ''),
                            set: (r, v) => withWiring(r, { conductors: Number(v) }) },
                        { kind: 'calc', key: 'main', title: t('electricalCable.cableLengthBranchCircuitM'), width: 95, get: r => r.cable?.main ?? 0 },
                        { kind: 'calc', key: 'device', title: t('electricalCable.cableLengthToEquipmentM'), width: 95, get: r => r.cable?.device ?? 0 },
                        ...WIRE_BUCKETS.map(b => ({
                            kind: 'calc' as const, key: b.column, title: header(t)[b.size] ?? b.size, width: 80,
                            get: (r: Row) => r.cable?.bySize[b.size] ?? 0,
                        })),
                    ]}
                    footer={(
                        <tr style={{ background: SHEET_COLORS.subtotal }}>
                            <td className={`${tf} text-right font-semibold`} colSpan={8}>{t('electricalCable.total')}</td>
                            {WIRE_BUCKETS.map(b => (
                                <td key={b.column} className={`${tf} text-right font-bold tabular-nums`} style={{ background: SHEET_COLORS.calc }}>
                                    {formatNumber(total(b.size))}
                                </td>
                            ))}
                        </tr>
                    )}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>
                        {t('electricalCable.theCircuitsCbSizeAnd')}{' '}
                        <Link href="/calc/electrical-pipe" className="text-blue-600 hover:underline">{t('electricalCable.conduitProgram')}</Link>
                        {' '}{t('electricalCable.addDeleteRenameCircuitsThere')}
                    </li>
                    <li>{t('electricalCable.eachThwSizeBranchCircuit')}</li>
                    <li>{t('electricalCable.thw6HasNoRow')}</li>
                </ul>
                {(outputs.unassigned ?? 0) > 0 && (
                    <p className="mt-1 text-[12px] text-red-500">
                        {t('electricalCable.thereIs')}{formatNumber(outputs.unassigned)} {t('electricalCable.mOfCableWithNo')}
                    </p>
                )}
            </SheetCard>

            <SheetCard title={t('electricalCable.electricalCableLengthSummarySent')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <CalcField label={t('electricalCable.totalThwCable15')} value={total('THW 1.5')} unit={t('common.m')} strong />
                    <CalcField label={t('electricalCable.totalThwCable25')} value={total('THW 2.5')} unit={t('common.m')} strong />
                    <CalcField label={t('electricalCable.totalThwCable4Sq')} value={total('THW 4')} unit={t('common.m')} strong />
                    <CalcField label={t('electricalCable.thw6NoBoqRow')} value={total('THW 6')} unit={t('common.m')} />
                </div>
            </SheetCard>
        </>
    );
}
