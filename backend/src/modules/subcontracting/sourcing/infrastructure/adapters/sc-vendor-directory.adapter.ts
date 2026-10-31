// ─── ScVendorDirectory (shared/application/ports.ts, WP-37): the vendor list as the supplier register imports it ───
import { Injectable } from '@nestjs/common';
import { ModuleFlags, ScVendorDirectory, type ScVendorDirectoryEntry } from '../../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../../shared/domain/ids';
import { VendorListRepository } from '../../application/ports/sourcing.repositories';

@Injectable()
export class SourcingScVendorDirectory extends ScVendorDirectory {
    constructor(private readonly flags: ModuleFlags, private readonly entries: VendorListRepository) {
        super();
    }

    async listEntries(workspaceId: WorkspaceId): Promise<ScVendorDirectoryEntry[]> {
        if (!(await this.flags.isEnabled(workspaceId, 'subcontracting'))) return [];
        return (await this.entries.list(workspaceId))
            .filter(e => e.props.hiddenAt === null)
            .map(e => {
                const p = e.props;
                return {
                    id: p.id, displayName: p.displayName, phone: p.phone, lineId: p.lineId, trades: [...p.trades],
                    province: p.province, privateNote: p.privateNote, vendorWorkspaceId: p.vendorWorkspaceId,
                };
            });
    }
}
