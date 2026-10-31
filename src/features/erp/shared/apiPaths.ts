// ─── API paths of the ERP modules (docs/erp/01-architecture.md §1.4): every segment URL-encoded ───
// Workspace data: /workspaces/:workspaceId/<resource>; project data: /projects/:projectId/<resource>;
// actions on a document: /<resource>/:id/<verb>. Pass each segment separately, never a pre-joined path.

/** One URL path segment, encoded (`a/b` → `a%2Fb`). */
export const seg = (s: string): string => encodeURIComponent(s);

/** `/a/b/c` from raw segments (each encoded). */
export function apiPath(...segments: readonly string[]): string {
    return `/${segments.map(seg).join('/')}`;
}

/** `/workspaces/:workspaceId/…rest`. */
export function workspacePath(workspaceId: string, ...rest: readonly string[]): string {
    return apiPath('workspaces', workspaceId, ...rest);
}

/** `/projects/:projectId/…rest`. */
export function projectPath(projectId: string, ...rest: readonly string[]): string {
    return apiPath('projects', projectId, ...rest);
}
