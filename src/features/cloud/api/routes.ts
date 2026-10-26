// ─── One typed function per backend route (backend/API.md) ───
import { z } from 'zod';
import {
    acceptInvitationResponseSchema, activityDtoSchema, authResponseSchema, createInvitationResponseSchema,
    invitationDtoSchema, levelAssignmentDtoSchema, meResponseSchema, memberDtoSchema, projectDetailDtoSchema,
    projectDtoSchema, putDocResponseSchema, revisionDetailDtoSchema, revisionDtoSchema, workspaceDtoSchema,
    type AcceptInvitationRequest, type AcceptInvitationResponse, type ActivityDto, type AuthResponse,
    type ChangeRoleRequest, type CreateInvitationRequest, type CreateInvitationResponse, type CreateProjectRequest,
    type CreateRevisionRequest, type CreateWorkspaceRequest, type InvitationDto, type LevelAssignmentDto,
    type LoginRequest, type MeResponse, type MemberDto, type ProjectDetailDto, type ProjectDto, type PutAssignmentRequest,
    type PutDocRequest, type PutDocResponse, type RegisterRequest, type RenameWorkspaceRequest, type RevisionDetailDto,
    type RevisionDto, type UpdateProjectRequest, type WorkspaceDto,
} from '@/shared/contract';
import { apiClient, type ApiClient } from './client';

const seg = (s: string) => encodeURIComponent(s);

export interface ListProjectsParams { archived?: boolean }
export interface ActivityParams { before?: string; limit?: number }

export function createApi(client: ApiClient) {
    return {
        auth: {
            register: async (body: RegisterRequest): Promise<AuthResponse> => {
                const auth = await client.request('POST', '/auth/register', { body, schema: authResponseSchema, auth: false });
                client.setAuth(auth);
                return auth;
            },
            login: async (body: LoginRequest): Promise<AuthResponse> => {
                const auth = await client.request('POST', '/auth/login', { body, schema: authResponseSchema, auth: false });
                client.setAuth(auth);
                return auth;
            },
            /** Single flight; null = no session. */
            refresh: (): Promise<AuthResponse | null> => client.refresh(),
            logout: async (): Promise<void> => {
                try {
                    await client.request('POST', '/auth/logout', { auth: false });
                } finally {
                    client.setAuth(null);
                }
            },
        },

        me: (): Promise<MeResponse> => client.request('GET', '/me', { schema: meResponseSchema }),

        workspaces: {
            list: (): Promise<WorkspaceDto[]> => client.request('GET', '/workspaces', { schema: z.array(workspaceDtoSchema) }),
            create: (body: CreateWorkspaceRequest): Promise<WorkspaceDto> =>
                client.request('POST', '/workspaces', { body, schema: workspaceDtoSchema }),
            get: (workspaceId: string): Promise<WorkspaceDto> =>
                client.request('GET', `/workspaces/${seg(workspaceId)}`, { schema: workspaceDtoSchema }),
            rename: (workspaceId: string, body: RenameWorkspaceRequest): Promise<WorkspaceDto> =>
                client.request('PATCH', `/workspaces/${seg(workspaceId)}`, { body, schema: workspaceDtoSchema }),
            remove: (workspaceId: string): Promise<void> => client.request('DELETE', `/workspaces/${seg(workspaceId)}`),

            members: (workspaceId: string): Promise<MemberDto[]> =>
                client.request('GET', `/workspaces/${seg(workspaceId)}/members`, { schema: z.array(memberDtoSchema) }),
            changeRole: (workspaceId: string, userId: string, body: ChangeRoleRequest): Promise<MemberDto> =>
                client.request('PATCH', `/workspaces/${seg(workspaceId)}/members/${seg(userId)}`, { body, schema: memberDtoSchema }),
            removeMember: (workspaceId: string, userId: string): Promise<void> =>
                client.request('DELETE', `/workspaces/${seg(workspaceId)}/members/${seg(userId)}`),

            invitations: (workspaceId: string): Promise<InvitationDto[]> =>
                client.request('GET', `/workspaces/${seg(workspaceId)}/invitations`, { schema: z.array(invitationDtoSchema) }),
            invite: (workspaceId: string, body: CreateInvitationRequest): Promise<CreateInvitationResponse> =>
                client.request('POST', `/workspaces/${seg(workspaceId)}/invitations`, { body, schema: createInvitationResponseSchema }),
            revokeInvitation: (workspaceId: string, invitationId: string): Promise<void> =>
                client.request('DELETE', `/workspaces/${seg(workspaceId)}/invitations/${seg(invitationId)}`),
        },

        invitations: {
            accept: (body: AcceptInvitationRequest): Promise<AcceptInvitationResponse> =>
                client.request('POST', '/invitations/accept', { body, schema: acceptInvitationResponseSchema }),
        },

        projects: {
            list: (workspaceId: string, params: ListProjectsParams = {}): Promise<ProjectDto[]> =>
                client.request('GET', `/workspaces/${seg(workspaceId)}/projects`, {
                    schema: z.array(projectDtoSchema),
                    query: { archived: params.archived === undefined ? undefined : String(params.archived) },
                }),
            create: (workspaceId: string, body: CreateProjectRequest): Promise<ProjectDetailDto> =>
                client.request('POST', `/workspaces/${seg(workspaceId)}/projects`, { body, schema: projectDetailDtoSchema }),
            get: (projectId: string): Promise<ProjectDetailDto> =>
                client.request('GET', `/projects/${seg(projectId)}`, { schema: projectDetailDtoSchema }),
            update: (projectId: string, body: UpdateProjectRequest): Promise<ProjectDto> =>
                client.request('PATCH', `/projects/${seg(projectId)}`, { body, schema: projectDtoSchema }),
            remove: (projectId: string): Promise<void> => client.request('DELETE', `/projects/${seg(projectId)}`),

            putDoc: (projectId: string, docKey: string, body: PutDocRequest): Promise<PutDocResponse> =>
                client.request('PUT', `/projects/${seg(projectId)}/docs/${seg(docKey)}`, { body, schema: putDocResponseSchema }),

            revisions: (projectId: string): Promise<RevisionDto[]> =>
                client.request('GET', `/projects/${seg(projectId)}/revisions`, { schema: z.array(revisionDtoSchema) }),
            createRevision: (projectId: string, body: CreateRevisionRequest): Promise<RevisionDto> =>
                client.request('POST', `/projects/${seg(projectId)}/revisions`, { body, schema: revisionDtoSchema }),
            revision: (projectId: string, revisionId: string): Promise<RevisionDetailDto> =>
                client.request('GET', `/projects/${seg(projectId)}/revisions/${seg(revisionId)}`, { schema: revisionDetailDtoSchema }),

            assignments: (projectId: string): Promise<LevelAssignmentDto[]> =>
                client.request('GET', `/projects/${seg(projectId)}/assignments`, { schema: z.array(levelAssignmentDtoSchema) }),
            putAssignment: (projectId: string, levelId: string, body: PutAssignmentRequest): Promise<LevelAssignmentDto | null> =>
                client.request('PUT', `/projects/${seg(projectId)}/assignments/${seg(levelId)}`, {
                    // `null` (unassigned) may come back as JSON null or as an empty 204.
                    body, schema: levelAssignmentDtoSchema.nullish().transform(v => v ?? null),
                }),

            activity: (projectId: string, params: ActivityParams = {}): Promise<ActivityDto[]> =>
                client.request('GET', `/projects/${seg(projectId)}/activity`, {
                    schema: z.array(activityDtoSchema), query: { before: params.before, limit: params.limit },
                }),
        },
    };
}

export type Api = ReturnType<typeof createApi>;

export const api: Api = createApi(apiClient);
