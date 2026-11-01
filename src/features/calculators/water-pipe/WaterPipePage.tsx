'use client';

import {
    waterPipe, WATER_PIPE_BOQ_LINES, WATER_PIPE_ITEMS, WATER_PIPE_PLAIN, WATER_PIPE_SIZES, WATER_PIPE_SUBTITLE,
} from '@/domain/calculators/water-pipe';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { PipeRunsSheet } from '../waste-pipe/PipeRunsSheet';
import { useTranslations } from 'next-intl';

export default function WaterPipePage() {
    const t = useTranslations('calculators');
    const { input, update, reset, result, isDefault } = useCalculator(waterPipe);

    return (
        <CalculatorShell def={waterPipe} result={result} isDefault={isDefault} onReset={reset}>
            <PipeRunsSheet def={waterPipe} input={input} onChange={runs => update({ runs })} result={result}
                subtitle={WATER_PIPE_SUBTITLE} items={WATER_PIPE_ITEMS} sizes={WATER_PIPE_SIZES} lines={WATER_PIPE_BOQ_LINES}
                plain={WATER_PIPE_PLAIN} noun={t('waterPipe.waterPipe')} />
        </CalculatorShell>
    );
}
