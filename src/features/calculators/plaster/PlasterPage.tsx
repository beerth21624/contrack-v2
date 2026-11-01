'use client';

import { plaster, type PlasterRow } from '@/domain/calculators/plaster';
import { netByPartKey } from '@/domain/calculators/brick';
import type { CalcContext } from '@/domain/calculators/types';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { PlasterTable } from './PlasterTable';
import PlasterJourney from './PlasterJourney';
import { useTranslations } from 'next-intl';

export default function PlasterPage() {
    return useJourneyMode() ? <PlasterJourney /> : <PlasterSheet />;
}

/** The Excel-mirror sheet (/calc/plaster). */
function PlasterSheet() {
    const t = useTranslations('calculators');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(plaster);
    const ctx: CalcContext = { outputs: id => result.calcOutputs[id] };
    const brickNet = (part: string) => result.calcOutputs.brick?.[netByPartKey(part)] ?? 0;

    const setRow = (i: number, patch: Partial<PlasterRow>) =>
        update(p => ({ ...p, rows: p.rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

    return (
        <CalculatorShell def={plaster} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title={t('plaster.plasterQuantityTable')}>
                <PlasterTable rows={input.rows} onChange={rows => update({ rows })} setRow={setRow} ctx={ctx} brickNet={brickNet} />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>{t('plaster.totalNetMasonryAreaOf')}</li>
                    <li>
                        {t('plaster.structuralWallsColumnsBeamsAre')}
                    </li>
                    <li>{t('plaster.exteriorWall1SideInside')}</li>
                </ul>
            </SheetCard>

            <SheetCard title={t('plaster.plasterAreaSummarySentTo')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <CalcField label={t('plaster.wallPlasterWorkExterior')} value={outputs.exterior} unit={t('common.sqM')} strong />
                    <CalcField label={t('plaster.wallPlasterWorkInterior')} value={outputs.interior} unit={t('common.sqM')} strong />
                </div>
            </SheetCard>
        </CalculatorShell>
    );
}
