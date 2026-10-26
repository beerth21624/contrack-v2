// ─── Keeping the query cache in step with a project the server just changed (own save or realtime) ───
import type { QueryClient } from '@tanstack/react-query';
import type { ProjectDetailDto, ProjectDto } from '@/shared/contract';
import { qk } from '../query/keys';
import { useCloud } from '../state';

/** Write a fresh ProjectDto into every cached place it appears and refresh the project lists. */
export function projectChanged(queryClient: QueryClient, project: ProjectDto, options: { refetchLists?: boolean } = {}): void {
    queryClient.setQueryData<ProjectDetailDto>(qk.project(project.id), old => (old ? { ...old, project } : old));
    queryClient.setQueriesData<ProjectDto[]>({ queryKey: qk.projectLists(project.workspaceId) }, old =>
        old?.map(p => (p.id === project.id ? project : p)));
    if (options.refetchLists ?? true) {
        void queryClient.invalidateQueries({ queryKey: qk.projectLists(project.workspaceId) });
    }
    const open = useCloud.getState().project;
    if (open?.id === project.id) useCloud.setState({ project });
}
