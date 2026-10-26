import { sha256 } from '../../../../../shared/infrastructure/crypto';
import { createProject } from '@contrack/domain/project';
import { subcontractableRows } from '@contrack/domain/subcontracting';
import { BUYER_SMS_PER_DAY, buyerSmsRules } from '../ports/sms-rate-limiter.port';
import { BUYER_WS, MASONRY_KEYS, PROJECT_ID, SAMPLE_BOQ, SourcingKit, USERS, VENDOR_WS, codeOf, describeBuyerAuthorization, valueOf } from '../../testing/sourcing-test-kit';
import { CreateInvitationsUseCase } from './create-invitations.use-case';

const phone = (n: number): string => `08${String(n).padStart(8, '0')}`.replace(/^080/, '081');

describe('CreateInvitationsUseCase', () => {
    it('sends a draft: status open, sentAt, snapshot re-taken at send, links returned once (hash stored)', async () => {
        const kit = await SourcingKit.create();
        const key = subcontractableRows(SAMPLE_BOQ).find(r => r.row.editable.qty && r.row.qty !== 777)?.row.key ?? '';
        const draft = await kit.draft({ lineKeys: [key] });
        const entryId = await kit.entry();
        const read = kit.projects.byId.get(PROJECT_ID);
        if (read === undefined) throw new Error('no project');
        const changed = createProject('sample');
        changed.boqOverrides = { [key]: { qty: 777 } };
        kit.projects.add({ ...read, project: changed });

        const res = valueOf(await kit.get(CreateInvitationsUseCase).execute({
            actorId: USERS.estimator, packageId: draft.id as never, body: { entries: [{ vendorListEntryId: entryId, channel: 'sms' }] },
        }));
        expect(res.invitations).toHaveLength(1);
        expect(res.invitations[0]?.status).toBe('sent');
        const url = res.links[0]?.url ?? '';
        expect(url).toMatch(/^https:\/\/app\.test\/s\/[A-Za-z0-9_-]{43}$/);
        const token = url.split('/s/')[1] ?? '';
        const inv = await kit.invitations.findByTokenHash(sha256(token));
        expect(inv?.id).toBe(res.invitations[0]?.id);
        expect(await kit.invitations.findByTokenHash(token)).toBeUndefined();
        expect(inv?.props.expiresAt.toISOString()).toBe('2026-02-05T10:00:00.000Z');

        const stored = await kit.packages.findById(draft.id as never);
        expect(stored?.status).toBe('open');
        expect(stored?.props.sentAt?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
        expect(stored?.version).toBe(1);
        expect(stored?.lines[0]?.qtyNet).toBe(777);

        const [n] = kit.notifier.sent;
        expect(n?.template).toBe('sc.invitation');
        expect(n?.toPhone).toBe('+66812345678');
        expect(n?.payload).toMatchObject({ buyerName: 'บริษัท ผู้รับเหมา จำกัด', url, deadline: '6 ม.ค. 69 17:00' });
        expect(kit.activity.rows.map(r => r.action)).toEqual(expect.arrayContaining(['package.sent', 'invitation.sent']));
    });

    it('links the invitation of a crew that already has an account (in-app notice, no SMS for link channel)', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        const draft = await kit.draft();
        const entryId = await kit.entry();
        const res = await kit.send(draft.id, [entryId], 'link');
        expect(res.invitations[0]?.vendorWorkspaceId).toBe(VENDOR_WS);
        expect(res.invitations[0]?.tier).toBe('L0');
        expect(kit.notifier.sent[0]).toMatchObject({ toWorkspaceIds: [VENDOR_WS] });
        expect(kit.notifier.sent[0]?.toPhone).toBeUndefined();
    });

    it('direct mode: exactly one crew in total', async () => {
        const kit = await SourcingKit.create();
        const draft = await kit.draft({ sourcingMode: 'direct' });
        const a = await kit.entry('ก', phone(1));
        const b = await kit.entry('ข', phone(2));
        const uc = kit.get(CreateInvitationsUseCase);
        const two = { entries: [{ vendorListEntryId: a, channel: 'link' as const }, { vendorListEntryId: b, channel: 'link' as const }] };
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: draft.id as never, body: two }))).toBe('unprocessable');
        await kit.send(draft.id, [a]);
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: draft.id as never, body: { entries: [{ vendorListEntryId: b, channel: 'link' }] } })))
            .toBe('unprocessable');
    });

    it('rfq: at most 8 crews', async () => {
        const kit = await SourcingKit.create();
        const draft = await kit.draft();
        const ids: string[] = [];
        for (let i = 1; i <= 9; i++) ids.push(await kit.entry(`ทีม ${i}`, phone(10 + i)));
        expect(codeOf(await kit.get(CreateInvitationsUseCase).execute({
            actorId: USERS.owner, packageId: draft.id as never, body: { entries: ids.map(e => ({ vendorListEntryId: e, channel: 'link' })) },
        }))).toBe('unprocessable');
        expect((await kit.send(draft.id, ids.slice(0, 8))).invitations).toHaveLength(8);
    });

    it('an open package gets more invitees; the same crew twice → conflict; an unknown entry → 422', async () => {
        const kit = await SourcingKit.create();
        const { pkg, entryId } = await kit.sentPackage();
        const uc = kit.get(CreateInvitationsUseCase);
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: pkg.id as never, body: { entries: [{ vendorListEntryId: entryId, channel: 'link' }] } })))
            .toBe('conflict');
        expect(codeOf(await uc.execute({
            actorId: USERS.owner, packageId: pkg.id as never, body: { entries: [{ vendorListEntryId: '00000000-0000-4000-8000-0000000000ff', channel: 'link' }] },
        }))).toBe('unprocessable');
        const other = await kit.entry('อีกทีม', phone(50));
        expect((await kit.send(pkg.id, [other])).invitations).toHaveLength(1);
        expect((await kit.packages.findById(pkg.id as never))?.status).toBe('open');
    });

    it('refuses a draft whose deadline has passed, a package past its deadline, and a cancelled one', async () => {
        const kit = await SourcingKit.create();
        const draft = await kit.draft({ bidDeadline: '2025-12-31T00:00:00.000Z' });
        const e = await kit.entry();
        const uc = kit.get(CreateInvitationsUseCase);
        const body = { entries: [{ vendorListEntryId: e, channel: 'link' as const }] };
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: draft.id as never, body }))).toBe('unprocessable');
        const { pkg } = await SourcingKit.create().then(async k2 => {
            const s = await k2.sentPackage();
            k2.clock.set(new Date('2026-01-07T00:00:00.000Z'));
            const other = await k2.entry('x', phone(60));
            expect(codeOf(await k2.get(CreateInvitationsUseCase).execute({
                actorId: USERS.owner, packageId: s.pkg.id as never, body: { entries: [{ vendorListEntryId: other, channel: 'link' }] },
            }))).toBe('unprocessable');
            return s;
        });
        expect(pkg.status).toBe('draft');
        const cancelled = await kit.draft({ lineKeys: MASONRY_KEYS.slice(3, 5) });
        const stored = await kit.packages.findById(cancelled.id as never);
        stored?.cancel('x', kit.clock.now());
        if (stored !== undefined) await kit.packages.update(stored);
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: cancelled.id as never, body }))).toBe('conflict');
    });

    it('the raw link goes only by SMS to an invitee without an account; a linked crew is told in-app with the signed-in route', async () => {
        const kit = await SourcingKit.create();
        const draft = await kit.draft();
        const unlinkedSms = await kit.entry('ช่างหนึ่ง', phone(11));
        const unlinkedLink = await kit.entry('ช่างสอง', phone(12));
        await kit.seedVendorProfile();
        const linked = await kit.entry();
        const res = valueOf(await kit.get(CreateInvitationsUseCase).execute({
            actorId: USERS.owner, packageId: draft.id as never,
            body: { entries: [
                { vendorListEntryId: unlinkedSms, channel: 'sms' }, { vendorListEntryId: unlinkedLink, channel: 'link' },
                { vendorListEntryId: linked, channel: 'sms' },
            ] },
        }));
        const [smsInv, , linkedInv] = res.invitations;
        expect(kit.notifier.sent).toHaveLength(2);
        const [sms, inApp] = kit.notifier.sent;
        expect(sms?.toPhone).toBe(smsInv?.phone);
        expect(sms?.toWorkspaceIds).toBeUndefined();
        expect(String(sms?.payload.url)).toContain('/s/');
        expect(sms?.payload.href).toBe(`/vendor/invitations/${smsInv?.id}`);
        expect(inApp).toMatchObject({ toWorkspaceIds: [VENDOR_WS], payload: { href: `/vendor/invitations/${linkedInv?.id}` } });
        expect(inApp?.toPhone).toBeUndefined();
        expect(inApp?.payload.url).toBeUndefined();
    });

    it('invitations sent by SMS beyond the buyer daily budget → rate_limited, the draft stays a draft', async () => {
        const kit = await SourcingKit.create();
        const draft = await kit.draft();
        const a = await kit.entry('ช่างหนึ่ง', phone(11));
        const b = await kit.entry('ช่างสอง', phone(12));
        await kit.limiter.tryTake(buyerSmsRules(BUYER_WS, BUYER_SMS_PER_DAY - 1));
        const uc = kit.get(CreateInvitationsUseCase);
        const two = { entries: [{ vendorListEntryId: a, channel: 'sms' as const }, { vendorListEntryId: b, channel: 'sms' as const }] };
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: draft.id as never, body: two }))).toBe('rate_limited');
        expect((await kit.packages.findById(draft.id as never))?.status).toBe('draft');
        expect(await kit.invitations.listByPackage(draft.id as never)).toEqual([]);
        const byLink = { entries: [{ vendorListEntryId: a, channel: 'link' as const }, { vendorListEntryId: b, channel: 'sms' as const }] };
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: draft.id as never, body: byLink }))).toBe('ok');
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator'], async k => ({ d: await k.draft(), e: await k.entry() }),
        (k, user, { d, e }) => k.get(CreateInvitationsUseCase).execute({
            actorId: user, packageId: d.id as never, body: { entries: [{ vendorListEntryId: e, channel: 'link' }] },
        }));
});
