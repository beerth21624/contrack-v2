// ─── Takes the snapshot of package lines from the live BOQ of the project ───
import { Injectable } from '@nestjs/common';
import type { SupplyMode } from '@contrack/contract';
import { computeProject } from '@contrack/domain/project';
import { type Snapshot, buildSnapshot } from '@contrack/domain/subcontracting';
import { ProjectReader, type ProjectRead } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { ProjectId } from '../../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../../shared/domain/result';
import type { PackageSelection } from '../../domain/entities/work-package.entity';
import { SourcingErrors } from '../../domain/sourcing.errors';

@Injectable()
export class PackageSnapshots {
    constructor(private readonly projects: ProjectReader) {}

    async read(projectId: ProjectId): Promise<ProjectRead | undefined> {
        return this.projects.read(projectId);
    }

    /** Unknown BOQ keys → 422 with the keys; a missing project → not_found. */
    async take(projectId: ProjectId, selection: PackageSelection, supplyMode: SupplyMode, read?: ProjectRead): Promise<Result<Snapshot, DomainError>> {
        const project = read ?? await this.projects.read(projectId);
        if (project === undefined) return err(SourcingErrors.projectNotFound());
        return this.fromRead(project, selection, supplyMode);
    }

    fromRead(read: ProjectRead, selection: PackageSelection, supplyMode: SupplyMode): Result<Snapshot, DomainError> {
        const res = buildSnapshot(computeProject(read.project).boq, {
            lineKeys: selection.lineKeys, customLines: selection.customLines, supplyMode, materialByLine: selection.materialByLine,
        });
        if (!res.ok) return err(SourcingErrors.unknownLines(res.unknownKeys));
        if (res.snapshot.lines.length === 0) return err(SourcingErrors.noLines());
        return ok(res.snapshot);
    }
}
