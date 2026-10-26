'use client';

// ─── TanStack Query hooks for every server resource, with invalidation after each mutation ───
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createProject, type Project, type ProjectStart } from '@/domain/project';
import { projectToDocs } from '@/domain/sync';
import type {
    ActivityDto, ChangeRoleRequest, CreateInvitationRequest, CreateRevisionRequest, LevelAssignmentDto, ProjectDetailDto,
    ProjectDto, UpdateProjectRequest, WorkspaceDto,
} from '@/shared/contract';
import { api } from '../api/routes';
import { useSession } from '../auth/session';
import { useCloud } from '../state';
import { projectChanged } from '../projects/cache';
import { qk } from './keys';

const useSignedIn = () => useSession(s => s.status === 'signed-in');

// ── me / workspaces ──

export function useMe() {
    const enabled = useSignedIn();
    return useQuery({ queryKey: qk.me, queryFn: () => api.me(), enabled });
}

export function useWorkspaces() {
    const enabled = useSignedIn();
    return useQuery({ queryKey: qk.workspaces, queryFn: () => api.workspaces.list(), enabled });
}

/** The workspace chosen in the switcher (default: the first, normally the personal one). */
export function useCurrentWorkspace(): {
    workspace: WorkspaceDto | undefined;
    workspaces: WorkspaceDto[];
    isLoading: boolean;
    select: (workspaceId: string) => void;
} {
    const q = useWorkspaces();
    const selected = useCloud(s => s.workspaceId);
    const select = useCloud(s => s.selectWorkspace);
    const workspaces = q.data ?? [];
    const workspace = workspaces.find(w => w.id === selected) ?? workspaces[0];
    return { workspace, workspaces, isLoading: q.isLoading, select };
}

export function useCreateWorkspace() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (name: string) => api.workspaces.create({ name }),
        onSuccess: (ws) => {
            useCloud.getState().selectWorkspace(ws.id);
            void qc.invalidateQueries({ queryKey: qk.workspaces, exact: true });
            void qc.invalidateQueries({ queryKey: qk.me });
        },
    });
}

export function useRenameWorkspace(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (name: string) => api.workspaces.rename(workspaceId, { name }),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: qk.workspaces, exact: true });
            void qc.invalidateQueries({ queryKey: qk.me });
        },
    });
}

export function useDeleteWorkspace() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (workspaceId: string) => api.workspaces.remove(workspaceId),
        onSuccess: (_v, workspaceId) => {
            if (useCloud.getState().workspaceId === workspaceId) useCloud.getState().selectWorkspace(null);
            qc.removeQueries({ queryKey: qk.workspace(workspaceId) });
            void qc.invalidateQueries({ queryKey: qk.workspaces, exact: true });
            void qc.invalidateQueries({ queryKey: qk.me });
        },
    });
}

// ── members / invitations ──

export function useMembers(workspaceId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: qk.members(workspaceId ?? '-'),
        queryFn: () => api.workspaces.members(workspaceId ?? ''),
        enabled: signedIn && workspaceId !== undefined,
    });
}

export function useChangeRole(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, role }: { userId: string } & ChangeRoleRequest) => api.workspaces.changeRole(workspaceId, userId, { role }),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: qk.members(workspaceId) });
            void qc.invalidateQueries({ queryKey: qk.workspaces, exact: true });
            void qc.invalidateQueries({ queryKey: qk.me });
        },
    });
}

/** Remove a member, or leave the workspace (your own user id). */
export function useRemoveMember(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (userId: string) => api.workspaces.removeMember(workspaceId, userId),
        onSuccess: (_v, userId) => {
            if (userId === useSession.getState().user?.id) {
                useCloud.getState().selectWorkspace(null);
                qc.removeQueries({ queryKey: qk.workspace(workspaceId) });
            } else {
                void qc.invalidateQueries({ queryKey: qk.members(workspaceId) });
            }
            void qc.invalidateQueries({ queryKey: qk.workspaces, exact: true });
            void qc.invalidateQueries({ queryKey: qk.me });
        },
    });
}

export function useInvitations(workspaceId: string | undefined, enabled = true) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: qk.invitations(workspaceId ?? '-'),
        queryFn: () => api.workspaces.invitations(workspaceId ?? ''),
        enabled: signedIn && enabled && workspaceId !== undefined,
    });
}

export function useCreateInvitation(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateInvitationRequest) => api.workspaces.invite(workspaceId, body),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.invitations(workspaceId) }); },
    });
}

export function useRevokeInvitation(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (invitationId: string) => api.workspaces.revokeInvitation(workspaceId, invitationId),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.invitations(workspaceId) }); },
    });
}

export function useAcceptInvitation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (token: string) => api.invitations.accept({ token }),
        onSuccess: (res) => {
            useCloud.getState().selectWorkspace(res.workspaceId);
            void qc.invalidateQueries({ queryKey: qk.workspaces, exact: true });
            void qc.invalidateQueries({ queryKey: qk.me });
            void qc.invalidateQueries({ queryKey: qk.members(res.workspaceId) });
        },
    });
}

// ── projects ──

export function useProjects(workspaceId: string | undefined, archived = false) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: qk.projects(workspaceId ?? '-', archived),
        queryFn: () => api.projects.list(workspaceId ?? '', { archived }),
        enabled: signedIn && workspaceId !== undefined,
    });
}

export function useProjectDetail(projectId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: qk.project(projectId ?? '-'),
        queryFn: () => api.projects.get(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
    });
}

export interface CreateProjectInput {
    name: string;
    start: ProjectStart;
    /** A guest project to upload (its documents); omitted = a new blank or sample project. */
    upload?: Project;
}

/** Documents a new cloud project starts with: the uploaded guest project, or a fresh one carrying its name. */
export function initialDocsFor(input: CreateProjectInput) {
    const fresh = createProject(input.start);
    const project = input.upload ?? { ...fresh, meta: { ...fresh.meta, projectName: input.name } };
    return projectToDocs(project).map(d => ({ docKey: d.docKey, data: d.data ?? null }));
}

export function useCreateProject(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateProjectInput) =>
            api.projects.create(workspaceId, { name: input.name, start: input.start, docs: initialDocsFor(input) }),
        onSuccess: (detail) => {
            qc.setQueryData<ProjectDetailDto>(qk.project(detail.project.id), detail);
            void qc.invalidateQueries({ queryKey: qk.projectLists(workspaceId) });
        },
    });
}

/** Rename and/or archive / restore. */
export function useUpdateProject() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ projectId, ...body }: { projectId: string } & UpdateProjectRequest) => api.projects.update(projectId, body),
        onSuccess: (project: ProjectDto) => {
            projectChanged(qc, project);
            void qc.invalidateQueries({ queryKey: qk.activity(project.id) });
        },
    });
}

export function useDeleteProject(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (projectId: string) => api.projects.remove(projectId),
        onSuccess: (_v, projectId) => {
            qc.removeQueries({ queryKey: qk.project(projectId) });
            void qc.invalidateQueries({ queryKey: qk.projectLists(workspaceId) });
        },
    });
}

// ── revisions ──

export function useRevisions(projectId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: qk.revisions(projectId ?? '-'),
        queryFn: () => api.projects.revisions(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
    });
}

export function useRevision(projectId: string | undefined, revisionId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: qk.revision(projectId ?? '-', revisionId ?? '-'),
        queryFn: () => api.projects.revision(projectId ?? '', revisionId ?? ''),
        enabled: signedIn && projectId !== undefined && revisionId !== undefined,
        staleTime: Infinity, // revisions never change
    });
}

export function useCreateRevision(projectId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateRevisionRequest) => api.projects.createRevision(projectId, body),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: qk.revisions(projectId) });
            void qc.invalidateQueries({ queryKey: qk.activity(projectId) });
        },
    });
}

// ── level assignments ──

export function useAssignments(projectId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: qk.assignments(projectId ?? '-'),
        queryFn: () => api.projects.assignments(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
    });
}

/** Replace one level's assignment in the cached list (own change or realtime). */
export function setAssignmentInCache(
    list: LevelAssignmentDto[] | undefined, levelId: string, assignment: LevelAssignmentDto | null,
): LevelAssignmentDto[] | undefined {
    if (!list) return list;
    const others = list.filter(a => a.levelId !== levelId);
    return assignment ? [...others, assignment] : others;
}

export function useAssignLevel(projectId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ levelId, userId }: { levelId: string; userId: string | null }) =>
            api.projects.putAssignment(projectId, levelId, { userId }),
        onSuccess: (assignment, { levelId }) => {
            qc.setQueryData<LevelAssignmentDto[]>(qk.assignments(projectId), old => setAssignmentInCache(old, levelId, assignment));
            void qc.invalidateQueries({ queryKey: qk.assignments(projectId) });
            void qc.invalidateQueries({ queryKey: qk.activity(projectId) });
        },
    });
}

// ── activity ──

const ACTIVITY_PAGE = 50;

export function useActivity(projectId: string | undefined) {
    const signedIn = useSignedIn();
    return useInfiniteQuery({
        queryKey: qk.activity(projectId ?? '-'),
        queryFn: ({ pageParam }) => api.projects.activity(projectId ?? '', { before: pageParam, limit: ACTIVITY_PAGE }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (last: ActivityDto[]) => (last.length < ACTIVITY_PAGE ? undefined : last[last.length - 1]?.id),
        enabled: signedIn && projectId !== undefined,
    });
}
