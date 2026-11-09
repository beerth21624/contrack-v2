// Dev mode ("calculation check mode") — public API. See docs/dev-mode/README.md.
export * from './types';
export { NO_TRACE, RecordingTracer, type Tracer, type StepOptions, type ConstantOptions, type RecordedConstant } from './tracer';
export { classifyInputs, invalidInputPaths, recordingContext, type DependencyReads } from './sources';
export { fillParams, plainNumber, renderStep, termLabel, termUnit, traceLabelSet, type NumberFormat, type RenderedStep, type TraceLocale } from './labels';
export { runTrace, type RunTraceOptions } from './run';
export { explainBoq, explainCell, type ExplainBoqInput } from './explain-boq';
export { explainProjectBoq, projectTraceBase, traceProjectCalculator, type ProjectTraceBase } from './project';
