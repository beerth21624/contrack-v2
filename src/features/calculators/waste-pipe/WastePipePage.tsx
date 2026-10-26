'use client';

import {
    wastePipe, WASTE_PIPE_BOQ_LINES, WASTE_PIPE_ITEMS, WASTE_PIPE_PLAIN, WASTE_PIPE_SIZES, WASTE_PIPE_SUBTITLE,
} from '@/domain/calculators/waste-pipe';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { PipeRunsSheet } from './PipeRunsSheet';

export default function WastePipePage() {
    const { input, update, reset, result, isDefault } = useCalculator(wastePipe);

    return (
        <CalculatorShell def={wastePipe} result={result} isDefault={isDefault} onReset={reset}>
            <PipeRunsSheet def={wastePipe} input={input} onChange={runs => update({ runs })} result={result}
                subtitle={WASTE_PIPE_SUBTITLE} items={WASTE_PIPE_ITEMS} sizes={WASTE_PIPE_SIZES} lines={WASTE_PIPE_BOQ_LINES}
                plain={WASTE_PIPE_PLAIN} noun="ท่อน้ำทิ้ง" />
        </CalculatorShell>
    );
}
