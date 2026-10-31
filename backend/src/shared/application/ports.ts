// ─── Ports shared between modules ───
// Abstract classes double as Nest DI tokens (type-safe, no string tokens). A module depends only on these
// abstractions; the module that owns the data provides the implementation (exported from its Nest module).
import type {
    AssignmentUpdatedEvent, DocUpdatedEvent, ProjectDeletedEvent, ProjectDocDto, ProjectUpdatedEvent, Role,
} from '@contrack/contract';
import type { ApprovalDecision, ApprovalStatus, ApprovalSubject, FileDto, FilePurpose, ModuleId } from '@contrack/contract';
import type { DomainError } from '../domain/domain-error';
import type { ProjectId, RateCardId, UserId, WorkspaceId } from '../domain/ids';
import type { Result } from '../domain/result';
import type { Project as BoqProject } from '@contrack/domain/project';

/** Current time (fixed in tests). */
export abstract class Clock {
    abstract now(): Date;
}

/** New random ids (UUID v4). */
export abstract class IdGenerator {
    abstract newId(): string;
}

/**
 * Runs work in one database transaction. Repositories called inside `run` join it automatically
 * (AsyncLocalStorage); the in-memory implementation just runs the work.
 */
export abstract class UnitOfWork {
    abstract run<T>(work: () => Promise<T>): Promise<T>;
}

/** Provided by workspaces: the caller's role in a workspace, or undefined when not a member. */
export abstract class WorkspaceAccess {
    abstract roleOf(userId: UserId, workspaceId: WorkspaceId): Promise<Role | undefined>;
}

/**
 * Provided by workspaces: creates the personal workspace (with the user as owner) of a newly registered user.
 * Called by identity inside the registration transaction.
 */
export abstract class PersonalWorkspaceProvisioner {
    abstract provision(userId: UserId, displayName: string): Promise<WorkspaceId>;
}

/** Provided by workspaces: the workspaces a user belongs to (for GET /me). */
export interface MembershipSummary {
    workspaceId: WorkspaceId;
    name: string;
    kind: 'personal' | 'company';
    role: Role;
}
export abstract class MembershipDirectory {
    abstract listForUser(userId: UserId): Promise<MembershipSummary[]>;
}

/** Provided by identity: public profile of users (for member lists and presence). */
export interface UserProfile {
    id: UserId;
    email: string;
    displayName: string;
}
export abstract class UserDirectory {
    abstract findMany(ids: readonly UserId[]): Promise<Map<UserId, UserProfile>>;
}

/** Provided by projects: which workspace a project belongs to (undefined when it does not exist / is deleted). */
export abstract class ProjectDirectory {
    abstract workspaceOf(projectId: ProjectId): Promise<WorkspaceId | undefined>;
}

/** What another module needs to know about a project before it attaches rows to it. */
export interface ProjectStatus {
    workspaceId: WorkspaceId;
    archived: boolean;
}

/** Provided by projects: the workspace and archive state of a project (undefined when it does not exist / is deleted). */
export abstract class ProjectStatusLookup {
    abstract find(projectId: ProjectId): Promise<ProjectStatus | undefined>;
}

/** Removes another module's rows of a project; runs inside the project's delete transaction. */
export type ProjectDependentCleanup = (workspaceId: WorkspaceId, projectId: ProjectId) => Promise<void>;

/**
 * Provided by core: the rows other modules keep per project (crew assignments, site supervisors, …). Deleting a
 * project runs every registered cleanup in the same transaction. PostgreSQL also cascades through the
 * (project_id, workspace_id) foreign keys; the explicit cleanups keep the in-memory adapters identical.
 * A module registers its cleanup once, at start-up (`onModuleInit`).
 */
export class ProjectDependents {
    private readonly cleanups: ProjectDependentCleanup[] = [];

    register(cleanup: ProjectDependentCleanup): void {
        this.cleanups.push(cleanup);
    }

    async deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const cleanup of this.cleanups) await cleanup(workspaceId, projectId);
    }
}

/** The daily rates of a company rate card, as another module reads them. */
export interface RateCardRates {
    id: RateCardId;
    skilledRate: number;
    labourerRate: number;
    archived: boolean;
}

/** Provided by rate-cards: cards of one workspace by id (active or archived; others' and unknown ids are left out). */
export abstract class RateCardLookup {
    abstract findMany(workspaceId: WorkspaceId, ids: readonly RateCardId[]): Promise<Map<RateCardId, RateCardRates>>;
}

/**
 * Provided by projects: one stored document. Lets another server instance rebuild a `doc.updated` event whose data
 * was too large for a PostgreSQL NOTIFY payload (8 kB).
 */
export abstract class ProjectDocLookup {
    abstract find(projectId: ProjectId, docKey: string): Promise<ProjectDocDto | undefined>;
}

/** Provided by realtime: fan-out to everyone viewing a project. Called only after the transaction committed. */
export abstract class RealtimePublisher {
    abstract docUpdated(event: DocUpdatedEvent): Promise<void>;
    abstract projectUpdated(event: ProjectUpdatedEvent): Promise<void>;
    abstract assignmentUpdated(event: AssignmentUpdatedEvent): Promise<void>;
    abstract projectDeleted(event: ProjectDeletedEvent): Promise<void>;
}

/**
 * Provided by projects: forgets a user's level assignments in a workspace when they leave it or are removed.
 * Called by workspaces inside the same transaction as the membership removal. Returns the step to run after the
 * transaction committed (realtime notices about the cleared assignments).
 */
export abstract class MemberAssignmentCleanup {
    abstract removeUser(workspaceId: WorkspaceId, userId: UserId): Promise<() => Promise<void>>;
}

/** Provided by identity: checks an access token. */
export interface AuthenticatedUser {
    userId: UserId;
}
export abstract class AccessTokenVerifier {
    abstract verify(token: string): Promise<AuthenticatedUser | undefined>;
}

// ─── Platform services (module flags, files, notifications). Implemented by src/modules/platform. ───

/**
 * Which business modules are on: for the platform (env MODULES_ENABLED) and for a workspace
 * (docs/erp/01-architecture.md §4.3: release, entitlement, the owner/admin switch and every dependency active).
 */
export abstract class ModuleFlags {
    /** Layer 1: the platform offers the module at all. */
    abstract platformEnabled(module: ModuleId): boolean;
    /** The module is active for the workspace: offered, entitled, switched on, and every dependency active. */
    abstract isEnabled(workspaceId: WorkspaceId, module: ModuleId): Promise<boolean>;
}

/** Uploaded files (drawings, photos, scans). Callers keep only file ids; DTOs get fresh signed links from `describe`. */
export abstract class FileService {
    /** FileDto (with a signed link) of each id that exists, in the order given; unknown ids are skipped. */
    abstract describe(ids: readonly string[]): Promise<FileDto[]>;
    /**
     * Checks that every id was uploaded by `userId` (any purpose when `purpose` is omitted). Use before attaching
     * files a user sent to something (bid photos, claim photos, package drawings).
     */
    abstract assertUploadedBy(ids: readonly string[], userId: UserId): Promise<Result<undefined, DomainError>>;
    /** Stores bytes produced by the server (e.g. a generated document) and returns its id. */
    abstract store(input: { name: string; contentType: string; bytes: Uint8Array; uploadedBy: UserId; purpose: FilePurpose }): Promise<FileDto>;
}

/** Message templates the platform can send (text lives in the notifications module, Thai). */
export type NotificationTemplate =
    | 'sc.invitation' | 'sc.addendum' | 'sc.question_answered' | 'sc.deadline_soon' | 'sc.outcome_won'
    | 'sc.outcome_lost' | 'sc.package_cancelled' | 'sc.contract_to_accept' | 'sc.inspection_result'
    | 'sc.claim_paid' | 'sc.retention_due' | 'sc.variation_proposed' | 'sc.message'
    | 'sc.bid_received' | 'sc.declined' | 'sc.question_asked' | 'sc.contract_accepted' | 'sc.change_requested'
    | 'sc.claim_requested' | 'sc.variation_answered';

export interface NotificationRequest {
    template: NotificationTemplate;
    /** Signed-in users to reach (in-app + their linked channels). */
    toUserIds?: readonly UserId[];
    /** Everyone with a membership in these workspaces (e.g. a vendor crew, a buyer company). */
    toWorkspaceIds?: readonly WorkspaceId[];
    /** A phone that may have no account yet (invitations): SMS only. */
    toPhone?: string;
    /** Values for the template ({{title}}, {{buyerName}}, {{url}}, …). */
    payload: Record<string, string | number>;
}

/** Queues messages; delivery (in-app, LINE, SMS, e-mail) happens in the background. Call after the transaction committed. */
export abstract class Notifier {
    abstract notify(request: NotificationRequest): Promise<void>;
}

/** Public base URL of the web app (for links in messages), e.g. https://app.contrack.co.th */
export abstract class AppLinks {
    abstract url(path: string): string;
}

/** Provided by projects: a project rebuilt from its stored documents (for the BOQ snapshot of a work package). */
export interface ProjectRead {
    projectId: ProjectId;
    workspaceId: WorkspaceId;
    name: string;
    archived: boolean;
    /** The BOQ project (computeProject() of @contrack/domain/project turns it into the BOQ). */
    project: BoqProject;
}
export abstract class ProjectReader {
    /** undefined when the project does not exist. Callers check access to `workspaceId` themselves. */
    abstract read(projectId: ProjectId): Promise<ProjectRead | undefined>;
}

/** Provided by workspaces: display names of workspaces (buyer company / crew name on documents and lists). */
export abstract class WorkspaceDirectory {
    abstract names(ids: readonly WorkspaceId[]): Promise<Map<WorkspaceId, string>>;
    /** The personal workspace of a user (every user has exactly one). */
    abstract personalWorkspaceOf(userId: UserId): Promise<WorkspaceId | undefined>;
    /** User ids of every member of a workspace (notification recipients). */
    abstract memberIds(workspaceId: WorkspaceId): Promise<UserId[]>;
    /** Every member of a workspace with their role (who may approve, docs/erp/01-architecture.md §6.3). */
    abstract members(workspaceId: WorkspaceId): Promise<WorkspaceMember[]>;
    /**
     * Platform admin search: workspaces whose name contains `q` (case-insensitive) or whose id is `q`; empty `q` = every
     * workspace. Newest first, at most `limit`.
     */
    abstract search(q: string, limit: number): Promise<WorkspaceSummary[]>;
}

export interface WorkspaceMember {
    userId: UserId;
    role: Role;
}

export interface WorkspaceSummary {
    id: WorkspaceId;
    name: string;
    kind: 'personal' | 'company';
    memberCount: number;
    createdAt: Date;
}

/** What identity tells the business modules after a phone sign-in (inside the sign-in transaction). */
export interface PhoneSignInEvent {
    userId: UserId;
    /** E.164, verified. */
    phone: string;
    isNewUser: boolean;
    displayName: string;
    /** Name of the crew: creates the vendor profile when the user has none. */
    teamName?: string;
    /** Raw token of the subcontracting invitation the user came from. */
    invitationToken?: string;
}
/** Provided by subcontracting (sourcing): vendor profile + links invitations / vendor-list entries with that phone. */
export abstract class PhoneSignInHook {
    abstract afterSignIn(event: PhoneSignInEvent): Promise<{ vendorWorkspaceId: WorkspaceId | null }>;
}

/** Running work of one module in one workspace, per counter name (e.g. `{ activeSubcontracts: 2 }`). */
export type ModuleWorkCounter = (workspaceId: WorkspaceId) => Promise<Record<string, number>>;

/**
 * Provided by core: work that switching a module off would hide, asked before switching off (409 asks to confirm
 * while any count is above 0). A business module registers its counter once, at start-up (`onModuleInit`).
 */
export class ModuleWorkRegistry {
    private readonly counters = new Map<ModuleId, ModuleWorkCounter[]>();

    register(module: ModuleId, counter: ModuleWorkCounter): void {
        this.counters.set(module, [...(this.counters.get(module) ?? []), counter]);
    }

    /** Every counter of `module` (counts of the same name are added); `{}` when the module registered none. */
    async workOf(workspaceId: WorkspaceId, module: ModuleId): Promise<Record<string, number>> {
        const out: Record<string, number> = {};
        for (const counter of this.counters.get(module) ?? []) {
            for (const [name, n] of Object.entries(await counter(workspaceId))) out[name] = (out[name] ?? 0) + n;
        }
        return out;
    }
}

// ─── Approvals and audit (ERP foundation, docs/erp/01-architecture.md §6, §10). Implemented by src/modules/approvals and
// src/modules/audit; ApprovalHandlers lives in core. ───

export interface ApprovalRequestInput {
    workspaceId: WorkspaceId;
    subject: ApprovalSubject;
    /** The document waiting for approval (purchase order id, claim id, …). */
    subjectId: string;
    projectId: ProjectId | null;
    /** Baht (round2) compared with the policy's `minAmount`; null = the document has no amount. */
    amount: number | null;
    /** Shown in the inbox, e.g. the document number or name. */
    title: string;
    requestedBy: UserId;
    requesterRole: Role;
}

export interface ApprovalTicket {
    requestId: string;
    status: 'approved' | 'pending';
    /** Approved by the auto-skip rules: the caller applies the outcome itself, in the same transaction. */
    auto: boolean;
}

/**
 * Provided by approvals. `request` runs inside the caller's `uow.run` and answers `approved` at once when an auto-skip
 * rule applies (a solo owner never sees an approval step); every call stores a request row for the audit trail.
 * While a request of the same (subject, subjectId) is pending: conflict `approval_pending`.
 */
export abstract class Approvals {
    abstract request(input: ApprovalRequestInput): Promise<Result<ApprovalTicket, DomainError>>;
    /** Cancels the pending request of a document (e.g. the draft was withdrawn); nothing when none is pending. */
    abstract cancel(workspaceId: WorkspaceId, subject: ApprovalSubject, subjectId: string, by: UserId): Promise<void>;
    /** Status of the latest request of a document; undefined when it was never sent. */
    abstract statusOf(workspaceId: WorkspaceId, subject: ApprovalSubject, subjectId: string): Promise<ApprovalStatus | undefined>;
}

export interface ApprovalDecidedEvent {
    workspaceId: WorkspaceId;
    projectId: ProjectId | null;
    requestId: string;
    subjectId: string;
    decision: ApprovalDecision;
    decidedBy: UserId;
    note: string;
}

export interface ApprovalHandler {
    /**
     * Runs inside the transaction of the decision: changes the document's status, issues its number, posts the ledger.
     * An error rolls the decision back (the request stays pending). Do nothing (ok) while the module is not active.
     */
    onDecided(e: ApprovalDecidedEvent): Promise<Result<void, DomainError>>;
}

/** Provided by core: the module that owns a subject registers its handler once, at start-up (`onModuleInit`). */
export class ApprovalHandlers {
    private readonly handlers = new Map<ApprovalSubject, ApprovalHandler>();

    register(subject: ApprovalSubject, handler: ApprovalHandler): void {
        if (this.handlers.has(subject)) throw new Error(`An approval handler for "${subject}" is already registered`);
        this.handlers.set(subject, handler);
    }

    handlerOf(subject: ApprovalSubject): ApprovalHandler | undefined {
        return this.handlers.get(subject);
    }
}

export interface AuditEntry {
    workspaceId: WorkspaceId;
    projectId: ProjectId | null;
    /** null = the system (a sweep, a customer link). */
    actor: UserId | null;
    entityType: string;
    entityId: string;
    action: string;
    /** Only the changed fields (`{field: [before, after]}`) or a numeric summary, never the whole document. */
    data: Record<string, unknown>;
}

/** Provided by audit: append-only trail of money / status actions. Call inside the same `uow.run` as the change. */
export abstract class AuditLog {
    abstract record(e: AuditEntry): Promise<void>;
}
