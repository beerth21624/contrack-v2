import { sha256 } from '../../../../../shared/infrastructure/crypto';
import { BUYER_SMS_PER_DAY, buyerSmsRules } from '../ports/sms-rate-limiter.port';
import { BUYER_WS, MASONRY_KEYS, SourcingKit, USERS, VENDOR_WS, codeOf, describeBuyerAuthorization, valueOf } from '../../testing/sourcing-test-kit';
import { ExtendDeadlineUseCase } from './extend-deadline.use-case';
import { IssueAddendumUseCase } from './issue-addendum.use-case';

const body = (keys: string[]) => ({ lineKeys: keys, customLines: [], materialByLine: {}, note: 'เพิ่มผนังห้องน้ำ' });

describe('IssueAddendumUseCase', () => {
    it('adds a version with the changed lines and tells the invitees with a fresh SMS link', async () => {
        const kit = await SourcingKit.create();
        const { pkg, invitationId } = await kit.sentPackage({ lineKeys: MASONRY_KEYS.slice(0, 2) });
        kit.notifier.sent.length = 0;
        const dto = valueOf(await kit.get(IssueAddendumUseCase).execute({
            actorId: USERS.estimator, packageId: pkg.id as never, body: body(MASONRY_KEYS.slice(0, 3)),
        }));
        expect(dto.version).toBe(2);
        expect(dto.lines).toHaveLength(3);
        expect(dto.versions.map(v => v.note)).toEqual(['', 'เพิ่มผนังห้องน้ำ']);
        const stored = await kit.packages.findById(pkg.id as never);
        expect(stored?.current.changedIdx).toEqual([2]);
        expect(stored?.versionLines(1)).toHaveLength(2);
        const [notice] = kit.notifier.sent;
        expect(notice?.template).toBe('sc.addendum');
        expect(notice?.toPhone).toBe('+66812345678');
        const token = String(notice?.payload.url).split('/s/')[1] ?? '';
        expect((await kit.invitations.findByTokenHash(sha256(token)))?.id).toBe(invitationId);
        expect(kit.activity.rows.map(r => r.action)).toContain('package.addendum');
    });

    it('a draft has no addendum (conflict); unknown keys → 422', async () => {
        const kit = await SourcingKit.create();
        const draft = await kit.draft();
        const uc = kit.get(IssueAddendumUseCase);
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: draft.id as never, body: body(MASONRY_KEYS.slice(0, 1)) }))).toBe('conflict');
        const { pkg } = await kit.sentPackage({ lineKeys: MASONRY_KEYS.slice(3, 5) });
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: pkg.id as never, body: body(['nope']) }))).toBe('unprocessable');
    });

    it('not after the award (conflict)', async () => {
        const kit = await SourcingKit.create();
        const { pkg } = await kit.sentPackage();
        const stored = await kit.packages.findById(pkg.id as never);
        stored?.markAwarded(kit.clock.now());
        if (stored !== undefined) await kit.packages.update(stored);
        expect(codeOf(await kit.get(IssueAddendumUseCase).execute({ actorId: USERS.owner, packageId: pkg.id as never, body: body(MASONRY_KEYS.slice(0, 1)) })))
            .toBe('conflict');
    });

    it('past the bid deadline → conflict deadline_passed until the deadline is extended', async () => {
        const kit = await SourcingKit.create();
        const { pkg } = await kit.sentPackage();
        kit.clock.set(new Date('2026-01-06T10:00:00.000Z'));
        const uc = kit.get(IssueAddendumUseCase);
        const late = await uc.execute({ actorId: USERS.owner, packageId: pkg.id as never, body: body(MASONRY_KEYS.slice(0, 2)) });
        expect(late.ok ? undefined : late.error).toMatchObject({ code: 'conflict', details: { reason: 'deadline_passed' } });
        expect((await kit.packages.findById(pkg.id as never))?.version).toBe(1);
        valueOf(await kit.get(ExtendDeadlineUseCase).execute({ actorId: USERS.owner, packageId: pkg.id as never, bidDeadline: new Date('2026-01-10T10:00:00.000Z') }));
        expect(valueOf(await uc.execute({ actorId: USERS.owner, packageId: pkg.id as never, body: body(MASONRY_KEYS.slice(0, 2)) })).version).toBe(2);
    });

    it('BOQ lines already in another live package of the project → conflict { lineKeys }', async () => {
        const kit = await SourcingKit.create();
        const { pkg } = await kit.sentPackage({ lineKeys: MASONRY_KEYS.slice(0, 2) });
        await kit.draft({ title: 'อื่น', lineKeys: MASONRY_KEYS.slice(2, 4) });
        const res = await kit.get(IssueAddendumUseCase).execute({ actorId: USERS.owner, packageId: pkg.id as never, body: body(MASONRY_KEYS.slice(0, 3)) });
        expect(res.ok ? undefined : res.error).toMatchObject({ code: 'conflict', details: { lineKeys: [MASONRY_KEYS[2]] } });
    });

    it('linked invitees are told in-app without a raw link; over the buyer SMS budget → rate_limited (nothing written)', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        const { pkg, invitationId } = await kit.sentPackage();
        kit.notifier.sent.length = 0;
        valueOf(await kit.get(IssueAddendumUseCase).execute({ actorId: USERS.owner, packageId: pkg.id as never, body: body(MASONRY_KEYS.slice(0, 2)) }));
        expect(kit.notifier.sent).toEqual([{
            template: 'sc.addendum', toWorkspaceIds: [VENDOR_WS],
            payload: { buyerName: 'บริษัท ผู้รับเหมา จำกัด', title: 'ก่ออิฐฉาบปูนทั้งหลัง', href: `/vendor/invitations/${invitationId}` },
        }]);
        expect([...kit.invitations.tokens.values()].filter(id => id === invitationId)).toHaveLength(1);
        await kit.limiter.tryTake(buyerSmsRules(BUYER_WS, BUYER_SMS_PER_DAY - 2));
        const res = await kit.get(IssueAddendumUseCase).execute({ actorId: USERS.owner, packageId: pkg.id as never, body: body(MASONRY_KEYS.slice(0, 1)) });
        expect(codeOf(res)).toBe('rate_limited');
        expect((await kit.packages.findById(pkg.id as never))?.version).toBe(2);
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator'], k => k.sentPackage(),
        (k, user, s) => k.get(IssueAddendumUseCase).execute({ actorId: user, packageId: s.pkg.id as never, body: body(MASONRY_KEYS.slice(0, 1)) }));
});
