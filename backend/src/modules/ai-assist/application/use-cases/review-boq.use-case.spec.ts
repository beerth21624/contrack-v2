import { AI_FINDING_KINDS, type BoqReviewRow } from '@contrack/contract';
import { DomainError } from '../../../../shared/domain/domain-error';
import { asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import { FakeModuleFlags, FakeRoles } from '../../../../shared/testing/platform-fakes';
import { AiAccess } from '../../shared/ai-access';
import { FakeDecisionAdapter, choice, noul } from '../../testing/fake-decision.adapter';
import { REVIEW_CHUNK_ROWS, ReviewBoqUseCase } from './review-boq.use-case';

const MEMBER = asUserId('00000000-0000-4000-a000-000000000001');
const OUTSIDER = asUserId('00000000-0000-4000-a000-000000000002');
const WS = asWorkspaceId('00000000-0000-4000-b000-000000000001');
const PROJECT = { name: 'บ้านคุณสมชาย', type: 'บ้านพักอาศัย 2 ชั้น', usableAreaSqm: 180, floors: 2 };

const row = (key: string, over: Partial<BoqReviewRow> = {}): BoqReviewRow => ({
    key, section: 'งานโครงสร้าง', desc: 'คอนกรีตโครงสร้าง', unit: 'ลบ.ม.', qty: 12, grossQty: 13.2, wastePct: 10,
    matUnit: 2500, labUnit: 600, note: '', derived: { qty: false, mat: false, lab: false }, ...over,
});

function kit(): { useCase: ReviewBoqUseCase; fake: FakeDecisionAdapter; flags: FakeModuleFlags } {
    const roles = new FakeRoles();
    roles.set(MEMBER, WS, 'viewer');
    const flags = new FakeModuleFlags();
    const fake = new FakeDecisionAdapter();
    return { useCase: new ReviewBoqUseCase(new AiAccess(roles, flags), fake), fake, flags };
}

describe('ReviewBoqUseCase', () => {
    it('asks a flag and a kind question per row; returns rows at or above AI_REVIEW_MIN, most probable first', async () => {
        const { useCase, fake } = kit();
        fake.answer('R1_flag', noul(0.95)).answer('R1_kind', choice('waste', 0.9))
            .answer('R2_flag', noul(0.3)).answer('R2_kind', choice('qty', 0.9))
            .answer('R3_flag', noul(0.7)).answer('R3_kind', choice('price', 0.8));
        const rows = [row('R1', { wastePct: 90 }), row('R2'), row('R3', { matUnit: 0 }), row('R4')];
        const r = await useCase.execute({ actorId: MEMBER, workspaceId: WS, request: { project: PROJECT, rows } });
        if (!r.ok) throw new Error(r.error.code);
        expect(r.value).toEqual({
            model: 'jev-fake',
            findings: [
                { key: 'R1', kind: 'waste', probability: 0.95, kindConfidence: 0.9 },
                { key: 'R3', kind: 'price', probability: 0.7, kindConfidence: 0.8 },
            ],
            usage: { inputTokens: 100, costUsd: 0.00005 },
        });
        expect(fake.calls).toHaveLength(1);
        const [call] = fake.calls;
        expect(call!.state).toEqual({ project: PROJECT, rows });
        expect(Object.keys(call!.questions).sort()).toEqual(['R1_flag', 'R1_kind', 'R2_flag', 'R2_kind', 'R3_flag', 'R3_kind', 'R4_flag', 'R4_kind']);
        const flag = call!.questions.R1_flag!;
        const kind = call!.questions.R1_kind!;
        expect(flag.type).toBe('noul');
        expect(flag.instructions).toContain('key="R1"');
        expect(flag.instructions).toContain('derived');
        expect(kind.type).toBe('choice');
        if (kind.type !== 'choice') throw new Error('kind should be a choice');
        expect(Object.keys(kind.criteria).sort()).toEqual([...AI_FINDING_KINDS, 'none'].sort());
        expect(kind.instructions).toContain('เลือก none');
    });

    it('falls back to the most probable real kind when the row is flagged but the choice is none', async () => {
        const { useCase, fake } = kit();
        fake.answer('R1_flag', noul(0.8)).answer('R1_kind', choice('none', 0.5, { none: 0.5, qty: 0.3, unit: 0.2 }));
        fake.answer('R2_flag', noul(0.6)).answer('R2_kind', choice('none', 1, { none: 1 }));
        const r = await useCase.execute({ actorId: MEMBER, workspaceId: WS, request: { project: {}, rows: [row('R1'), row('R2')] } });
        if (!r.ok) throw new Error(r.error.code);
        // R2: flagged, but the model offers no real kind → left out rather than invented.
        expect(r.value.findings).toEqual([{ key: 'R1', kind: 'qty', probability: 0.8, kindConfidence: 0.3 }]);
    });

    it('chunks rows into calls of at most REVIEW_CHUNK_ROWS and sums usage across calls', async () => {
        const { useCase, fake } = kit();
        const rows = Array.from({ length: REVIEW_CHUNK_ROWS * 2 + 10 }, (_, i) => row(`R${i + 1}`));
        fake.answer('R5_flag', noul(0.9)).answer('R5_kind', choice('unit', 0.7))
            .answer(`R${REVIEW_CHUNK_ROWS * 2 + 5}_flag`, noul(0.99)).answer(`R${REVIEW_CHUNK_ROWS * 2 + 5}_kind`, choice('note', 0.6));
        const r = await useCase.execute({ actorId: MEMBER, workspaceId: WS, request: { project: PROJECT, rows } });
        if (!r.ok) throw new Error(r.error.code);
        expect(fake.calls).toHaveLength(3);
        const sizes = fake.calls.map(c => (c.state as { rows: unknown[] }).rows.length);
        expect(sizes).toEqual([REVIEW_CHUNK_ROWS, REVIEW_CHUNK_ROWS, 10]);
        for (const c of fake.calls) {
            expect(Object.keys(c.questions)).toHaveLength((c.state as { rows: unknown[] }).rows.length * 2);
            expect((c.state as { project: unknown }).project).toEqual(PROJECT);
        }
        expect(r.value.findings.map(f => f.key)).toEqual([`R${REVIEW_CHUNK_ROWS * 2 + 5}`, 'R5']);
        expect(r.value.usage).toEqual({ inputTokens: 300, costUsd: expect.closeTo(0.00015, 10) as number });
    });

    it('not a member → not_found; module off → module_disabled; a model failure is passed through', async () => {
        const { useCase, fake, flags } = kit();
        fake.answerWith(() => undefined);
        const request = { project: PROJECT, rows: [row('R1')] };
        const outsider = await useCase.execute({ actorId: OUTSIDER, workspaceId: WS, request });
        expect(outsider.ok ? 'ok' : outsider.error.code).toBe('not_found');
        flags.set(WS, 'ai-assist', false);
        const off = await useCase.execute({ actorId: MEMBER, workspaceId: WS, request });
        expect(off.ok ? 'ok' : off.error.code).toBe('module_disabled');
        flags.set(WS, 'ai-assist', true);
        fake.failWith(new DomainError('ai_quota', 'no credits'));
        const quota = await useCase.execute({ actorId: MEMBER, workspaceId: WS, request });
        expect(quota.ok ? 'ok' : quota.error.code).toBe('ai_quota');
    });

    it('answers ai_unavailable when the fake has nothing scripted (like a server without a key)', async () => {
        const { useCase } = kit();
        const r = await useCase.execute({ actorId: MEMBER, workspaceId: WS, request: { project: PROJECT, rows: [row('R1')] } });
        expect(r.ok ? 'ok' : r.error.code).toBe('ai_unavailable');
    });
});
