// ─── What ending a subcontract means for its package (inside the same transaction) ───
// Every subcontract of the package cancelled before it started → the package is open for another award again: package
// back to reviewing AND the bids' decisions reset (selected / not_selected → submitted), so the award can be made again.
// Every subcontract closed or ended (terminated / cancelled), at least one not cancelled → the package is finished.
// The caller passes the package's subcontracts LOCKED (SubcontractRepository.lockByPackage), so two subcontracts of one
// package ending at the same time cannot both miss that they were the last one.
import { Injectable } from '@nestjs/common';
import { BidDirectory, PackageDirectory } from '../../shared/ports';
import type { Subcontract } from '../domain/entities/subcontract.entity';

@Injectable()
export class PackageFollowUp {
    constructor(private readonly packages: PackageDirectory, private readonly bids: BidDirectory) {}

    /** `siblings`: every subcontract of the package as locked by the caller (`sc` may be among them, stale). */
    async afterEnded(sc: Subcontract, siblings: readonly Subcontract[], at: Date): Promise<void> {
        const all = [...siblings.filter(s => s.id !== sc.id), sc];
        if (all.every(s => s.status === 'cancelled')) {
            await this.packages.reopenAfterCancel(sc.packageId, at);
            await this.bids.resetDecisions(sc.packageId);
            return;
        }
        if (all.every(s => s.status === 'closed' || s.status === 'terminated' || s.status === 'cancelled')) {
            await this.packages.markClosed(sc.packageId, at);
        }
    }
}
