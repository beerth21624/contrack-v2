// ─── E2E: module `ai-assist` — module switch, scripted decision model (the test app uses the fake), both routes,
// tenant isolation. In-memory persistence, FixedClock. ───
import { type BoqReviewRequest, boqReviewResponseSchema, matchItemsResponseSchema, workspaceModuleDtoSchema } from '@contrack/contract';
import { DecisionPort } from '../../src/modules/ai-assist/application/ports/decision.port';
import { FakeDecisionAdapter, choice, noul } from '../../src/modules/ai-assist/testing/fake-decision.adapter';
import { type Session, type TestApp, bearer, createCompany, expectError, expectStatus, register, startApp } from '../support/e2e';

const REVIEW: BoqReviewRequest = {
    project: { name: 'บ้านคุณสมชาย', type: 'บ้านพักอาศัย 2 ชั้น', usableAreaSqm: 180, floors: 2 },
    rows: [
        {
            key: 'R1', section: 'งานโครงสร้าง', desc: 'คอนกรีตโครงสร้าง', unit: 'ลบ.ม.', qty: 12, grossQty: 22.8, wastePct: 90,
            matUnit: 2500, labUnit: 600, note: '', derived: { qty: false, mat: false, lab: false },
        },
        {
            key: 'R2', section: 'งานโครงสร้าง', desc: 'เหล็กเส้น', unit: 'กก.', qty: 1500, grossQty: 1575, wastePct: 5,
            matUnit: 28, labUnit: 6, note: '', derived: { qty: false, mat: false, lab: false },
        },
    ],
};

describe('ai-assist (e2e)', () => {
    let t: TestApp;
    let owner: Session;
    let outsider: Session;
    let workspaceId: string;
    let fake: FakeDecisionAdapter;

    beforeAll(async () => {
        t = await startApp();
        owner = await register(t, 'Owner');
        outsider = await register(t, 'Outsider');
        workspaceId = (await createCompany(t, owner, 'รับเหมาดี จำกัด')).id;
        const port = t.app.get(DecisionPort, { strict: false });
        if (!(port instanceof FakeDecisionAdapter)) throw new Error('the test app should use the fake decision model');
        fake = port;
    });

    afterAll(async () => {
        await t.close();
    });

    const review = (s: Session, ws = workspaceId, body: object = REVIEW) =>
        t.http().post(`/workspaces/${ws}/ai/boq-review`).set(bearer(s.accessToken)).send(body);

    it('module off for the workspace → 404 module_disabled', async () => {
        expectError(await review(owner), 404, 'module_disabled');
    });

    it('module on, nothing scripted → 503 ai_unavailable (a server without a model answers the same)', async () => {
        const on = await t.http().put(`/workspaces/${workspaceId}/modules/ai-assist`).set(bearer(owner.accessToken)).send({ enabled: true });
        expectStatus(on, 200);
        expect(workspaceModuleDtoSchema.parse(on.body).enabled).toBe(true);
        expectError(await review(owner), 503, 'ai_unavailable');
    });

    it('boq-review: findings for flagged rows only, in contract shape', async () => {
        fake.reset();
        fake.answer('R1_flag', noul(0.92)).answer('R1_kind', choice('waste', 0.88)).answerWith(() => undefined);
        const res = await review(owner);
        expectStatus(res, 200);
        const body = boqReviewResponseSchema.parse(res.body);
        expect(body.model).toBe('jev-fake');
        expect(body.findings).toEqual([{ key: 'R1', kind: 'waste', probability: 0.92, kindConfidence: 0.88 }]);
        expect(body.usage).toEqual({ inputTokens: 100, costUsd: 0.00005 });
        expect(fake.calls).toHaveLength(1);
        expect(fake.calls[0]!.state).toEqual(REVIEW);
    });

    it('match-items: original catalogue text back, none → null', async () => {
        fake.reset();
        fake.answer('item0', choice('ปูนซีเมนต์', 0.93)).answer('item1', choice('none', 0.8));
        const res = await t.http().post(`/workspaces/${workspaceId}/ai/match-items`).set(bearer(owner.accessToken))
            .send({ catalogue: ['ปูนซีเมนต์ ', 'ทรายหยาบ'], inputs: ['ปูน', 'กระเบื้อง'] });
        expectStatus(res, 200);
        expect(matchItemsResponseSchema.parse(res.body)).toEqual({
            model: 'jev-fake',
            matches: [{ input: 'ปูน', item: 'ปูนซีเมนต์ ', confidence: 0.93 }, { input: 'กระเบื้อง', item: null, confidence: 0.8 }],
        });
    });

    it('an outsider gets 404 not_found; a bad body 400 validation_failed; no token 401', async () => {
        expectError(await review(outsider), 404, 'not_found');
        expectError(await review(owner, workspaceId, { project: {}, rows: [] }), 400, 'validation_failed');
        expectError(await t.http().post(`/workspaces/${workspaceId}/ai/boq-review`).send(REVIEW), 401, 'unauthenticated');
    });

    it('a platform without the module answers 404 module_disabled even for a member', async () => {
        const plain = await startApp({ MODULES_ENABLED: '' });
        try {
            const o = await register(plain, 'Owner');
            const ws = (await createCompany(plain, o)).id;
            expectError(await plain.http().post(`/workspaces/${ws}/ai/match-items`).set(bearer(o.accessToken))
                .send({ catalogue: ['อิฐมอญ'], inputs: ['อิฐ'] }), 404, 'module_disabled');
        } finally {
            await plain.close();
        }
    });
});
