import { Injectable } from '@nestjs/common';
import type { AddendumRequest, BuyerPackageDto } from '@contrack/contract';
import { changedLines } from '@contrack/domain/subcontracting';
import { Clock, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId } from '../../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../../shared/domain/result';
import { newOpaqueToken, sha256 } from '../../../../../shared/infrastructure/crypto';
import type { PackageId, ScInvitationId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import type { ScInvitation } from '../../domain/entities/sc-invitation.entity';
import type { WorkPackage } from '../../domain/entities/work-package.entity';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { SmsRateLimiter, buyerSmsRules } from '../ports/sms-rate-limiter.port';
import { InvitationRepository, WorkPackageRepository } from '../ports/sourcing.repositories';
import { PackageLineGuard } from '../services/package-line-guard.service';
import { PackageSnapshots } from '../services/package-snapshots.service';
import { selectionOf } from '../services/package-input';
import { SourcingAccess } from '../services/sourcing-access.service';
import { SourcingNotices } from '../services/sourcing-notices.service';
import { SourcingViews, hasSubmitted } from '../services/sourcing-views.service';

export interface IssueAddendumInput {
    actorId: UserId;
    packageId: PackageId;
    body: AddendumRequest;
}

/**
 * `sc.packages.manage`. A sent, undecided package gets a new version of its lines (snapshot from the live BOQ,
 * changed lines recorded); every invitee still in the running is told (SMS invitees without an account get a fresh
 * link). Past the bid deadline → conflict { reason: 'deadline_passed' } (extend first); BOQ lines in another live
 * package of the project → conflict { lineKeys }; over the buyer's daily SMS budget → rate_limited.
 */
@Injectable()
export class IssueAddendumUseCase {
    constructor(
        private readonly access: SourcingAccess,
        private readonly packages: WorkPackageRepository,
        private readonly invitations: InvitationRepository,
        private readonly snapshots: PackageSnapshots,
        private readonly lineGuard: PackageLineGuard,
        private readonly views: SourcingViews,
        private readonly notices: SourcingNotices,
        private readonly limiter: SmsRateLimiter,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: IssueAddendumInput): Promise<Result<BuyerPackageDto, DomainError>> {
        const found = await this.access.buyerPackage(input.actorId, input.packageId, ['sc.packages.manage']);
        if (!found.ok) return found;
        const { prices } = found.value;
        const now = this.clock.now();
        const tokens = new Map<ScInvitationId, string>();
        const done = await this.uow.run(async (): Promise<Result<{ pkg: WorkPackage; invitees: ScInvitation[] }, DomainError>> => {
            const locked = await this.access.lockPackage(input.packageId);
            if (!locked.ok) return locked;
            const pkg = locked.value;
            const invitations = await this.invitations.lockByPackage(pkg.id);
            pkg.settle(now, hasSubmitted(invitations));
            if (pkg.isDraft) return err(SourcingErrors.notSent());
            if (!pkg.isActive) return err(SourcingErrors.finished());
            if (now.getTime() >= pkg.props.bidDeadline.getTime()) return err(SourcingErrors.addendumAfterDeadline());
            const selection = selectionOf(input.body.lineKeys, input.body.customLines, input.body.materialByLine, pkg.props.supplyMode);
            const free = await this.lineGuard.check(pkg.buyerWorkspaceId, pkg.props.projectId, selection.lineKeys, pkg.id);
            if (!free.ok) return free;
            const snapshot = await this.snapshots.take(pkg.props.projectId, selection, pkg.props.supplyMode);
            if (!snapshot.ok) return snapshot;
            const issued = pkg.addendum({
                selection, snapshot: snapshot.value, changedIdx: changedLines(pkg.lines, snapshot.value.lines), note: input.body.note,
                by: input.actorId, now,
            });
            if (!issued.ok) return issued;
            const invitees = invitations.filter(i => i.isInRunning);
            const sms = invitees.filter(i => i.props.channel !== 'link').length;
            if (!(await this.limiter.tryTake(buyerSmsRules(pkg.buyerWorkspaceId, sms)))) return err(SourcingErrors.rateLimited());
            await this.packages.update(pkg);
            for (const inv of invitees.filter(i => SourcingNotices.smsLinkNeeded(i))) {
                const token = newOpaqueToken();
                await this.invitations.addToken(inv.id, sha256(token), now);
                tokens.set(inv.id, token);
            }
            await this.activity.record({
                buyerWorkspaceId: pkg.buyerWorkspaceId, entity: 'package', entityId: pkg.id, action: 'package.addendum',
                actorUserId: input.actorId, data: { version: issued.value.version, changed: issued.value.changedIdx.length }, at: now,
            });
            return ok({ pkg, invitees });
        });
        if (!done.ok) return done;
        const { pkg, invitees } = done.value;
        const buyerName = await this.notices.workspaceName(pkg.buyerWorkspaceId);
        for (const inv of invitees) await this.notices.addendum(pkg, buyerName, inv, tokens.get(inv.id));
        return ok(await this.views.buyerPackage(pkg, prices));
    }
}
