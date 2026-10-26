// ─── Scripted DecisionPort for unit specs and the in-memory / e2e app (NODE_ENV=test) ───
// Answers come from `answer(name, …)` (by question name), else from `answerWith(fn)`, else a neutral default per
// question type. With nothing scripted at all it answers `ai_unavailable`, like a server without a key.
import { DomainError } from '../../../shared/domain/domain-error';
import { type Result, err, ok } from '../../../shared/domain/result';
import {
    type ChoiceAnswer, type DecisionAnswer, type DecisionOutcome, DecisionPort, type DecisionQuestion, type DecisionUsage, type NoulAnswer,
} from '../application/ports/decision.port';

export interface RecordedCall {
    state: unknown;
    questions: Record<string, DecisionQuestion>;
}

export type AnswerFn = (name: string, question: DecisionQuestion, state: unknown) => DecisionAnswer | undefined;

/** A `choice` answer: the chosen key gets `confidence`, the rest share what is left (or `probabilities` as given). */
export function choice(key: string, confidence = 0.95, probabilities?: Record<string, number>): ChoiceAnswer {
    return { type: 'choice', choice: key, confidence, probabilities: probabilities ?? { [key]: confidence } };
}

export function noul(probability: number): NoulAnswer {
    return { type: 'noul', noul: probability };
}

export class FakeDecisionAdapter extends DecisionPort {
    model = 'jev-fake';
    usagePerCall: DecisionUsage = { inputTokens: 100, costUsd: 0.00005 };
    readonly calls: RecordedCall[] = [];
    private readonly scripted = new Map<string, DecisionAnswer>();
    private fallback: AnswerFn | undefined;
    private failure: DomainError | undefined;

    /** Scripts the answer to one question name. */
    answer(name: string, answer: DecisionAnswer): this {
        this.scripted.set(name, answer);
        return this;
    }

    /** Answers every question not scripted by name (return undefined for the neutral default). */
    answerWith(fn: AnswerFn): this {
        this.fallback = fn;
        return this;
    }

    /** Every call fails with this error until `reset`. */
    failWith(error: DomainError): this {
        this.failure = error;
        return this;
    }

    reset(): void {
        this.scripted.clear();
        this.fallback = undefined;
        this.failure = undefined;
        this.calls.length = 0;
    }

    decide(state: unknown, questions: Record<string, DecisionQuestion>): Promise<Result<DecisionOutcome, DomainError>> {
        this.calls.push({ state, questions });
        if (this.failure !== undefined) return Promise.resolve(err(this.failure));
        if (this.scripted.size === 0 && this.fallback === undefined) {
            return Promise.resolve(err(new DomainError('ai_unavailable', 'No decision model answers scripted (FakeDecisionAdapter)')));
        }
        const answers: Record<string, DecisionAnswer> = {};
        for (const [name, question] of Object.entries(questions)) {
            const scripted = this.scripted.get(name) ?? this.fallback?.(name, question, state);
            answers[name] = scripted?.type === question.type ? scripted : neutral(question);
        }
        return Promise.resolve(ok({ model: this.model, answers, usage: { ...this.usagePerCall } }));
    }
}

/** "Nothing to report": `none` when offered (else the first option), the lowest score, probability 0. */
function neutral(question: DecisionQuestion): DecisionAnswer {
    switch (question.type) {
        case 'choice': {
            const keys = Object.keys(question.criteria);
            const key = keys.includes('none') ? 'none' : keys[0] ?? 'none';
            return { type: 'choice', choice: key, confidence: 1, probabilities: { [key]: 1 } };
        }
        case 'score':
            return { type: 'score', score: 0, probabilities: { 0: 1 } };
        case 'noul':
            return { type: 'noul', noul: 0 };
    }
}
