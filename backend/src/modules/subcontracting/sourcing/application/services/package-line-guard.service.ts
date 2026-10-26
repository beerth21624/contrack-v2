// ─── One BOQ line, one live package: a line already in another live package of the project cannot be picked ───
// Live = draft / open / reviewing / awarded (cancelled, expired and closed packages free their lines; plan §4.3).
import { Injectable } from '@nestjs/common';
import type { PackageStatus } from '@contrack/contract';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { ProjectId, WorkspaceId } from '../../../../../shared/domain/ids';
import { type Result, err, okVoid } from '../../../../../shared/domain/result';
import type { PackageId } from '../../../shared/ids';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { WorkPackageRepository } from '../ports/sourcing.repositories';

export const LIVE_PACKAGE_STATUSES: readonly PackageStatus[] = ['draft', 'open', 'reviewing', 'awarded'];

@Injectable()
export class PackageLineGuard {
    constructor(private readonly packages: WorkPackageRepository) {}

    /** conflict { lineKeys } with the keys of `lineKeys` already in another live package of the project. */
    async check(
        buyerWorkspaceId: WorkspaceId, projectId: ProjectId, lineKeys: readonly string[], except?: PackageId,
    ): Promise<Result<undefined, DomainError>> {
        if (lineKeys.length === 0) return okVoid();
        const taken = new Set<string>();
        for (const other of await this.packages.listByProject(buyerWorkspaceId, projectId)) {
            if (other.id === except || !LIVE_PACKAGE_STATUSES.includes(other.status)) continue;
            for (const key of other.props.selection.lineKeys) taken.add(key);
        }
        const clash = [...new Set(lineKeys)].filter(k => taken.has(k));
        return clash.length === 0 ? okVoid() : err(SourcingErrors.linesInOtherPackage(clash));
    }
}
