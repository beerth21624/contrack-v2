// ─── runTrace: run one calculator with a recording tracer and assemble its CalcTrace (docs/dev-mode/README.md §3) ───
// Works for every calculator: one that does not call the tracer yet still gets its inputs (with sources), outputs,
// BOQ links, slot rows, dependency info and warnings — only `steps` stays empty.
import { BOQ_TEMPLATE_V5 } from '../boq/template.v5';
import type { BoqLineKey, BoqLineOverride, BoqResult } from '../boq/types';
import { CALCULATORS, getCalculator } from '../calculators/registry';
import type { CalcContext, CalculatorDef } from '../calculators/types';
import { RecordingTracer } from './tracer';
import { classifyInputs, invalidInputPaths, recordingContext } from './sources';
import type { CalcTrace, TraceBoqLink, TraceDependency, TraceInput, TraceOutput, TraceSlotRow, TraceWarning } from './types';

export interface RunTraceOptions {
    /** BOQ page edits (to tell when an edit replaces an output). */
    overrides?: Record<BoqLineKey, BoqLineOverride | undefined>;
    /** The computed BOQ, for the item number / description / unit of linked lines (else the template's). */
    boq?: BoqResult;
    /** The step is marked "not in this project". */
    skipped?: boolean;
    /**
     * Input of another calculator, used to find which of this step's outputs the steps that depend on it read
     * (TraceOutput.usedBy). Without it `usedBy` stays empty and only `dependents` is filled.
     */
    inputOf?: (def: CalculatorDef) => unknown;
    /** Calculators to look for dependents in (default: all). */
    calculators?: readonly CalculatorDef[];
}

interface LineInfo { itemNo?: string; desc: string; unit?: string; qty?: number | null }

/** Item no / description / unit of every line: computed rows first, then the template (slot fallbacks included). */
function lineInfo(boq: BoqResult | undefined): Map<BoqLineKey, LineInfo> {
    const m = new Map<BoqLineKey, LineInfo>();
    for (const s of BOQ_TEMPLATE_V5) {
        for (const l of s.lines) {
            const list = l.type === 'slot' ? l.fallback : [l];
            for (const x of list) {
                const info: LineInfo = { desc: x.desc };
                if (x.itemNo !== undefined) info.itemNo = x.itemNo;
                if (x.type === 'item') info.unit = x.unit;
                m.set(x.key, info);
            }
        }
    }
    for (const s of boq?.sections ?? []) {
        for (const r of s.rows) {
            const info: LineInfo = { desc: r.desc };
            if (r.itemNo !== undefined) info.itemNo = r.itemNo;
            if (r.type === 'item') { info.unit = r.unit; info.qty = r.qty; }
            m.set(r.key, info);
        }
    }
    return m;
}

const resolve = (calc: string | CalculatorDef): CalculatorDef => {
    if (typeof calc !== 'string') return calc;
    const def = getCalculator(calc);
    if (!def) throw new Error(`Unknown calculator ${calc}`);
    return def;
};

/**
 * Runs `calc.compute(input, ctx, tracer)` and builds the trace. The outputs are exactly what compute returns
 * without a tracer (the tracer only observes).
 */
export function runTrace(calc: string | CalculatorDef, input: unknown, ctx: CalcContext, opts: RunTraceOptions = {}): CalcTrace {
    const def = resolve(calc);
    const tr = new RecordingTracer();
    const rec = recordingContext(ctx);
    const outputs = def.compute(input, rec.ctx, tr);
    const info = lineInfo(opts.boq);
    const overrides = opts.overrides ?? {};
    const skipped = opts.skipped === true;

    // ① inputs: plain values with ✎/⚠, then 🔒 constants, then ← dependency values.
    const inputs: TraceInput[] = classifyInputs(input, def.defaults());
    for (const c of tr.constants) {
        const t: TraceInput = { path: `const:${c.key}`, term: c.id, value: c.value, source: 'constant' };
        if (c.params !== undefined) t.params = c.params;
        inputs.push(t);
    }
    const deps: TraceDependency[] = [];
    const depIds = new Set([...def.deps, ...rec.reads.read.keys()]);
    for (const dep of depIds) {
        const read = [...(rec.reads.read.get(dep) ?? [])].sort();
        deps.push({ calc: dep, available: !rec.reads.unavailable.has(dep) && ctx.outputs(dep) !== undefined, read });
        for (const key of read) {
            const v = rec.reads.values.get(`${dep}\u0000${key}`);
            inputs.push({ path: `dep:${dep}:${key}`, term: key, value: v ?? 0, source: 'dependency', from: { calc: dep, output: key } });
        }
    }

    // ③ outputs → BOQ lines and other steps.
    const linksOf = new Map<string, TraceBoqLink[]>();
    for (const link of def.boqLinks) {
        const v = outputs[link.output];
        const li = info.get(link.line);
        const ov = overrides[link.line];
        const ovValue = ov?.[link.field];
        // Same precedence as computeBoq: a qty edit always wins; a price edit wins when it is a finite number.
        const overridden = !skipped && (link.field === 'qty' ? ovValue !== undefined : ovValue !== undefined && Number.isFinite(ovValue));
        const l: TraceBoqLink = {
            line: link.line, field: link.field, desc: li?.desc ?? link.line, overridden,
            applied: !skipped && v !== undefined && Number.isFinite(v),
        };
        if (li?.itemNo !== undefined) l.itemNo = li.itemNo;
        if (li?.unit !== undefined) l.unit = li.unit;
        linksOf.set(link.output, [...(linksOf.get(link.output) ?? []), l]);
    }

    const calculators = opts.calculators ?? CALCULATORS;
    const dependents = calculators.filter(c => c.deps.includes(def.id)).map(c => c.id);
    const usedBy = new Map<string, string[]>();
    if (opts.inputOf) {
        for (const other of calculators) {
            if (!other.deps.includes(def.id)) continue;
            // Run the dependent with this step's outputs (and the real context for its other deps) to see what it reads.
            const r = recordingContext({ outputs: id => (id === def.id ? outputs : ctx.outputs(id)) });
            try { other.compute(opts.inputOf(other), r.ctx); } catch { continue; }
            for (const key of r.reads.read.get(def.id) ?? []) usedBy.set(key, [...(usedBy.get(key) ?? []), other.id]);
        }
    }

    const outs: TraceOutput[] = Object.entries(outputs).map(([key, value]) => ({
        key, value, links: linksOf.get(key) ?? [], usedBy: usedBy.get(key) ?? [],
    }));

    // Rows the calculator supplies itself (rebar sizes, doors …).
    const slotRows: TraceSlotRow[] = [];
    for (const [slot, list] of Object.entries(def.boqSlots?.(input, ctx) ?? {})) {
        for (const r of list) {
            const line = `${def.id}:${slot}:${r.key}`;
            const computed = info.get(line);
            const qty = computed?.qty !== undefined ? computed.qty
                : r.type === 'item' && r.qty.kind === 'input' ? r.qty.value : null;
            const sr: TraceSlotRow = { slot, line, desc: r.desc, unit: r.type === 'item' ? r.unit : '', qty: skipped ? 0 : qty };
            if (r.itemNo !== undefined) sr.itemNo = r.itemNo;
            slotRows.push(sr);
        }
    }

    // ⚠ things to check.
    const warnings: TraceWarning[] = [];
    if (skipped) warnings.push({ kind: 'skipped' });
    const defaultsInUse = inputs.filter(i => i.source === 'default').map(i => i.path);
    if (defaultsInUse.length > 0) warnings.push({ kind: 'defaultsInUse', paths: defaultsInUse });
    for (const d of deps) {
        const missing = d.read.filter(k => rec.reads.values.get(`${d.calc}\u0000${k}`) === undefined);
        if (!d.available || missing.length > 0) warnings.push({ kind: 'dependencyMissing', calc: d.calc, outputs: d.available ? missing : d.read });
    }
    const invalid = invalidInputPaths(inputs);
    if (invalid.length > 0) warnings.push({ kind: 'invalidInput', paths: invalid });
    const badOutputs = outs.filter(o => !Number.isFinite(o.value)).map(o => o.key);
    if (badOutputs.length > 0) warnings.push({ kind: 'invalidOutput', outputs: badOutputs });
    for (const o of outs) {
        for (const l of o.links) {
            if (!l.overridden) continue;
            const w: TraceWarning = { kind: 'boqOverride', output: o.key, line: l.line, field: l.field, desc: l.desc };
            if (l.itemNo !== undefined) w.itemNo = l.itemNo;
            warnings.push(w);
        }
    }

    return {
        calcId: def.id,
        instrumented: def.traceLabels !== undefined,
        inputs,
        steps: tr.steps,
        outputs: outs,
        slotRows,
        deps,
        dependents,
        warnings,
    };
}
