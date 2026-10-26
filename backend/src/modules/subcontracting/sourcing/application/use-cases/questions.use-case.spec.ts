import {
    BUYER_WS, OUTSIDER, SourcingKit, USERS, VENDOR_ESTIMATOR, VENDOR_OWNER, VENDOR_VIEWER, VENDOR_WS, codeOf, describeBuyerAuthorization,
    valueOf,
} from '../../testing/sourcing-test-kit';
import { AnswerQuestionUseCase } from './answer-question.use-case';
import { AskQuestionUseCase } from './ask-question.use-case';
import { ListQuestionsUseCase } from './list-questions.use-case';
import { ViewInvitationUseCase } from './view-invitation.use-case';

const phone2 = '0899999999';

describe('AskQuestionUseCase', () => {
    it('asks through the link; the buyer is told and sees who asked', async () => {
        const kit = await SourcingKit.create();
        const { pkg, token } = await kit.sentPackage();
        kit.notifier.sent.length = 0;
        const q = valueOf(await kit.get(AskQuestionUseCase).execute({ via: { token }, question: 'ใช้ปูนอะไร' }));
        expect(q).toMatchObject({ question: 'ใช้ปูนอะไร', answer: null, askedBy: null, mine: true });
        expect(kit.notifier.sent[0]).toMatchObject({ template: 'sc.question_asked', toWorkspaceIds: [BUYER_WS] });
        const list = valueOf(await kit.get(ListQuestionsUseCase).execute({ actorId: USERS.viewer, packageId: pkg.id as never }));
        expect(list[0]).toMatchObject({ askedBy: 'ช่างสมชาย', mine: false });
    });

    it('after the deadline → 422; a bad link → invitation_invalid; buyer module off → module_disabled', async () => {
        const kit = await SourcingKit.create();
        const { token } = await kit.sentPackage();
        const uc = kit.get(AskQuestionUseCase);
        expect(codeOf(await uc.execute({ via: { token: 'x'.repeat(43) }, question: 'q' }))).toBe('invitation_invalid');
        kit.moduleOff();
        expect(codeOf(await uc.execute({ via: { token }, question: 'q' }))).toBe('module_disabled');
        kit.flags.set(BUYER_WS, 'subcontracting', true);
        kit.clock.set(new Date('2026-01-06T10:00:00.000Z'));
        expect(codeOf(await uc.execute({ via: { token }, question: 'q' }))).toBe('unprocessable');
    });

    it('signed in: needs vendor.bid.draft in the linked crew (viewer forbidden, outsider not_found)', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        const { invitationId } = await kit.sentPackage();
        const uc = kit.get(AskQuestionUseCase);
        const ask = (userId: typeof OUTSIDER) => uc.execute({ via: { userId, invitationId }, question: 'q' });
        expect(codeOf(await ask(VENDOR_OWNER))).toBe('ok');
        expect(codeOf(await ask(VENDOR_ESTIMATOR))).toBe('ok');
        expect(codeOf(await ask(VENDOR_VIEWER))).toBe('forbidden');
        expect(codeOf(await ask(OUTSIDER))).toBe('not_found');
        kit.flags.platform.delete('subcontracting');
        expect(codeOf(await ask(VENDOR_OWNER))).toBe('module_disabled');
    });
});

describe('AnswerQuestionUseCase', () => {
    const asked = async (kit: SourcingKit) => {
        await kit.seedVendorProfile();
        const s = await kit.sentPackage();
        const q = valueOf(await kit.get(AskQuestionUseCase).execute({ via: { token: s.token }, question: 'ใช้ปูนอะไร' }));
        return { ...s, questionId: q.id };
    };

    it('answers; every invitee sees the answer without the asker, and is told', async () => {
        const kit = await SourcingKit.create();
        const { pkg, questionId } = await asked(kit);
        const otherEntry = await kit.entry('ทีมสอง', phone2);
        const second = (await kit.send(pkg.id, [otherEntry])).links[0]?.url.split('/s/')[1] ?? '';
        kit.notifier.sent.length = 0;
        const dto = valueOf(await kit.get(AnswerQuestionUseCase).execute({ actorId: USERS.estimator, questionId: questionId as never, answer: 'ปูนตราเสือ' }));
        expect(dto.answer).toBe('ปูนตราเสือ');
        expect(kit.notifier.sent).toEqual([expect.objectContaining({ template: 'sc.question_answered', toWorkspaceIds: [VENDOR_WS] })]);
        const guest = valueOf(await kit.get(ViewInvitationUseCase).execute({ via: { token: second } }));
        expect(guest.questions).toEqual([expect.objectContaining({ answer: 'ปูนตราเสือ', askedBy: null, mine: false })]);
    });

    it('unknown question → not_found', async () => {
        const kit = await SourcingKit.create();
        expect(codeOf(await kit.get(AnswerQuestionUseCase).execute({ actorId: USERS.owner, questionId: '00000000-0000-4000-8000-0000000000ff' as never, answer: 'a' })))
            .toBe('not_found');
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator'], asked,
        (k, user, s) => k.get(AnswerQuestionUseCase).execute({ actorId: user, questionId: s.questionId as never, answer: 'a' }));
});

describe('ListQuestionsUseCase', () => {
    it('lists nothing for a package without questions', async () => {
        const kit = await SourcingKit.create();
        const d = await kit.draft();
        expect(valueOf(await kit.get(ListQuestionsUseCase).execute({ actorId: USERS.owner, packageId: d.id as never }))).toEqual([]);
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator', 'viewer'], k => k.draft(),
        (k, user, d) => k.get(ListQuestionsUseCase).execute({ actorId: user, packageId: d.id as never }));
});
