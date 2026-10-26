// ─── "ตรวจ BOQ ก่อนส่ง": the pure part of the review list ───
// Deterministic rules (@/domain/boq/review) and the decision model (contract ai-assist.ts) each produce findings;
// this file turns model answers into list lines and merges both into one list. No React, no network, no numbers
// changed: a finding is a read-only hint pointing at a BOQ row.
import {
    AI_FINDING_KIND_LABEL, AI_REVIEW_ERROR, AI_REVIEW_WARN,
    type AiFinding, type BoqReviewFinding, type BoqReviewRow,
} from '@/shared/contract/ai-assist';

/** Severity of a model finding by its probability; undefined = below AI_REVIEW_WARN, not shown. */
export function aiSeverity(probability: number): BoqReviewFinding['severity'] | undefined {
    if (probability >= AI_REVIEW_ERROR) return 'error';
    if (probability >= AI_REVIEW_WARN) return 'warn';
    return undefined;
}

/** Row description by key, so a model finding can name its row ("คอนกรีตโครงสร้าง — ..."). */
export function rowDescriptions(rows: readonly BoqReviewRow[]): ReadonlyMap<string, string> {
    return new Map(rows.map(r => [r.key, r.desc]));
}

/**
 * A finding about a value the engine derived from other rows (tie wire has no net qty, consumables are a
 * percentage of other lines): there is nothing on that row for the user to fix, so it is not shown even when the
 * model flags it (the model is told about `derived` but does not always honour it).
 */
export function targetsDerivedValue(f: AiFinding, row: BoqReviewRow | undefined): boolean {
    if (row === undefined) return false;
    if (f.kind === 'qty' || f.kind === 'waste') return row.derived.qty;
    if (f.kind === 'price') return row.derived.mat || row.derived.lab;
    return false;
}

/**
 * Model findings as list lines: `${row desc} — ${kind label}`, severity from the probability, anything below
 * AI_REVIEW_WARN or about a derived value dropped. A finding whose row is unknown names the key instead.
 */
export function aiToFindings(findings: readonly AiFinding[], rows: readonly BoqReviewRow[]): BoqReviewFinding[] {
    const desc = rowDescriptions(rows);
    const byKey = new Map(rows.map(r => [r.key, r]));
    const out: BoqReviewFinding[] = [];
    for (const f of findings) {
        const severity = aiSeverity(f.probability);
        if (severity === undefined) continue;
        if (targetsDerivedValue(f, byKey.get(f.key))) continue;
        const name = (desc.get(f.key) ?? '').trim() || f.key;
        out.push({
            key: f.key,
            source: 'ai',
            severity,
            kind: f.kind,
            message: `${name} — ${AI_FINDING_KIND_LABEL[f.kind]}`,
            probability: f.probability,
        });
    }
    return out;
}

const RANK: Record<BoqReviewFinding['severity'], number> = { error: 0, warn: 1 };

/**
 * One list: errors first, then warnings; inside a severity the given order (rules in BOQ order, then model
 * findings most probable first). The same row + kind appears once: the first (most severe, then earliest) wins.
 */
export function mergeFindings(rules: readonly BoqReviewFinding[], ai: readonly BoqReviewFinding[]): BoqReviewFinding[] {
    const all = [...rules, ...ai];
    const ordered = all.map((f, i) => ({ f, i }))
        .sort((a, b) => RANK[a.f.severity] - RANK[b.f.severity] || a.i - b.i)
        .map(x => x.f);
    const seen = new Set<string>();
    return ordered.filter(f => {
        const id = `${f.key}\u0000${f.kind}`;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });
}

/** How many of each severity (the panel's header line). */
export function countBySeverity(findings: readonly BoqReviewFinding[]): { errors: number; warns: number } {
    let errors = 0;
    let warns = 0;
    for (const f of findings) {
        if (f.severity === 'error') errors += 1; else warns += 1;
    }
    return { errors, warns };
}

/** "AI 91%": the model's probability for the small tag. */
export const aiPercent = (probability: number): string => `AI ${String(Math.round(probability * 100))}%`;
