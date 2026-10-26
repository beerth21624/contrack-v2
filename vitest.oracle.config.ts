import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config';

// Everything, including the slow planning oracle (`npm run test:oracle`).
export default mergeConfig(base, defineConfig({
    test: { exclude: ['**/node_modules/**'], testTimeout: 600_000 },
}));