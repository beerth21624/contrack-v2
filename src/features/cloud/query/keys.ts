// ─── TanStack Query keys (one place, so invalidation matches every query) ───

export const qk = {
    me: ['me'] as const,
    workspaces: ['workspaces'] as const,
    workspace: (workspaceId: string) => ['workspaces', workspaceId] as const,
    members: (workspaceId: string) => ['workspaces', workspaceId, 'members'] as const,
    invitations: (workspaceId: string) => ['workspaces', workspaceId, 'invitations'] as const,
    /** Every project list of a workspace (active and archived). */
    projectLists: (workspaceId: string) => ['workspaces', workspaceId, 'projects'] as const,
    projects: (workspaceId: string, archived: boolean) => ['workspaces', workspaceId, 'projects', { archived }] as const,
    project: (projectId: string) => ['projects', projectId] as const,
    revisions: (projectId: string) => ['projects', projectId, 'revisions'] as const,
    revision: (projectId: string, revisionId: string) => ['projects', projectId, 'revisions', revisionId] as const,
    assignments: (projectId: string) => ['projects', projectId, 'assignments'] as const,
    activity: (projectId: string) => ['projects', projectId, 'activity'] as const,
};
