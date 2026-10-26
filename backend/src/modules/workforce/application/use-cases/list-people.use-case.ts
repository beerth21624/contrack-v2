import { Injectable } from '@nestjs/common';
import type { Role } from '@contrack/contract';
import { type DomainError, type Result, type UserId, type WorkspaceId, ok } from '../../../../shared/domain';
import type { Person } from '../../domain/entities/person.entity';
import { PersonRepository } from '../ports/person.repository';
import { WorkforceAccess } from '../workforce-access';

export interface ListPeopleInput {
    userId: UserId;
    workspaceId: WorkspaceId;
}

/** The workspace's active people, oldest first, with the caller's role (it decides whether wages are shown). */
@Injectable()
export class ListPeopleUseCase {
    constructor(private readonly access: WorkforceAccess, private readonly people: PersonRepository) {}

    async execute(input: ListPeopleInput): Promise<Result<{ role: Role; people: Person[] }, DomainError>> {
        const granted = await this.access.inWorkspace(input.userId, input.workspaceId, 'workforce.read');
        if (!granted.ok) return granted;
        return ok({ role: granted.value, people: await this.people.listActive(input.workspaceId) });
    }
}
