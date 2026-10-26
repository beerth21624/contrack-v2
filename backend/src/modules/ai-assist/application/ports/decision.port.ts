// ─── Outbound port: a decision model that answers typed questions (choice / score / noul) about a JSON state ───
// Never free text: every answer is one of the shapes below, validated with zod before the use cases see it.
// Expected failures (not configured, unreachable, out of credits, request too large) come back as a DomainError.
import { z } from 'zod';
import type { DomainError } from '../../../../shared/domain/domain-error';
import type { Result } from '../../../../shared/domain/result';

/** The model's `choice` type takes at most this many options (criteria keys). */
export const MAX_CHOICE_OPTIONS = 255;

export type DecisionQuestion =
    /** Pick one key of `criteria`; each value describes the option. */
    | { type: 'choice'; instructions: string; criteria: Record<string, string> }
    /** Pick a point on an ordered scale; `criteria` are the labels, lowest first. */
    | { type: 'score'; instructions: string; criteria: string[] }
    /** A probability (0–1) that the statement in `instructions` holds. */
    | { type: 'noul'; instructions: string };

const probabilities = z.record(z.string(), z.number().min(0).max(1));

export const choiceAnswerSchema = z.object({
    type: z.literal('choice'),
    choice: z.string(),
    confidence: z.number().min(0).max(1),
    probabilities,
});
export const scoreAnswerSchema = z.object({
    type: z.literal('score'),
    score: z.number().finite(),
    probabilities,
});
export const noulAnswerSchema = z.object({
    type: z.literal('noul'),
    noul: z.number().min(0).max(1),
});
export const decisionAnswerSchema = z.discriminatedUnion('type', [choiceAnswerSchema, scoreAnswerSchema, noulAnswerSchema]);

export type ChoiceAnswer = z.infer<typeof choiceAnswerSchema>;
export type ScoreAnswer = z.infer<typeof scoreAnswerSchema>;
export type NoulAnswer = z.infer<typeof noulAnswerSchema>;
export type DecisionAnswer = z.infer<typeof decisionAnswerSchema>;
export type DecisionAnswers = Record<string, DecisionAnswer>;

export interface DecisionUsage {
    inputTokens: number;
    costUsd: number;
}

export interface DecisionOutcome {
    /** Model version that answered, e.g. "jev-1.14.0". */
    model: string;
    /** One answer per question name, of the type the question asked for. */
    answers: DecisionAnswers;
    usage: DecisionUsage;
}

export abstract class DecisionPort {
    /**
     * Asks every question about `state` in one call. Errors: `ai_unavailable` (not configured / unreachable / bad answer),
     * `ai_quota` (no credits), `rate_limited`, `unprocessable` (too large for the model or rejected by it).
     */
    abstract decide(state: unknown, questions: Record<string, DecisionQuestion>): Promise<Result<DecisionOutcome, DomainError>>;
}

/** A question's answer when it has the type the question asked for; undefined otherwise. */
export function answerOf<T extends DecisionQuestion['type']>(
    answers: DecisionAnswers, name: string, type: T,
): Extract<DecisionAnswer, { type: T }> | undefined {
    const a = answers[name];
    return a?.type === type ? (a as Extract<DecisionAnswer, { type: T }>) : undefined;
}
