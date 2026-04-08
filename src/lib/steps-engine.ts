// ─── Backward-compatibility shim ────────────────────────────────────────────
// The monolithic steps-engine.ts has been split into individual modules under
// src/lib/steps/. This file simply re-exports everything so existing imports
// like `import { calcStep1 } from '@/lib/steps-engine'` still work.
//
// New code should import from '@/lib/steps' directly.

export * from './steps';
