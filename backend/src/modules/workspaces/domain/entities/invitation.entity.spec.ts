import { asInvitationId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import { Email } from '../value-objects/email.value-object';
import { Invitation } from './invitation.entity';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-01-01T00:00:00.000Z');
const inviter = asUserId('00000000-0000-4000-8000-0000000000aa');
const invitee = asUserId('00000000-0000-4000-8000-0000000000bb');

const make = (): Invitation => Invitation.create({
    id: asInvitationId('00000000-0000-4000-8000-000000000001'),
    workspaceId: asWorkspaceId('00000000-0000-4000-8000-000000000002'),
    email: Email.rehydrate('somchai@example.com'),
    role: 'estimator',
    tokenHash: 'hash',
    invitedBy: inviter,
    now,
    ttlDays: 7,
});

const at = (ms: number): Date => new Date(now.getTime() + ms);

describe('Invitation', () => {
    it('is created pending and expires after the TTL', () => {
        const inv = make();
        expect(inv.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
        expect(inv.expiresAt.toISOString()).toBe('2026-01-08T00:00:00.000Z');
        expect(inv.acceptedAt).toBeNull();
        expect(inv.acceptedBy).toBeNull();
        expect(inv.revokedAt).toBeNull();
        expect(inv.status(now)).toBe('pending');
    });

    it('is pending until one millisecond before expiry, expired from expiresAt on', () => {
        const inv = make();
        expect(inv.status(at(7 * DAY - 1))).toBe('pending');
        expect(inv.isPending(at(7 * DAY - 1))).toBe(true);
        expect(inv.status(at(7 * DAY))).toBe('expired');
        expect(inv.status(at(30 * DAY))).toBe('expired');
        expect(inv.isPending(at(7 * DAY))).toBe(false);
    });

    it('accepts once', () => {
        const inv = make();
        expect(inv.accept(invitee, at(DAY)).ok).toBe(true);
        expect(inv.status(at(DAY))).toBe('accepted');
        expect(inv.acceptedBy).toBe(invitee);
        expect(inv.acceptedAt?.toISOString()).toBe('2026-01-02T00:00:00.000Z');
        const again = inv.accept(invitee, at(DAY));
        expect(!again.ok && again.error.code).toBe('invitation_invalid');
    });

    it('stays accepted after it would have expired', () => {
        const inv = make();
        inv.accept(invitee, at(DAY));
        expect(inv.status(at(100 * DAY))).toBe('accepted');
    });

    it('revokes a pending invitation', () => {
        const inv = make();
        expect(inv.revoke(at(DAY)).ok).toBe(true);
        expect(inv.status(at(DAY))).toBe('revoked');
        expect(inv.revokedAt?.toISOString()).toBe('2026-01-02T00:00:00.000Z');
    });

    it('cannot accept a revoked invitation', () => {
        const inv = make();
        inv.revoke(at(DAY));
        const r = inv.accept(invitee, at(DAY));
        expect(!r.ok && r.error.code).toBe('invitation_invalid');
    });

    it('cannot accept or revoke an expired invitation', () => {
        const inv = make();
        const accept = inv.accept(invitee, at(8 * DAY));
        const revoke = inv.revoke(at(8 * DAY));
        expect(!accept.ok && accept.error.code).toBe('invitation_invalid');
        expect(!revoke.ok && revoke.error.code).toBe('invitation_invalid');
    });

    it('cannot revoke an accepted or already revoked invitation', () => {
        const accepted = make();
        accepted.accept(invitee, now);
        expect(accepted.revoke(now).ok).toBe(false);
        const revoked = make();
        revoked.revoke(now);
        expect(revoked.revoke(now).ok).toBe(false);
    });

    it('round-trips through props', () => {
        const inv = make();
        inv.accept(invitee, at(DAY));
        const copy = Invitation.rehydrate(inv.toProps());
        expect(copy.toProps()).toEqual(inv.toProps());
        expect(copy.status(at(DAY))).toBe('accepted');
    });
});
