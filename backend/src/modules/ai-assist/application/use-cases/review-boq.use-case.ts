// ─── Use case: flag BOQ rows that look inconsistent (one noul + one choice question per row) ───
// The model never computes numbers: it only says how likely a row is wrong and which kind of problem is most visible.
// Rows are sent in chunks (≤ REVIEW_CHUNK_ROWS rows = 2 × that many questions): Jev refuses more than 50 questions
// per call (400 "Too many questions (max 50)", not in its docs) and this also keeps each call well under the token
// limits; chunks run with bounded concurrency. Only rows with probability ≥ AI_REVIEW_MIN are returned.
import { Injectable } from '@nestjs/common';
import {
    AI_FINDING_KIND_LABEL, AI_REVIEW_MIN, type AiFinding, type AiFindingKind, type BoqReviewRequest, type BoqReviewResponse,
    type BoqReviewRow, aiFindingKindSchema,
} from '@contrack/contract';
import { type DomainError, type Result, type UserId, type WorkspaceId, ok } from '../../../../shared/domain';
import { chunk, mapConcurrent } from '../../shared/concurrency';
import { AiAccess } from '../../shared/ai-access';
import { type DecisionAnswers, type DecisionOutcome, DecisionPort, type DecisionQuestion, answerOf } from '../ports/decision.port';

/** Rows per model call (2 questions each). */
/** 25 rows × 2 questions = 50, the model's hard cap on questions per call. */
export const REVIEW_CHUNK_ROWS = 25;
/** Model calls in flight at once. */
export const REVIEW_CONCURRENCY = 3;
/** The `choice` option meaning "this row looks fine". */
export const NO_FINDING = 'none';

export interface ReviewBoqInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
    request: BoqReviewRequest;
}

export const flagQuestionName = (key: string): string => `${key}_flag`;
export const kindQuestionName = (key: string): string => `${key}_kind`;

/** The two questions about one row (wording tuned in a live test; keep it close). */
export function reviewQuestions(rows: readonly BoqReviewRow[]): Record<string, DecisionQuestion> {
    const criteria: Record<string, string> = { ...AI_FINDING_KIND_LABEL, [NO_FINDING]: 'ไม่พบความผิดปกติ' };
    const questions: Record<string, DecisionQuestion> = {};
    for (const row of rows) {
        questions[flagQuestionName(row.key)] = {
            type: 'noul',
            instructions: `พิจารณาเฉพาะแถว key="${row.key}" ใน state.rows: แถวนี้มีความไม่สอดคล้องภายใน (หน่วยไม่ตรงกับรายการ, `
                + 'หมายเหตุขัดกับปริมาณ/ราคา, เผื่อเสียผิดปกติ, ราคาวัสดุ/ค่าแรงเป็น 0 ทั้งที่ควรมี, ปริมาณไม่สมเหตุสมผลกับขนาดบ้านใน state.project) '
                + 'หรือไม่? ค่าที่ derived เป็น true ถูกคำนวณจากแถวอื่น ห้ามถือว่าเป็น 0 หรือขาด',
        };
        questions[kindQuestionName(row.key)] = {
            type: 'choice',
            instructions: `พิจารณาเฉพาะแถว key="${row.key}" ใน state.rows: ความผิดปกติที่เด่นชัดที่สุดของแถวนี้คือประเภทใด (เลือก none ถ้าแถวดูปกติ)`,
            criteria,
        };
    }
    return questions;
}

/** The most probable kind that is a real finding (not `none`), with its probability. */
function mostProbableKind(probabilities: Record<string, number>): { kind: AiFindingKind; probability: number } | undefined {
    let best: { kind: AiFindingKind; probability: number } | undefined;
    for (const [key, probability] of Object.entries(probabilities)) {
        const kind = aiFindingKindSchema.safeParse(key);
        if (!kind.success) continue;
        if (best === undefined || probability > best.probability) best = { kind: kind.data, probability };
    }
    return best;
}

/** Findings of the rows in `rows` from the model's answers: probability ≥ AI_REVIEW_MIN, most probable first. */
export function findingsFrom(rows: readonly BoqReviewRow[], answers: DecisionAnswers): AiFinding[] {
    const findings: AiFinding[] = [];
    for (const row of rows) {
        const flag = answerOf(answers, flagQuestionName(row.key), 'noul');
        if (flag === undefined || flag.noul < AI_REVIEW_MIN) continue;
        const choice = answerOf(answers, kindQuestionName(row.key), 'choice');
        if (choice === undefined) continue;
        const chosen = aiFindingKindSchema.safeParse(choice.choice);
        if (chosen.success) {
            findings.push({ key: row.key, kind: chosen.data, probability: flag.noul, kindConfidence: choice.confidence });
            continue;
        }
        // The row is likely wrong but the model picked `none` (or an unknown option): take the most probable real kind.
        const fallback = mostProbableKind(choice.probabilities);
        if (fallback === undefined) continue;
        findings.push({ key: row.key, kind: fallback.kind, probability: flag.noul, kindConfidence: fallback.probability });
    }
    // Stable: ties keep BOQ order.
    return findings.sort((a, b) => b.probability - a.probability);
}

@Injectable()
export class ReviewBoqUseCase {
    constructor(private readonly access: AiAccess, private readonly decisions: DecisionPort) {}

    async execute(input: ReviewBoqInput): Promise<Result<BoqReviewResponse, DomainError>> {
        const access = await this.access.member(input.actorId, input.workspaceId);
        if (!access.ok) return access;
        const { project, rows } = input.request;
        const outcomes = await mapConcurrent(chunk(rows, REVIEW_CHUNK_ROWS), REVIEW_CONCURRENCY,
            part => this.decisions.decide({ project, rows: part }, reviewQuestions(part)));
        const results: DecisionOutcome[] = [];
        for (const outcome of outcomes) {
            if (!outcome.ok) return outcome;
            results.push(outcome.value);
        }
        return ok(combine(rows, results));
    }
}

function combine(rows: readonly BoqReviewRow[], outcomes: readonly DecisionOutcome[]): BoqReviewResponse {
    const answers: DecisionAnswers = {};
    for (const o of outcomes) Object.assign(answers, o.answers);
    const usage = outcomes.reduce((sum, o) => ({ inputTokens: sum.inputTokens + o.usage.inputTokens, costUsd: sum.costUsd + o.usage.costUsd }),
        { inputTokens: 0, costUsd: 0 });
    return { model: outcomes[0]?.model ?? '', findings: findingsFrom(rows, answers), usage };
}
