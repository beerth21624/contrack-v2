import { Logger } from '@nestjs/common';
import type { DecisionQuestion } from '../../application/ports/decision.port';
import { type FetchLike, JevDecisionAdapter } from './jev-decision.adapter';

const KEY = 'sk-test-key-never-logged';

interface Scripted { status: number; body: unknown }
interface Recorded { url: string; init: Parameters<FetchLike>[1] }

/** A fetch that answers the scripted responses in order (500 with an empty body once they run out). */
function fetchStub(responses: Scripted[]): { fn: FetchLike; calls: Recorded[] } {
    const calls: Recorded[] = [];
    const fn: FetchLike = (url, init) => {
        calls.push({ url, init });
        const r = responses.shift() ?? { status: 500, body: '' };
        return Promise.resolve({
            ok: r.status >= 200 && r.status < 300,
            status: r.status,
            text: () => Promise.resolve(typeof r.body === 'string' ? r.body : JSON.stringify(r.body)),
        });
    };
    return { fn, calls };
}

const adapter = (fn: FetchLike, timeoutMs = 1000): JevDecisionAdapter =>
    new JevDecisionAdapter({ apiKey: KEY, model: 'jev-1.14.0', baseUrl: 'https://jev.test/api/v1/', fetchFn: fn, timeoutMs, retryDelayMs: 0 });

const QUESTIONS: Record<string, DecisionQuestion> = {
    kind: { type: 'choice', instructions: 'which kind', criteria: { billing: 'money', bug: 'broken' } },
    severity: { type: 'score', instructions: 'how bad', criteria: ['low', 'mid', 'high'] },
    urgent: { type: 'noul', instructions: 'is it urgent' },
};
const GOOD = {
    model: 'jev-1.14.0',
    answers: {
        kind: { type: 'choice', choice: 'billing', confidence: 0.99, probabilities: { billing: 0.99, bug: 0.01 } },
        severity: { type: 'score', score: 3, probabilities: { 0: 0, 3: 1 } },
        urgent: { type: 'noul', noul: 0.94 },
    },
    usage: { input_tokens: 62, cost_usd: 0.000026, credits_remaining_usd: 4.99 },
};

const codeOf = (r: Awaited<ReturnType<JevDecisionAdapter['decide']>>): string => (r.ok ? 'ok' : r.error.code);

describe('JevDecisionAdapter', () => {
    beforeAll(() => { Logger.overrideLogger(false); });

    it('POSTs {model, state, questions} to /decide with the bearer key and maps the answer', async () => {
        const { fn, calls } = fetchStub([{ status: 200, body: GOOD }]);
        const r = await adapter(fn).decide({ ticket: 'ใบแจ้งหนี้ผิด' }, QUESTIONS);
        if (!r.ok) throw new Error(r.error.code);
        expect(r.value).toEqual({
            model: 'jev-1.14.0',
            answers: GOOD.answers,
            usage: { inputTokens: 62, costUsd: 0.000026 },
        });
        expect(calls).toHaveLength(1);
        const [call] = calls;
        expect(call!.url).toBe('https://jev.test/api/v1/decide');
        expect(call!.init.method).toBe('POST');
        expect(call!.init.headers).toMatchObject({ Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' });
        expect(JSON.parse(call!.init.body)).toEqual({ model: 'jev-1.14.0', state: { ticket: 'ใบแจ้งหนี้ผิด' }, questions: QUESTIONS });
        expect(call!.init.signal).toBeInstanceOf(AbortSignal);
    });

    it('maps 402 → ai_quota, 429 → rate_limited, 400 / 413 → unprocessable, 401 → ai_unavailable (key never in the message)', async () => {
        for (const [status, code] of [[402, 'ai_quota'], [429, 'rate_limited'], [400, 'unprocessable'], [413, 'unprocessable'], [401, 'ai_unavailable'], [500, 'ai_unavailable']] as const) {
            const { fn, calls } = fetchStub([{ status, body: { error: 'nope' } }]);
            const r = await adapter(fn).decide({}, QUESTIONS);
            expect(codeOf(r)).toBe(code);
            if (r.ok) throw new Error('expected an error');
            expect(r.error.message).not.toContain(KEY);
            expect(calls).toHaveLength(1);
        }
    });

    it('retries once after a 502 and succeeds; two 502s → ai_unavailable', async () => {
        const once = fetchStub([{ status: 502, body: 'bad gateway' }, { status: 200, body: GOOD }]);
        expect(codeOf(await adapter(once.fn).decide({}, QUESTIONS))).toBe('ok');
        expect(once.calls).toHaveLength(2);
        const twice = fetchStub([{ status: 502, body: '' }, { status: 503, body: '' }]);
        expect(codeOf(await adapter(twice.fn).decide({}, QUESTIONS))).toBe('ai_unavailable');
        expect(twice.calls).toHaveLength(2);
    });

    it('retries once on a network error, and gives up as ai_unavailable when the timeout aborts the request', async () => {
        let calls = 0;
        const hanging: FetchLike = (_url, init) => {
            calls += 1;
            return new Promise((_, reject) => { init.signal.addEventListener('abort', () => { reject(new Error('aborted')); }); });
        };
        const r = await adapter(hanging, 20).decide({}, QUESTIONS);
        expect(codeOf(r)).toBe('ai_unavailable');
        expect(calls).toBe(2);
        let failing = 0;
        const network: FetchLike = () => { failing += 1; return Promise.reject(new Error('ECONNRESET')); };
        expect(codeOf(await adapter(network).decide({}, QUESTIONS))).toBe('ai_unavailable');
        expect(failing).toBe(2);
    });

    it('validates the answer: not JSON, wrong shape, a missing question or a wrong answer type → ai_unavailable', async () => {
        expect(codeOf(await adapter(fetchStub([{ status: 200, body: '<html>' }]).fn).decide({}, QUESTIONS))).toBe('ai_unavailable');
        expect(codeOf(await adapter(fetchStub([{ status: 200, body: { answers: {} } }]).fn).decide({}, QUESTIONS))).toBe('ai_unavailable');
        const missing = { ...GOOD, answers: { kind: GOOD.answers.kind, severity: GOOD.answers.severity } };
        expect(codeOf(await adapter(fetchStub([{ status: 200, body: missing }]).fn).decide({}, QUESTIONS))).toBe('ai_unavailable');
        const wrongType = { ...GOOD, answers: { ...GOOD.answers, urgent: GOOD.answers.kind } };
        expect(codeOf(await adapter(fetchStub([{ status: 200, body: wrongType }]).fn).decide({}, QUESTIONS))).toBe('ai_unavailable');
        const badProbability = { ...GOOD, answers: { ...GOOD.answers, urgent: { type: 'noul', noul: 1.5 } } };
        expect(codeOf(await adapter(fetchStub([{ status: 200, body: badProbability }]).fn).decide({}, QUESTIONS))).toBe('ai_unavailable');
    });

    it('answers without usage still map (zero usage); a choice with more than 255 options is refused before any call', async () => {
        const { usage: _usage, ...noUsage } = GOOD;
        const r = await adapter(fetchStub([{ status: 200, body: noUsage }]).fn).decide({}, QUESTIONS);
        if (!r.ok) throw new Error(r.error.code);
        expect(r.value.usage).toEqual({ inputTokens: 0, costUsd: 0 });
        const criteria = Object.fromEntries(Array.from({ length: 256 }, (_, i) => [`o${i}`, `option ${i}`]));
        const { fn, calls } = fetchStub([{ status: 200, body: GOOD }]);
        const big = await adapter(fn).decide({}, { pick: { type: 'choice', instructions: 'pick', criteria } });
        expect(codeOf(big)).toBe('unprocessable');
        expect(calls).toHaveLength(0);
    });
});
