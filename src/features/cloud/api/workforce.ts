'use client';

// ─── Crews and people (W1, business module `workforce`): typed routes + TanStack Query hooks ───
// Backend (backend/API.md): GET /platform/modules (public); under /workspaces/:workspaceId: people, crews,
// crew-assignments (list/create/update/delete); GET/PUT /projects/:projectId/supervisors.
// Contract: src/shared/contract/workforce.ts. Wages come back null with `wagesHidden` for roles that may not see them.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
    crewAssignmentDtoSchema, crewDtoSchema, personDtoSchema, platformModulesDtoSchema, projectSupervisorsDtoSchema,
    projectTaskLagsDtoSchema, workspaceTaskLagsDtoSchema, type ProjectTaskLagsDto, type TaskLag,
    workforceConflictDetailsSchema,
    type CreateCrewAssignmentRequest, type CreateCrewRequest, type CreatePersonRequest, type CrewAssignmentDto,
    type CrewAssignmentQuery, type CrewDto, type ModuleId, type PersonDto, type ProjectSupervisorsDto, type Role,
    type UpdateCrewAssignmentRequest, type UpdateCrewRequest, type UpdatePersonRequest, type WorkforceConflictDetails,
} from '@/shared/contract';
import { useSession } from '../auth/session';
import { apiClient, type ApiClient } from './client';
import { isApiError } from './errors';

const seg = (s: string) => encodeURIComponent(s);
const ws = (workspaceId: string) => `/workspaces/${seg(workspaceId)}`;

function queryString(q: CrewAssignmentQuery): string {
    const parts = Object.entries(q)
        .filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '')
        .map(([k, v]) => `${seg(k)}=${seg(v)}`);
    return parts.length === 0 ? '' : `?${parts.join('&')}`;
}

export function createWorkforceApi(client: ApiClient) {
    return {
        platformModules: (): Promise<ModuleId[]> =>
            client.request('GET', '/platform/modules', { schema: platformModulesDtoSchema, auth: false }).then(r => r.modules),

        listPeople: (workspaceId: string): Promise<PersonDto[]> =>
            client.request('GET', `${ws(workspaceId)}/people`, { schema: z.array(personDtoSchema) }),
        createPerson: (workspaceId: string, body: CreatePersonRequest): Promise<PersonDto> =>
            client.request('POST', `${ws(workspaceId)}/people`, { body, schema: personDtoSchema }),
        updatePerson: (workspaceId: string, personId: string, body: UpdatePersonRequest): Promise<PersonDto> =>
            client.request('PATCH', `${ws(workspaceId)}/people/${seg(personId)}`, { body, schema: personDtoSchema }),
        archivePerson: (workspaceId: string, personId: string): Promise<void> =>
            client.request('DELETE', `${ws(workspaceId)}/people/${seg(personId)}`),

        listCrews: (workspaceId: string): Promise<CrewDto[]> =>
            client.request('GET', `${ws(workspaceId)}/crews`, { schema: z.array(crewDtoSchema) }),
        createCrew: (workspaceId: string, body: CreateCrewRequest): Promise<CrewDto> =>
            client.request('POST', `${ws(workspaceId)}/crews`, { body, schema: crewDtoSchema }),
        updateCrew: (workspaceId: string, crewId: string, body: UpdateCrewRequest): Promise<CrewDto> =>
            client.request('PATCH', `${ws(workspaceId)}/crews/${seg(crewId)}`, { body, schema: crewDtoSchema }),
        archiveCrew: (workspaceId: string, crewId: string): Promise<void> =>
            client.request('DELETE', `${ws(workspaceId)}/crews/${seg(crewId)}`),

        listAssignments: (workspaceId: string, q: CrewAssignmentQuery = {}): Promise<CrewAssignmentDto[]> =>
            client.request('GET', `${ws(workspaceId)}/crew-assignments${queryString(q)}`, { schema: z.array(crewAssignmentDtoSchema) }),
        /** Assign a crew to a planned task of a project (the project must belong to the workspace). */
        createAssignment: (workspaceId: string, body: CreateCrewAssignmentRequest): Promise<CrewAssignmentDto> =>
            client.request('POST', `${ws(workspaceId)}/crew-assignments`, { body, schema: crewAssignmentDtoSchema }),
        updateAssignment: (workspaceId: string, assignmentId: string, body: UpdateCrewAssignmentRequest): Promise<CrewAssignmentDto> =>
            client.request('PATCH', `${ws(workspaceId)}/crew-assignments/${seg(assignmentId)}`, { body, schema: crewAssignmentDtoSchema }),
        deleteAssignment: (workspaceId: string, assignmentId: string): Promise<void> =>
            client.request('DELETE', `${ws(workspaceId)}/crew-assignments/${seg(assignmentId)}`),

        supervisors: (projectId: string): Promise<ProjectSupervisorsDto> =>
            client.request('GET', `/projects/${seg(projectId)}/supervisors`, { schema: projectSupervisorsDtoSchema }),
        putSupervisors: (projectId: string, personIds: string[]): Promise<ProjectSupervisorsDto> =>
            client.request('PUT', `/projects/${seg(projectId)}/supervisors`, { body: { personIds }, schema: projectSupervisorsDtoSchema }),
    };
}

export type WorkforceApi = ReturnType<typeof createWorkforceApi>;
export const workforceApi: WorkforceApi = createWorkforceApi(apiClient);

// ─── Query keys (under the workspace / project keys, so dropping those drops these) ───
export const platformModulesKey = ['platform', 'modules'] as const;
export const peopleKey = (workspaceId: string) => ['workspaces', workspaceId, 'people'] as const;
export const crewsKey = (workspaceId: string) => ['workspaces', workspaceId, 'crews'] as const;
export const assignmentsKey = (workspaceId: string, q: CrewAssignmentQuery = {}) =>
    ['workspaces', workspaceId, 'crewAssignments', q] as const;
export const assignmentsRootKey = (workspaceId: string) => ['workspaces', workspaceId, 'crewAssignments'] as const;
export const supervisorsKey = (projectId: string) => ['projects', projectId, 'supervisors'] as const;

/** What a role may do (mirrors the server; the server always decides). */
export function workforceAbilities(role: Role | undefined): {
    read: boolean; manage: boolean; assign: boolean; seeWages: boolean; seeCrewCost: boolean;
} {
    const manage = role === 'owner' || role === 'admin';
    return {
        read: role !== undefined,
        manage,
        assign: manage || role === 'estimator',
        seeWages: manage,
        seeCrewCost: manage || role === 'estimator',
    };
}

/** Why a write was refused with 409 (name taken, limit reached, still in use); undefined for any other error. */
export function workforceConflict(error: unknown): WorkforceConflictDetails | undefined {
    if (!isApiError(error) || error.code !== 'conflict') return undefined;
    const parsed = workforceConflictDetailsSchema.safeParse(error.details);
    return parsed.success ? parsed.data : undefined;
}

/** Thai message for a refused write; undefined so callers can fall back to thaiErrorMessage. */
export function workforceConflictMessage(error: unknown): string | undefined {
    const c = workforceConflict(error);
    if (c === undefined) return undefined;
    switch (c.reason) {
        case 'name_taken': return `มีชื่อ "${c.name}" อยู่แล้ว ตั้งชื่ออื่น`;
        case 'limit_reached': return `เพิ่มได้สูงสุด ${c.limit} รายการ เก็บถาวรรายการที่ไม่ใช้ก่อน`;
        case 'in_use': return `ยังมีงานที่จัดไว้ ${c.assignments} งานที่ยังไม่จบ ย้ายหรือลบงานเหล่านั้นก่อน`;
    }
}

const useSignedIn = () => useSession(s => s.status === 'signed-in');

/** The modules this server offers (public). While loading, nothing is offered. */
export function usePlatformModules() {
    return useQuery({ queryKey: platformModulesKey, queryFn: () => workforceApi.platformModules(), staleTime: 5 * 60_000 });
}

/** true once the server says the workforce module is on. */
export function useWorkforceEnabled(): boolean {
    const q = usePlatformModules();
    return q.data?.includes('workforce') ?? false;
}

function listHook<T>(key: readonly unknown[], fn: () => Promise<T>, enabled: boolean) {
    return { queryKey: key, queryFn: fn, enabled };
}

export function usePeople(workspaceId: string | undefined) {
    const signedIn = useSignedIn();
    const on = useWorkforceEnabled();
    return useQuery(listHook(peopleKey(workspaceId ?? '-'), () => workforceApi.listPeople(workspaceId ?? ''),
        signedIn && on && workspaceId !== undefined));
}

export function useCrews(workspaceId: string | undefined) {
    const signedIn = useSignedIn();
    const on = useWorkforceEnabled();
    return useQuery(listHook(crewsKey(workspaceId ?? '-'), () => workforceApi.listCrews(workspaceId ?? ''),
        signedIn && on && workspaceId !== undefined));
}

export function useCrewAssignments(workspaceId: string | undefined, q: CrewAssignmentQuery = {}) {
    const signedIn = useSignedIn();
    const on = useWorkforceEnabled();
    return useQuery(listHook(assignmentsKey(workspaceId ?? '-', q), () => workforceApi.listAssignments(workspaceId ?? '', q),
        signedIn && on && workspaceId !== undefined));
}

export function useProjectSupervisors(projectId: string | undefined) {
    const signedIn = useSignedIn();
    const on = useWorkforceEnabled();
    return useQuery(listHook(supervisorsKey(projectId ?? '-'), () => workforceApi.supervisors(projectId ?? ''),
        signedIn && on && projectId !== undefined));
}

// ─── Mutations: each refetches the lists it touches ───

export function useCreatePerson(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreatePersonRequest) => workforceApi.createPerson(workspaceId, body),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: peopleKey(workspaceId) }); },
    });
}

export function useUpdatePerson(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ personId, ...body }: { personId: string } & UpdatePersonRequest) =>
            workforceApi.updatePerson(workspaceId, personId, body),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: peopleKey(workspaceId) }); },
    });
}

export function useArchivePerson(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (personId: string) => workforceApi.archivePerson(workspaceId, personId),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: peopleKey(workspaceId) });
            void qc.invalidateQueries({ queryKey: crewsKey(workspaceId) });
        },
    });
}

export function useCreateCrew(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateCrewRequest) => workforceApi.createCrew(workspaceId, body),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: crewsKey(workspaceId) }); },
    });
}

export function useUpdateCrew(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ crewId, ...body }: { crewId: string } & UpdateCrewRequest) => workforceApi.updateCrew(workspaceId, crewId, body),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: crewsKey(workspaceId) }); },
    });
}

export function useArchiveCrew(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (crewId: string) => workforceApi.archiveCrew(workspaceId, crewId),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: crewsKey(workspaceId) }); },
    });
}

export function useCreateCrewAssignment(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateCrewAssignmentRequest) => workforceApi.createAssignment(workspaceId, body),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: assignmentsRootKey(workspaceId) }); },
    });
}

export function useUpdateCrewAssignment(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ assignmentId, ...body }: { assignmentId: string } & UpdateCrewAssignmentRequest) =>
            workforceApi.updateAssignment(workspaceId, assignmentId, body),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: assignmentsRootKey(workspaceId) }); },
    });
}

export function useDeleteCrewAssignment(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (assignmentId: string) => workforceApi.deleteAssignment(workspaceId, assignmentId),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: assignmentsRootKey(workspaceId) }); },
    });
}

export function usePutProjectSupervisors(projectId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (personIds: string[]) => workforceApi.putSupervisors(projectId, personIds),
        onSuccess: (dto) => { qc.setQueryData(supervisorsKey(projectId), dto); },
    });
}

// ─── Waiting windows after tasks (W2) ───

export const projectTaskLagsKey = (projectId: string) => ['projects', projectId, 'taskLags'] as const;
export const workspaceTaskLagsKey = (workspaceId: string) => ['workspaces', workspaceId, 'taskLags'] as const;

export const taskLagsApi = {
    project: (projectId: string): Promise<ProjectTaskLagsDto> =>
        apiClient.request('GET', `/projects/${seg(projectId)}/task-lags`, { schema: projectTaskLagsDtoSchema }),
    putProject: (projectId: string, lags: TaskLag[]): Promise<ProjectTaskLagsDto> =>
        apiClient.request('PUT', `/projects/${seg(projectId)}/task-lags`, { body: { lags }, schema: projectTaskLagsDtoSchema }),
    workspace: (workspaceId: string): Promise<ProjectTaskLagsDto[]> =>
        apiClient.request('GET', `${ws(workspaceId)}/task-lags`, { schema: workspaceTaskLagsDtoSchema }),
};

export function useProjectTaskLags(projectId: string | undefined) {
    const signedIn = useSignedIn();
    const on = useWorkforceEnabled();
    return useQuery(listHook(projectTaskLagsKey(projectId ?? '-'), () => taskLagsApi.project(projectId ?? ''),
        signedIn && on && projectId !== undefined));
}

export function useWorkspaceTaskLags(workspaceId: string | undefined) {
    const signedIn = useSignedIn();
    const on = useWorkforceEnabled();
    return useQuery(listHook(workspaceTaskLagsKey(workspaceId ?? '-'), () => taskLagsApi.workspace(workspaceId ?? ''),
        signedIn && on && workspaceId !== undefined));
}

export function usePutProjectTaskLags(projectId: string, workspaceId: string | undefined) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (lags: TaskLag[]) => taskLagsApi.putProject(projectId, lags),
        onSuccess: (dto) => {
            qc.setQueryData(projectTaskLagsKey(projectId), dto);
            if (workspaceId !== undefined) void qc.invalidateQueries({ queryKey: workspaceTaskLagsKey(workspaceId) });
        },
    });
}
