// ─── Route parameters / query of the workforce API → branded ids (a malformed id is a 404, like an unknown one) ───
import type {
    CrewAssignmentId, CrewId, PersonId, ProjectId, WorkspaceId,
} from '../../../shared/domain';
import { parseId } from '../../../shared/domain';
import { unwrap } from '../../../shared/presentation/http';

export const workspaceIdParam = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));
export const projectIdParam = (raw: string): ProjectId => unwrap(parseId<'ProjectId'>(raw, 'Project'));
export const personIdParam = (raw: string): PersonId => unwrap(parseId<'PersonId'>(raw, 'Person'));
export const crewIdParam = (raw: string): CrewId => unwrap(parseId<'CrewId'>(raw, 'Crew'));
export const assignmentIdParam = (raw: string): CrewAssignmentId =>
    unwrap(parseId<'CrewAssignmentId'>(raw, 'Crew assignment'));
