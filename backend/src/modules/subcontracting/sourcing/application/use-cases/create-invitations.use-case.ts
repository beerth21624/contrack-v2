import { Injectable } from '@nestjs/common';
import type { CreateInvitationsRequest, CreateInvitationsResponse } from '@contrack/contract';
import { Clock, IdGenerator, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId } from '../../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../../shared/domain/result';
import { newOpaqueToken, sha256 } from '../../../../../shared/infrastructure/crypto';
import { type PackageId, asScInvitationId, asVendorListEntryId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import { ScInvitation } from '../../domain/entities/sc-invitation.entity';
import type { VendorListEntry } from '../../domain/entities/vendor-list-entry.entity';
import type { WorkPackage } from '../../domain/entities/work-package.entity';
import { checkInviteeCount } from '../../domain/policies/invitee-limit.policy';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { SmsRateLimiter, buyerSmsRules } from '../ports/sms-rate-limiter.port';
import { InvitationRepository, VendorListRepository, WorkPackageRepository } from '../ports/sourcing.repositories';
import { PackageLineGuard } from '../services/package-line-guard.service';
import { PackageSnapshots } from '../services/package-snapshots.service';
import { SourcingAccess } from '../services/sourcing-access.service';
import { SourcingNotices } from '../services/sourcing-notices.service';
import { SourcingViews, hasSubmitted } from '../services/sourcing-views.service';

export interface CreateInvitationsInput {
    actorId: UserId;
    packageId: PackageId;
    body: CreateInvitationsRequest;
}

/**
 * `sc.packages.manage`. Invites crews of the buyer's vendor list. On a draft this SENDS the package: the snapshot is
 * re-taken from the live BOQ (version stays 1) and the status becomes open; the deadline must still be ahead. An open
 * package can get more invitees. direct = exactly one crew in total, rfq ≤ 8. The raw links are returned once.
 * Sending refuses BOQ lines taken meanwhile by another live package (conflict { lineKeys }); invitations sent by SMS
 * count against the buyer's daily SMS budget (rate_limited). The package row is locked while this is decided.
 */
@Injectable()
export class CreateInvitationsUseCase {
    constructor(
        private readonly access: SourcingAccess,
        private readonly packages: WorkPackageRepository,
        private readonly invitations: InvitationRepository,
        private readonly entries: VendorListRepository,
        private readonly snapshots: PackageSnapshots,
        private readonly lineGuard: PackageLineGuard,
        private readonly limiter: SmsRateLimiter,
        private readonly views: SourcingViews,
        private readonly notices: SourcingNotices,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: CreateInvitationsInput): Promise<Result<CreateInvitationsResponse, DomainError>> {
        const found = await this.access.buyerPackage(input.actorId, input.packageId, ['sc.packages.manage']);
        if (!found.ok) return found;
        const { prices } = found.value;
        const now = this.clock.now();
        const requested = input.body.entries;
        const ids = requested.map(r => r.vendorListEntryId);
        const duplicate = ids.find((id, k) => ids.indexOf(id) !== k);
        if (duplicate !== undefined) return err(SourcingErrors.alreadyInvited(duplicate));
        const entries = new Map<string, VendorListEntry>((await this.entries.findMany(ids.map(asVendorListEntryId))).map(e => [e.id, e]));

        const created: { invitation: ScInvitation; token: string }[] = [];
        const done = await this.uow.run(async (): Promise<Result<WorkPackage, DomainError>> => {
            const locked = await this.access.lockPackage(input.packageId);
            if (!locked.ok) return locked;
            const pkg = locked.value;
            const existing = await this.invitations.lockByPackage(pkg.id);
            pkg.settle(now, hasSubmitted(existing));
            if (pkg.status === 'reviewing' || pkg.status === 'expired') return err(SourcingErrors.deadlinePassed());
            if (!pkg.isDraft && pkg.status !== 'open') return err(SourcingErrors.finished());
            for (const r of requested) {
                const entry = entries.get(r.vendorListEntryId);
                if (entry?.buyerWorkspaceId !== pkg.buyerWorkspaceId) return err(SourcingErrors.unknownEntry(r.vendorListEntryId));
                if (existing.some(i => i.isInRunning && i.props.vendorListEntryId === entry.id)) return err(SourcingErrors.alreadyInvited(entry.id));
            }
            const count = checkInviteeCount(pkg.props.sourcingMode, existing.filter(i => i.isInRunning).length, requested.length);
            if (!count.ok) return count;

            const sending = pkg.isDraft;
            if (sending) {
                const free = await this.lineGuard.check(pkg.buyerWorkspaceId, pkg.props.projectId, pkg.props.selection.lineKeys, pkg.id);
                if (!free.ok) return free;
                const snapshot = await this.snapshots.take(pkg.props.projectId, pkg.props.selection, pkg.props.supplyMode);
                if (!snapshot.ok) return snapshot;
                const sent = pkg.send(snapshot.value, now);
                if (!sent.ok) return sent;
            }
            const sms = requested.filter(r => r.channel !== 'link').length;
            if (!(await this.limiter.tryTake(buyerSmsRules(pkg.buyerWorkspaceId, sms)))) return err(SourcingErrors.rateLimited());

            for (const r of requested) {
                const entry = entries.get(r.vendorListEntryId);
                if (entry === undefined) continue;
                created.push({
                    invitation: ScInvitation.create({
                        id: asScInvitationId(this.ids.newId()), packageId: pkg.id, buyerWorkspaceId: pkg.buyerWorkspaceId,
                        vendorListEntryId: entry.id, vendorWorkspaceId: entry.vendorWorkspaceId, displayName: entry.props.displayName,
                        phone: entry.phone, channel: r.channel, bidDeadline: pkg.props.bidDeadline, now,
                    }),
                    token: newOpaqueToken(),
                });
            }
            if (sending) await this.packages.update(pkg);
            for (const c of created) await this.invitations.insert(c.invitation, sha256(c.token));
            if (sending) {
                await this.activity.record({
                    buyerWorkspaceId: pkg.buyerWorkspaceId, entity: 'package', entityId: pkg.id, action: 'package.sent',
                    actorUserId: input.actorId, data: { from: 'draft', to: 'open' }, at: now,
                });
            }
            for (const c of created) {
                await this.activity.record({
                    buyerWorkspaceId: pkg.buyerWorkspaceId, vendorWorkspaceId: c.invitation.vendorWorkspaceId, entity: 'invitation',
                    entityId: c.invitation.id, action: 'invitation.sent', actorUserId: input.actorId,
                    data: { packageId: pkg.id, channel: c.invitation.props.channel }, at: now,
                });
            }
            return ok(pkg);
        });
        if (!done.ok) return done;
        const pkg = done.value;
        const buyerName = await this.notices.workspaceName(pkg.buyerWorkspaceId);
        for (const c of created) await this.notices.invitation(pkg, buyerName, c.invitation, c.token);
        return ok({
            invitations: await this.views.invitationDtos(pkg, created.map(c => c.invitation), prices),
            links: created.map(c => ({ invitationId: c.invitation.id, url: this.notices.guestUrl(c.token) })),
        });
    }
}
