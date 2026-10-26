import { DomainError } from '../../../../shared/domain/domain-error';
import { asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import { FakeModuleFlags, FakeRoles } from '../../../../shared/testing/platform-fakes';
import { MAX_CHOICE_OPTIONS } from '../ports/decision.port';
import { AiAccess } from '../../shared/ai-access';
import { FakeDecisionAdapter, choice } from '../../testing/fake-decision.adapter';
import { MatchItemsUseCase, NO_MATCH_LABEL, catalogueCriteria } from './match-items.use-case';

const MEMBER = asUserId('00000000-0000-4000-a000-000000000001');
const OUTSIDER = asUserId('00000000-0000-4000-a000-000000000002');
const WS = asWorkspaceId('00000000-0000-4000-b000-000000000001');

function kit(): { useCase: MatchItemsUseCase; fake: FakeDecisionAdapter; flags: FakeModuleFlags } {
    const roles = new FakeRoles();
    roles.set(MEMBER, WS, 'estimator');
    const flags = new FakeModuleFlags();
    const fake = new FakeDecisionAdapter();
    return { useCase: new MatchItemsUseCase(new AiAccess(roles, flags), fake), fake, flags };
}

describe('MatchItemsUseCase', () => {
    it('asks one choice per input over the trimmed catalogue and answers with the ORIGINAL catalogue text', async () => {
        const { useCase, fake } = kit();
        // Stray spaces and a duplicate after trimming, as pick lists in the wild have them.
        const catalogue = ['ปูนซีเมนต์ ', 'ทรายหยาบ', 'ทรายหยาบ  ', 'อิฐมอญ'];
        const inputs = ['ปูน', 'ทราย', 'กระเบื้องหลังคา'];
        fake.answer('item0', choice('ปูนซีเมนต์', 0.93)).answer('item1', choice('ทรายหยาบ', 0.7)).answer('item2', choice('none', 0.8));
        const r = await useCase.execute({ actorId: MEMBER, workspaceId: WS, request: { catalogue, inputs } });
        if (!r.ok) throw new Error(r.error.code);
        expect(r.value).toEqual({
            model: 'jev-fake',
            matches: [
                { input: 'ปูน', item: 'ปูนซีเมนต์ ', confidence: 0.93 },
                { input: 'ทราย', item: 'ทรายหยาบ', confidence: 0.7 },
                { input: 'กระเบื้องหลังคา', item: null, confidence: 0.8 },
            ],
        });
        expect(fake.calls).toHaveLength(1);
        const [call] = fake.calls;
        expect(call!.state).toEqual({ inputs });
        expect(Object.keys(call!.questions)).toEqual(['item0', 'item1', 'item2']);
        const q = call!.questions.item1!;
        if (q.type !== 'choice') throw new Error('expected a choice');
        expect(q.instructions).toContain('state.inputs[1]');
        expect(q.criteria).toEqual({ 'ปูนซีเมนต์': 'ปูนซีเมนต์', 'ทรายหยาบ': 'ทรายหยาบ', 'อิฐมอญ': 'อิฐมอญ', none: NO_MATCH_LABEL });
    });

    it('an option the model invented, or a missing answer, means no match', async () => {
        const { useCase, fake } = kit();
        fake.answer('item0', choice('ไม่มีในแคตตาล็อก', 0.9));
        const r = await useCase.execute({ actorId: MEMBER, workspaceId: WS, request: { catalogue: ['อิฐมอญ'], inputs: ['อิฐ'] } });
        if (!r.ok) throw new Error(r.error.code);
        expect(r.value.matches).toEqual([{ input: 'อิฐ', item: null, confidence: 0.9 }]);
    });

    it('keeps the options within the model limit (none included) and never uses none as a catalogue key', () => {
        const full = catalogueCriteria(Array.from({ length: MAX_CHOICE_OPTIONS }, (_, i) => `รายการ ${i}`));
        expect(Object.keys(full.criteria)).toHaveLength(MAX_CHOICE_OPTIONS);
        expect(full.criteria.none).toBe(NO_MATCH_LABEL);
        const odd = catalogueCriteria(['none', '  ', 'อิฐมอญ']);
        expect(Object.keys(odd.criteria)).toEqual(['อิฐมอญ', 'none']);
        expect(odd.originalOf.get('none')).toBeUndefined();
    });

    it('not a member → not_found; module off → module_disabled; a model failure is passed through', async () => {
        const { useCase, fake, flags } = kit();
        fake.answerWith(() => undefined);
        const request = { catalogue: ['อิฐมอญ'], inputs: ['อิฐ'] };
        const outsider = await useCase.execute({ actorId: OUTSIDER, workspaceId: WS, request });
        expect(outsider.ok ? 'ok' : outsider.error.code).toBe('not_found');
        flags.set(WS, 'ai-assist', false);
        const off = await useCase.execute({ actorId: MEMBER, workspaceId: WS, request });
        expect(off.ok ? 'ok' : off.error.code).toBe('module_disabled');
        flags.set(WS, 'ai-assist', true);
        fake.failWith(new DomainError('ai_unavailable', 'down'));
        const down = await useCase.execute({ actorId: MEMBER, workspaceId: WS, request });
        expect(down.ok ? 'ok' : down.error.code).toBe('ai_unavailable');
    });
});
