import { defineConfig } from 'vitest/config';
import path from 'node:path';

/** The planning oracle (Man-Day / S-Curve / CashFlow against the real workbook, ~4 min) runs with `npm run test:oracle`. */
export const SLOW_ORACLE = 'src/domain/planning/__tests__/planning.oracle.slow.test.ts';

export default defineConfig({
    resolve: {
        alias: { '@': path.resolve(__dirname, 'src') },
    },
    test: {
        include: ['src/**/*.test.ts'],
        exclude: ['**/node_modules/**', SLOW_ORACLE],
        environment: 'node',
    },
});