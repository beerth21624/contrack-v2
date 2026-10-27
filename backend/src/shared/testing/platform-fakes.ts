// ─── Fakes of the platform / cross-module ports, for unit tests of any module (not a spec itself) ───
import type { FileDto, FilePurpose, ModuleId, Role } from '@contrack/contract';
import {
    AppLinks, FileService, ModuleFlags, type NotificationRequest, Notifier, ProjectDirectory, ProjectReader, type ProjectRead,
    WorkspaceAccess, WorkspaceDirectory,
} from '../application/ports';
import { DomainError, type ProjectId, type Result, type UserId, type WorkspaceId, err, okVoid } from '../domain';

/** Every module on for every workspace unless switched off with `set`. */
export class FakeModuleFlags extends ModuleFlags {
    platform = new Set<ModuleId>(['subcontracting', 'materials', 'owner-leads', 'ai-assist', 'workforce']);
    private readonly off = new Set<string>();

    set(workspaceId: WorkspaceId, module: ModuleId, enabled: boolean): void {
        const key = `${workspaceId}|${module}`;
        if (enabled) this.off.delete(key);
        else this.off.add(key);
    }

    platformEnabled(module: ModuleId): boolean {
        return this.platform.has(module);
    }

    isEnabled(workspaceId: WorkspaceId, module: ModuleId): Promise<boolean> {
        return Promise.resolve(this.platform.has(module) && !this.off.has(`${workspaceId}|${module}`));
    }
}

/** Files "uploaded" with `add`; describe returns them with a fake signed URL. */
export class FakeFileService extends FileService {
    readonly files = new Map<string, FileDto & { uploadedBy: UserId; purpose: FilePurpose }>();
    private n = 0;

    add(uploadedBy: UserId, purpose: FilePurpose = 'package_attachment', name = 'file.jpg'): FileDto {
        this.n += 1;
        const id = `00000000-0000-4000-9000-${this.n.toString(16).padStart(12, '0')}`;
        const dto: FileDto = { id, name, contentType: 'image/jpeg', size: 1, url: `/files/${id}/content?sig=test`, createdAt: '2026-01-01T00:00:00.000Z' };
        this.files.set(id, { ...dto, uploadedBy, purpose });
        return dto;
    }

    describe(ids: readonly string[]): Promise<FileDto[]> {
        const out: FileDto[] = [];
        for (const id of ids) {
            const f = this.files.get(id);
            if (f !== undefined) out.push({ id: f.id, name: f.name, contentType: f.contentType, size: f.size, url: f.url, createdAt: f.createdAt });
        }
        return Promise.resolve(out);
    }

    assertUploadedBy(ids: readonly string[], userId: UserId): Promise<Result<undefined, DomainError>> {
        const bad = ids.find(id => this.files.get(id)?.uploadedBy !== userId);
        return Promise.resolve(bad === undefined ? okVoid() : err(DomainError.unprocessable('unknown file', { fileId: bad })));
    }

    store(input: { name: string; contentType: string; bytes: Uint8Array; uploadedBy: UserId; purpose: FilePurpose }): Promise<FileDto> {
        const dto = this.add(input.uploadedBy, input.purpose, input.name);
        return Promise.resolve({ ...dto, contentType: input.contentType, size: input.bytes.length });
    }
}

export class RecordingNotifier extends Notifier {
    readonly sent: NotificationRequest[] = [];

    notify(request: NotificationRequest): Promise<void> {
        this.sent.push(request);
        return Promise.resolve();
    }

    templates(): string[] {
        return this.sent.map(s => s.template);
    }
}

export class FixedAppLinks extends AppLinks {
    url(path: string): string {
        return `https://app.test${path.startsWith('/') ? path : `/${path}`}`;
    }
}

export class FakeWorkspaceDirectory extends WorkspaceDirectory {
    readonly nameOf = new Map<WorkspaceId, string>();
    readonly personal = new Map<UserId, WorkspaceId>();

    names(ids: readonly WorkspaceId[]): Promise<Map<WorkspaceId, string>> {
        return Promise.resolve(new Map(ids.filter(id => this.nameOf.has(id)).map(id => [id, this.nameOf.get(id) ?? ''])));
    }

    personalWorkspaceOf(userId: UserId): Promise<WorkspaceId | undefined> {
        return Promise.resolve(this.personal.get(userId));
    }

    readonly members = new Map<WorkspaceId, UserId[]>();

    memberIds(workspaceId: WorkspaceId): Promise<UserId[]> {
        return Promise.resolve([...(this.members.get(workspaceId) ?? [])]);
    }
}

/** Roles set with `set(userId, workspaceId, role)`. */
export class FakeRoles extends WorkspaceAccess {
    private readonly roles = new Map<string, Role>();

    set(userId: UserId, workspaceId: WorkspaceId, role: Role | undefined): void {
        const key = `${userId}|${workspaceId}`;
        if (role === undefined) this.roles.delete(key);
        else this.roles.set(key, role);
    }

    roleOf(userId: UserId, workspaceId: WorkspaceId): Promise<Role | undefined> {
        return Promise.resolve(this.roles.get(`${userId}|${workspaceId}`));
    }
}

/** Projects registered with `add` (e.g. createProject('sample') from @contrack/domain/project). */
export class FakeProjects extends ProjectReader {
    readonly byId = new Map<ProjectId, ProjectRead>();

    add(read: ProjectRead): void {
        this.byId.set(read.projectId, read);
    }

    read(projectId: ProjectId): Promise<ProjectRead | undefined> {
        return Promise.resolve(this.byId.get(projectId));
    }

    /** A ProjectDirectory backed by the same projects. */
    directory(): ProjectDirectory {
        const byId = this.byId;
        return new (class extends ProjectDirectory {
            workspaceOf(projectId: ProjectId): Promise<WorkspaceId | undefined> {
                return Promise.resolve(byId.get(projectId)?.workspaceId);
            }
        })();
    }
}
