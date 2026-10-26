import { type ProjectId, type UserId, type WorkspaceId } from '../../../../../shared/domain/ids';
import type { PackageId, ScInvitationId, VendorListEntryId } from '../../../shared/ids';
import { checkInviteeCount } from '../policies/invitee-limit.policy';
import { Phone, maskPhone } from '../value-objects/phone.value-object';
import { formatBaht, formatThaiDateTime } from '../../application/services/thai-format';
import { ScInvitation } from './sc-invitation.entity';
import { VendorProfile } from './vendor-profile.entity';
import { type PackageFields, WorkPackage } from './work-package.entity';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const DEADLINE = new Date('2026-01-06T10:00:00.000Z');
const ws = 'ws' as WorkspaceId;
const user = 'u' as UserId;
const line = { idx: 0, lineKey: 'k', section: 17, sectionTitle: 's', desc: 'd', unit: 'ตร.ม.', qtyNet: 10, qtyGross: 11, qtyPriced: 10,
    qtyMaterial: 11, labourBasis: 'net' as const, materialBy: 'buyer' as const, estLabUnit: 100, estMatUnit: 50, estTotal: 1000 };
const fields: PackageFields = {
    title: ' t ', trade: 'masonry', supplyMode: 'labour_only', pricingMode: 'unit', sourcingMode: 'rfq',
    terms: { retentionPct: 0.05, warrantyMonths: 12, penalty: { kind: 'none' }, provisions: { water: 'buyer', power: 'buyer', lodging: 'none', scaffolding: 'none' }, safetyNote: '', questions: [] },
    schedule: { start: null, finish: null, days: null }, installments: [{ no: 1, pct: 1, condition: 'จบงาน' }],
    location: { district: '', province: '', address: '' }, hideOwnerIdentity: true, bidDeadline: DEADLINE, priceValidUntil: '2026-02-01', description: '',
};
const snapshot = { lines: [line], estimateTotal: 1000 };
const selection = { lineKeys: ['k'], customLines: [], materialByLine: {} };

function draft(): WorkPackage {
    const r = WorkPackage.create({ id: 'p' as PackageId, buyerWorkspaceId: ws, projectId: 'pr' as ProjectId, projectName: 'n', fields, selection, snapshot, createdBy: user, now: NOW });
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
}

describe('WorkPackage', () => {
    it('is created as a draft (title trimmed); open sourcing and no lines are refused', () => {
        const p = draft();
        expect(p.status).toBe('draft');
        expect(p.props.title).toBe('t');
        expect(WorkPackage.create({ id: 'p' as PackageId, buyerWorkspaceId: ws, projectId: 'pr' as ProjectId, projectName: '', fields: { ...fields, sourcingMode: 'open' }, selection, snapshot, createdBy: user, now: NOW }).ok).toBe(false);
        expect(WorkPackage.create({ id: 'p' as PackageId, buyerWorkspaceId: ws, projectId: 'pr' as ProjectId, projectName: '', fields, selection, snapshot: { lines: [], estimateTotal: 0 }, createdBy: user, now: NOW }).ok).toBe(false);
    });

    it('send → open; before the deadline only; once', () => {
        const p = draft();
        expect(p.send(snapshot, DEADLINE).ok).toBe(false);
        expect(p.send(snapshot, NOW).ok).toBe(true);
        expect(p.status).toBe('open');
        expect(p.send(snapshot, NOW).ok).toBe(false);
    });

    it('effective status after the deadline: reviewing with a bid, expired without; settle stores it', () => {
        const p = draft();
        p.send(snapshot, NOW);
        expect(p.effectiveStatus(NOW, false)).toBe('open');
        expect(p.effectiveStatus(DEADLINE, true)).toBe('reviewing');
        expect(p.effectiveStatus(DEADLINE, false)).toBe('expired');
        expect(p.settle(DEADLINE, false)).toBe(true);
        expect(p.status).toBe('expired');
        expect(p.settle(DEADLINE, false)).toBe(false);
        expect(p.acceptsResponses(DEADLINE)).toBe(false);
    });

    it('editAfterSend allows description and a later deadline only', () => {
        const p = draft();
        p.send(snapshot, NOW);
        expect(p.editAfterSend({ title: 'x' }, NOW).ok).toBe(false);
        expect(p.editAfterSend({ title: undefined, description: 'ok' }, NOW).ok).toBe(true);
        expect(p.editAfterSend({ bidDeadline: NOW }, NOW).ok).toBe(false);
        expect(p.editDraft({ title: 'x' }, undefined, undefined, NOW).ok).toBe(false);
    });

    it('addendum adds a version; cancel then refuses everything', () => {
        const p = draft();
        expect(p.addendum({ selection, snapshot, changedIdx: [], note: 'n', by: user, now: NOW }).ok).toBe(false);
        p.send(snapshot, NOW);
        const v = p.addendum({ selection, snapshot, changedIdx: [0], note: ' n ', by: user, now: NOW });
        expect(v.ok && v.value.version).toBe(2);
        expect(p.version).toBe(2);
        expect(p.cancel('r', NOW).ok).toBe(true);
        expect(p.cancel('r', NOW).ok).toBe(false);
        expect(p.extend(new Date('2026-02-01T00:00:00.000Z'), NOW).ok).toBe(false);
        expect(p.attachFile('f', NOW).ok).toBe(false);
    });

    it('no addendum at or after the bid deadline (conflict deadline_passed) until the deadline is extended', () => {
        const p = draft();
        p.send(snapshot, NOW);
        const late = p.addendum({ selection, snapshot, changedIdx: [], note: 'n', by: user, now: DEADLINE });
        expect(late.ok ? undefined : late.error).toMatchObject({ code: 'conflict', details: { reason: 'deadline_passed' } });
        expect(p.version).toBe(1);
        expect(p.extend(new Date('2026-01-10T10:00:00.000Z'), DEADLINE).ok).toBe(true);
        expect(p.addendum({ selection, snapshot, changedIdx: [], note: 'n', by: user, now: DEADLINE }).ok).toBe(true);
    });
});

describe('ScInvitation', () => {
    const inv = () => ScInvitation.create({
        id: 'i' as ScInvitationId, packageId: 'p' as PackageId, buyerWorkspaceId: ws, vendorListEntryId: 'e' as VendorListEntryId,
        vendorWorkspaceId: null, displayName: 'd', phone: '+66812345678', channel: 'sms', bidDeadline: DEADLINE, now: NOW,
    });

    it('expires 30 days after the deadline; withdrawn links stop working', () => {
        const i = inv();
        expect(i.props.expiresAt.toISOString()).toBe('2026-02-05T10:00:00.000Z');
        expect(i.linkValid(NOW)).toBe(true);
        expect(i.linkValid(i.props.expiresAt)).toBe(false);
        expect(i.withdraw(NOW).ok).toBe(true);
        expect(i.linkValid(NOW)).toBe(false);
        expect(i.resend(DEADLINE).ok).toBe(false);
    });

    it('viewed once, decline only from sent / viewed, link to one crew only', () => {
        const i = inv();
        expect(i.markViewed(NOW)).toBe(true);
        expect(i.markViewed(NOW)).toBe(false);
        expect(i.decline('busy', '', NOW).ok).toBe(true);
        expect(i.decline('busy', '', NOW).ok).toBe(false);
        expect(i.linkTo('v1' as WorkspaceId)).toEqual({ ok: true, value: true });
        expect(i.linkTo('v1' as WorkspaceId)).toEqual({ ok: true, value: false });
        expect(i.linkTo('v2' as WorkspaceId).ok).toBe(false);
    });

    it('renewExpiry never shortens the link', () => {
        const i = inv();
        i.renewExpiry(NOW);
        expect(i.props.expiresAt.toISOString()).toBe('2026-02-05T10:00:00.000Z');
    });
});

describe('VendorProfile', () => {
    it('L1 when complete (team size, trades, provinces, 3 portfolio items); L2 never lowered', () => {
        const p = VendorProfile.create({ workspaceId: ws, teamName: ' ทีม ', contactName: 'ก', phone: '', now: NOW });
        expect(p.props.teamName).toBe('ทีม');
        const f = { teamName: 'ทีม', contactName: 'ก', trades: ['masonry' as const], provinces: ['x'], crewSkilled: 2, crewLabourers: null,
            tools: [], vatRegistered: false, referenceRates: [], availableMonths: [] };
        p.update(f, 2, NOW);
        expect(p.props.tier).toBe('L0');
        p.refreshTier(3, NOW);
        expect(p.props.tier).toBe('L1');
        const l2 = VendorProfile.rehydrate({ ...p.toProps(), tier: 'L2' });
        l2.refreshTier(0, NOW);
        expect(l2.props.tier).toBe('L2');
    });
});

describe('Phone / invitee limits / Thai formats', () => {
    it('normalises and masks phones', () => {
        const p = Phone.create('081-234-5678');
        expect(p.ok && p.value.value).toBe('+66812345678');
        expect(p.ok && p.value.masked()).toBe('xxx-xxx-5678');
        expect(maskPhone('+6621234567')).toBe('xxxxx-4567');
        expect(Phone.create('hello').ok).toBe(false);
    });

    it('direct = exactly one, rfq ≤ 8, open refused', () => {
        expect(checkInviteeCount('direct', 0, 1).ok).toBe(true);
        expect(checkInviteeCount('direct', 1, 1).ok).toBe(false);
        expect(checkInviteeCount('rfq', 7, 1).ok).toBe(true);
        expect(checkInviteeCount('rfq', 8, 1).ok).toBe(false);
        expect(checkInviteeCount('open', 0, 1).ok).toBe(false);
    });

    it('formats money and Bangkok dates with the Buddhist year', () => {
        expect(formatBaht(125000)).toBe('125,000 บาท');
        expect(formatBaht(1234.5)).toBe('1,234.5 บาท');
        expect(formatThaiDateTime(new Date('2026-10-30T10:00:00.000Z'))).toBe('30 ต.ค. 69 17:00');
    });
});
