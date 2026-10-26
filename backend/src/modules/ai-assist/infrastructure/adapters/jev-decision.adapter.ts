// ─── DecisionPort over the Jev HTTP API (TypeSafe AI): POST {base}/decide with a bearer key ───
// Failures become DomainErrors: 401/403 (key rejected) and 5xx / network / timeout / bad answer → ai_unavailable,
// 402 → ai_quota, 429 → rate_limited, 400 / 413 → unprocessable. 502-504, network errors and timeouts are retried
// once after a short backoff. The key never appears in logs or error messages (only statuses and answer bodies do).
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type Result, err, ok } from '../../../../shared/domain/result';
import {
    type DecisionAnswers, type DecisionOutcome, DecisionPort, type DecisionQuestion, MAX_CHOICE_OPTIONS, decisionAnswerSchema,
} from '../../application/ports/decision.port';

export type FetchLike = (
    url: string,
    init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface JevOptions {
    apiKey: string;
    model: string;
    /** e.g. https://jevtypesafeai.com/api/v1 (with or without a trailing slash). */
    baseUrl: string;
    fetchFn?: FetchLike;
    timeoutMs?: number;
    /** Wait before the single retry. */
    retryDelayMs?: number;
}

const jevResponseSchema = z.object({
    model: z.string(),
    answers: z.record(z.string(), decisionAnswerSchema),
    usage: z.object({
        input_tokens: z.number().int().nonnegative(),
        cost_usd: z.number().nonnegative(),
        credits_remaining_usd: z.number().optional(),
    }).optional(),
});

const unavailable = (message: string): DomainError => new DomainError('ai_unavailable', message);

const RETRY_STATUSES = new Set([502, 503, 504]);

export class JevDecisionAdapter extends DecisionPort {
    private readonly logger = new Logger('JevDecision');
    private readonly fetchFn: FetchLike;
    private readonly timeoutMs: number;
    private readonly retryDelayMs: number;
    private readonly url: string;

    constructor(private readonly options: JevOptions) {
        super();
        this.fetchFn = options.fetchFn ?? ((url, init) => fetch(url, init));
        this.timeoutMs = options.timeoutMs ?? 20_000;
        this.retryDelayMs = options.retryDelayMs ?? 750;
        this.url = `${options.baseUrl.replace(/\/+$/, '')}/decide`;
    }

    async decide(state: unknown, questions: Record<string, DecisionQuestion>): Promise<Result<DecisionOutcome, DomainError>> {
        const tooMany = Object.entries(questions).find(([, q]) => q.type === 'choice' && Object.keys(q.criteria).length > MAX_CHOICE_OPTIONS);
        if (tooMany !== undefined) {
            return err(DomainError.unprocessable(`Question "${tooMany[0]}" has more than ${MAX_CHOICE_OPTIONS} options`));
        }
        const body = JSON.stringify({ model: this.options.model, state, questions });
        let attempt = 0;
        for (;;) {
            const result = await this.call(body);
            if (result.kind === 'answer') return this.parse(result.text, questions);
            if (result.kind === 'fail') return err(result.error);
            attempt += 1;
            if (attempt > 1) return err(result.error);
            this.logger.warn(`${result.error.message}; retrying once`);
            await sleep(this.retryDelayMs);
        }
    }

    /** One HTTP round trip: the answer body, a final failure, or a failure worth one retry. */
    private async call(body: string): Promise<{ kind: 'answer'; text: string } | { kind: 'fail' | 'retry'; error: DomainError }> {
        const controller = new AbortController();
        const timer = setTimeout(() => { controller.abort(); }, this.timeoutMs);
        try {
            const res = await this.fetchFn(this.url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.options.apiKey}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body,
                signal: controller.signal,
            });
            const text = await res.text();
            if (res.ok) return { kind: 'answer', text };
            const detail = text.slice(0, 200);
            this.logger.warn(`Jev answered ${res.status}${detail === '' ? '' : `: ${detail}`}`);
            return this.failure(res.status);
        } catch (e: unknown) {
            const reason = controller.signal.aborted ? `no answer within ${this.timeoutMs} ms` : (e instanceof Error ? e.message : String(e));
            return { kind: 'retry', error: unavailable(`Decision model unreachable: ${reason}`) };
        } finally {
            clearTimeout(timer);
        }
    }

    private failure(status: number): { kind: 'fail' | 'retry'; error: DomainError } {
        if (RETRY_STATUSES.has(status)) return { kind: 'retry', error: unavailable(`Decision model answered ${status}`) };
        switch (status) {
            case 400: return { kind: 'fail', error: DomainError.unprocessable('The decision model rejected the request') };
            case 401:
            case 403: return { kind: 'fail', error: unavailable('The decision model rejected the server\'s API key') };
            case 402: return { kind: 'fail', error: new DomainError('ai_quota', 'The decision model account has no credits left') };
            case 413: return { kind: 'fail', error: DomainError.unprocessable('Too much text for the decision model in one request') };
            case 429: return { kind: 'fail', error: new DomainError('rate_limited', 'The decision model is rate limiting this server') };
            default: return { kind: 'fail', error: unavailable(`Decision model answered ${status}`) };
        }
    }

    /** The validated outcome: every question answered, with the type it asked for. */
    private parse(text: string, questions: Record<string, DecisionQuestion>): Result<DecisionOutcome, DomainError> {
        let json: unknown;
        try {
            json = JSON.parse(text);
        } catch {
            return err(unavailable('The decision model did not answer with JSON'));
        }
        const parsed = jevResponseSchema.safeParse(json);
        if (!parsed.success) {
            this.logger.warn(`Jev answer failed validation: ${parsed.error.issues.map(i => i.path.join('.')).join(', ')}`);
            return err(unavailable('The decision model answered in an unexpected shape'));
        }
        const answers: DecisionAnswers = {};
        for (const [name, question] of Object.entries(questions)) {
            const answer = parsed.data.answers[name];
            if (answer?.type !== question.type) {
                return err(unavailable(`The decision model did not answer question "${name}" as ${question.type}`));
            }
            answers[name] = answer;
        }
        return ok({
            model: parsed.data.model,
            answers,
            usage: { inputTokens: parsed.data.usage?.input_tokens ?? 0, costUsd: parsed.data.usage?.cost_usd ?? 0 },
        });
    }
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
