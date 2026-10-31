// ─── Test support for the platform specs: in-memory adapters, fixed clock, sequential ids, fake roles / running work ───
import { MODULE_IDS, type ModuleId, type Role } from '@contrack/contract';
import { ModuleWorkRegistry } from '../../../shared/application/ports';
import type { DomainError } from '../../../shared/domain/domain-error';
import { type UserId, type WorkspaceId, asUserId, asWorkspaceId } from '../../../shared/domain/ids';
import type { Result } from '../../../shared/domain/result';
import { InMemoryUnitOfWork } from '../../../shared/infrastructure/database/database';
import { FixedClock, SequentialIdGenerator } from '../../../shared/infrastructure/system';
import { FakeRoles, FixedAppLinks } from '../../../shared/testing/platform-fakes';
import { LineSender } from '../application/ports/line-sender.port';
import { PlatformSettings } from '../application/ports/platform-settings.port';
import { FileLinks } from '../application/services/file-links';
import { ModuleFlagCache } from '../application/services/module-flag-cache';
import { WorkspaceModuleStates } from '../application/services/workspace-module-states';
import type { EntitlementMode } from '../domain/module-activation';
import { InMemoryFileStorage } from '../infrastructure/adapters/file-storage.adapter';
import { HmacFileLinkSigner } from '../infrastructure/adapters/hmac-file-link-signer.adapter';
import { InMemoryFileRepository } from '../infrastructure/adapters/in-memory-file.repository';
import { InMemoryNotificationDeliveryRepository } from '../infrastructure/adapters/in-memory-notification-delivery.repository';
import { InMemoryNotificationRepository } from '../infrastructure/adapters/in-memory-notification.repository';
import { InMemoryRecipientDirectory } from '../infrastructure/adapters/in-memory-recipient-directory.adapter';
import { InMemoryWorkspaceEntitlementRepository } from '../infrastructure/adapters/in-memory-workspace-entitlement.repository';
import { InMemoryWorkspaceModuleRepository } from '../infrastructure/adapters/in-memory-workspace-module.repository';
import { RecordingSmsSender } from './recording-sms-sender';

export const ROLES_UNDER_TEST: readonly Role[] = ['owner', 'admin', 'estimator', 'viewer'];
export const TEST_SECRET = 'test-secret-test-secret-test-secret-123';
export const FILE_TTL_SECONDS = 3600;

/** Result code ('ok' or the error code). */
export function outcome(result: Result<unknown, DomainError>): string {
    return result.ok ? 'ok' : result.error.code;
}

/** The value of an ok Result (fails the test otherwise). */
export function valueOf<T>(result: Result<T, DomainError>): T {
    if (!result.ok) throw new Error(`expected ok, got ${result.error.code}: ${result.error.message}`);
    return result.value;
}

/** The error of a failed Result (fails the test otherwise). */
export function errorOf(result: Result<unknown, DomainError>): DomainError {
    if (result.ok) throw new Error('expected an error, got ok');
    return result.error;
}

/** Running work per (workspace, module), set by the test; registered for every module. Records every question. */
export class FakeModuleWork {
    readonly active = new Map<string, Record<string, number>>();
    calls = 0;

    /** `{ activeSubcontracts: n }` for (workspace, module). */
    set(workspaceId: WorkspaceId, module: ModuleId, activeSubcontracts: number): void {
        this.active.set(`${workspaceId}|${module}`, { activeSubcontracts });
    }

    setWork(workspaceId: WorkspaceId, module: ModuleId, work: Record<string, number>): void {
        this.active.set(`${workspaceId}|${module}`, { ...work });
    }

    /** Registers a counter of every module in `registry`. */
    registerInto(registry: ModuleWorkRegistry): ModuleWorkRegistry {
        for (const module of MODULE_IDS) {
            registry.register(module, ws => {
                this.calls += 1;
                return Promise.resolve({ ...(this.active.get(`${ws}|${module}`) ?? {}) });
            });
        }
        return registry;
    }
}

/** LINE sender that records pushes; `enabled` set by the test. */
export class RecordingLineSender extends LineSender {
    readonly pushed: { to: string; text: string }[] = [];
    failures = 0;

    constructor(private readonly on = false) {
        super();
    }

    get enabled(): boolean {
        return this.on;
    }

    push(lineUserId: string, text: string): Promise<void> {
        if (this.failures > 0) {
            this.failures -= 1;
            return Promise.reject(new Error('LINE unavailable'));
        }
        this.pushed.push({ to: lineUserId, text });
        return Promise.resolve();
    }
}

export interface WorkspaceScenario {
    workspaceId: WorkspaceId;
    byRole: Record<Role, UserId>;
    outsider: UserId;
}

export class PlatformTestKit {
    readonly clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
    readonly ids = new SequentialIdGenerator();
    readonly uow = new InMemoryUnitOfWork();
    readonly roles = new FakeRoles();
    readonly usage = new FakeModuleWork();
    readonly work: ModuleWorkRegistry = this.usage.registerInto(new ModuleWorkRegistry());
    readonly settings: PlatformSettings;
    readonly modules = new InMemoryWorkspaceModuleRepository();
    readonly entitlements = new InMemoryWorkspaceEntitlementRepository();
    readonly cache: ModuleFlagCache;
    readonly states: WorkspaceModuleStates;
    readonly files = new InMemoryFileRepository();
    readonly storage = new InMemoryFileStorage();
    readonly signer = new HmacFileLinkSigner(TEST_SECRET, FILE_TTL_SECONDS);
    readonly links: FileLinks;
    readonly notifications = new InMemoryNotificationRepository();
    readonly deliveries = new InMemoryNotificationDeliveryRepository();
    readonly recipients = new InMemoryRecipientDirectory();
    readonly sms = new RecordingSmsSender();
    readonly appLinks = new FixedAppLinks();
    private n = 0;

    constructor(modulesEnabled: readonly ModuleId[] = ['subcontracting'], entitlements: EntitlementMode = 'open') {
        this.settings = new PlatformSettings(modulesEnabled, 'https://app.test', entitlements);
        this.cache = new ModuleFlagCache(this.clock);
        this.states = new WorkspaceModuleStates(this.settings, this.modules, this.entitlements, this.cache, this.clock);
        this.links = new FileLinks(this.signer, this.clock);
    }

    newUserId(): UserId {
        this.n += 1;
        return asUserId(`00000000-0000-4000-a000-${this.n.toString(16).padStart(12, '0')}`);
    }

    newWorkspaceId(): WorkspaceId {
        this.n += 1;
        return asWorkspaceId(`00000000-0000-4000-b000-${this.n.toString(16).padStart(12, '0')}`);
    }

    /** A workspace with one member per role plus an outsider (no membership). */
    seedWorkspace(): WorkspaceScenario {
        const workspaceId = this.newWorkspaceId();
        const byRole = {} as Record<Role, UserId>;
        for (const role of ROLES_UNDER_TEST) {
            const userId = this.newUserId();
            byRole[role] = userId;
            this.roles.set(userId, workspaceId, role);
            this.recipients.addMember(workspaceId, userId);
        }
        return { workspaceId, byRole, outsider: this.newUserId() };
    }
}
