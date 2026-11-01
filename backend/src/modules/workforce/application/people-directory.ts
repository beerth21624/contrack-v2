// ─── The PeopleDirectory port (labour, WP-44): people with their daily wage, crews with their members ───
import { Injectable } from '@nestjs/common';
import { type LabourPerson, PeopleDirectory } from '../../../shared/application/ports';
import { type WorkspaceId, asCrewId, asPersonId, isUuid } from '../../../shared/domain';
import { CrewRepository } from './ports/crew.repository';
import { PersonRepository } from './ports/person.repository';

const ids = (raw: readonly string[]): string[] => [...new Set(raw.filter(isUuid).map(i => i.toLowerCase()))];

@Injectable()
export class WorkforcePeopleDirectory extends PeopleDirectory {
    constructor(private readonly people: PersonRepository, private readonly crews: CrewRepository) {
        super();
    }

    async find(workspaceId: WorkspaceId, personIds: readonly string[], opts: { wages: boolean }): Promise<Map<string, LabourPerson>> {
        const out = new Map<string, LabourPerson>();
        const wanted = ids(personIds);
        if (wanted.length === 0) return out;
        for (const p of await this.people.findMany(workspaceId, wanted.map(asPersonId))) {
            out.set(p.id, {
                personId: p.id, name: p.name.value, role: p.role, dailyWage: opts.wages ? p.dailyWage : null, archived: p.isArchived,
            });
        }
        return out;
    }

    async crewMembers(workspaceId: WorkspaceId, crewIds: readonly string[]): Promise<Map<string, { crewName: string; personIds: string[] }>> {
        const out = new Map<string, { crewName: string; personIds: string[] }>();
        for (const id of ids(crewIds)) {
            const crew = await this.crews.find(workspaceId, asCrewId(id));
            if (crew === undefined) continue;
            const members = [...new Set([...(crew.leaderId === null ? [] : [crew.leaderId]), ...crew.memberIds])];
            out.set(crew.id, { crewName: crew.name.value, personIds: members });
        }
        return out;
    }
}
