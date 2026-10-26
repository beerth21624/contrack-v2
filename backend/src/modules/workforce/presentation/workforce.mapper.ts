// ─── Workforce entities → contract DTOs (dates as ISO strings); wages hidden here, by the caller's role ───
// A person's daily wage: owner/admin only (`workforce.seeWages`). A crew's daily cost and its typed override:
// owner/admin/estimator (`workforce.seeCrewCost`). Hidden values are null with `wagesHidden: true`.
import type { CrewAssignmentDto, CrewDto, PersonDto, ProjectSupervisorsDto, Role } from '@contrack/contract';
import { can } from '../../../shared/domain/permissions';
import type { PricedCrew } from '../application/crew-pricing';
import type { ProjectSupervisors } from '../application/use-cases/project-supervisors.use-case';
import type { CrewAssignment } from '../domain/entities/crew-assignment.entity';
import type { Person } from '../domain/entities/person.entity';

export function personToDto(p: Person, role: Role): PersonDto {
    const hidden = !can(role, 'workforce.seeWages');
    return {
        id: p.id,
        workspaceId: p.workspaceId,
        name: p.name.value,
        nickname: p.nickname,
        phone: p.phone,
        role: p.role,
        employment: p.employment,
        trades: p.trades,
        dailyWage: hidden ? null : p.dailyWage,
        wagesHidden: hidden,
        note: p.note,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        archivedAt: p.archivedAt?.toISOString() ?? null,
    };
}

export function crewToDto({ crew: c, dailyCost }: PricedCrew, role: Role): CrewDto {
    const hidden = !can(role, 'workforce.seeCrewCost');
    return {
        id: c.id,
        workspaceId: c.workspaceId,
        name: c.name.value,
        trade: c.trade,
        leaderId: c.leaderId,
        memberIds: c.memberIds,
        skilledCount: c.skilledCount,
        labourerCount: c.labourerCount,
        rateCardId: c.rateCardId,
        dailyCostOverride: hidden ? null : c.dailyCostOverride,
        dailyCost: hidden ? null : dailyCost,
        wagesHidden: hidden,
        note: c.note,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        archivedAt: c.archivedAt?.toISOString() ?? null,
    };
}

export function assignmentToDto(a: CrewAssignment): CrewAssignmentDto {
    return {
        id: a.id,
        workspaceId: a.workspaceId,
        projectId: a.projectId,
        taskId: a.taskId,
        crewId: a.crewId,
        start: a.start,
        end: a.end,
        note: a.note,
        createdBy: a.createdBy,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
    };
}

export function supervisorsToDto(s: ProjectSupervisors): ProjectSupervisorsDto {
    return { projectId: s.projectId, personIds: [...s.personIds] };
}
