// ─── Entities → contract DTOs (dates as ISO strings) ───
// Lives in application (not presentation) because use cases also need DTOs: realtime events and the
// `version_conflict` details carry them. Controllers use the same functions.
import type {
    ActivityDto, LevelAssignmentDto, ProjectDetailDto, ProjectDocDto, ProjectDto, RevisionDetailDto, RevisionDto,
    VersionConflictDetails,
} from '@contrack/contract';
import { DomainError } from '../../../shared/domain';
import type { ActivityEntry } from '../domain/entities/activity-entry.entity';
import type { LevelAssignment } from '../domain/entities/level-assignment.entity';
import type { ProjectDoc } from '../domain/entities/project-doc.entity';
import type { Project } from '../domain/entities/project.entity';
import type { Revision } from '../domain/entities/revision.entity';

export function projectToDto(p: Project): ProjectDto {
    return {
        id: p.id,
        workspaceId: p.workspaceId,
        name: p.name.value,
        start: p.start,
        engineVersion: p.engineVersion,
        schemaVersion: p.schemaVersion,
        summary: { ...p.summary },
        createdBy: p.createdBy,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        archivedAt: p.archivedAt?.toISOString() ?? null,
    };
}

export function projectDocToDto(d: ProjectDoc): ProjectDocDto {
    return {
        docKey: d.docKey,
        data: d.data,
        version: d.version,
        updatedBy: d.updatedBy,
        updatedAt: d.updatedAt.toISOString(),
    };
}

export function projectDetailToDto(project: Project, docs: readonly ProjectDoc[]): ProjectDetailDto {
    return { project: projectToDto(project), docs: docs.map(projectDocToDto) };
}

export function revisionToDto(r: Revision): RevisionDto {
    return {
        id: r.id,
        projectId: r.projectId,
        label: r.label,
        note: r.note,
        totals: { ...r.totals },
        createdBy: r.createdBy,
        createdAt: r.createdAt.toISOString(),
    };
}

export function revisionToDetailDto(r: Revision): RevisionDetailDto {
    return { ...revisionToDto(r), snapshot: r.snapshot };
}

export function assignmentToDto(a: LevelAssignment): LevelAssignmentDto {
    return { levelId: a.levelId, userId: a.userId, assignedBy: a.assignedBy, assignedAt: a.assignedAt.toISOString() };
}

export function activityToDto(e: ActivityEntry): ActivityDto {
    return {
        id: e.id.toString(),
        projectId: e.projectId,
        userId: e.userId,
        action: e.action,
        docKey: e.docKey,
        at: e.at.toISOString(),
    };
}

/** 409 `version_conflict` whose details are the document as it is now on the server (null = it does not exist). */
export function versionConflict(current: ProjectDoc | undefined): DomainError {
    const details: VersionConflictDetails = { current: current === undefined ? null : projectDocToDto(current) };
    return new DomainError('version_conflict', 'The document was changed by someone else', details);
}
