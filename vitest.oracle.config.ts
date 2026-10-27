import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config';

// Everything, including the slow planning oracle (`npm run test:oracle`).
// mergeConfig concatenates arrays, so the base `exclude` (which lists the slow oracle) is replaced afterwards.
const merged = mergeConfig(base, defineConfig({ test: { testTimeout: 600_000 } }));
export default { ...merged, test: { ...merged.test, exclude: ['**/node_modules/**'] } };
