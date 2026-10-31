// ─── Ports shared between modules ───
// Abstract classes double as Nest DI tokens (type-safe, no string tokens). A module depends only on these
// abstractions; the module that owns the data provides the implementation (exported from its Nest module).
import type {
    AssignmentUpdatedEvent, DocUpdatedEvent, ProjectDeletedEvent, ProjectDocDto, ProjectDto, ProjectUpdatedEvent, Role,
} from '@contrack/contract';
import type {
    ApprovalDecision, ApprovalStatus, ApprovalSubject, BankAccount, BusinessProfile, CompanyDefaults, CustomerLinkAction, CustomerLinkSubject,
    DocLanguage, DocType, FileDto, FilePurpose, HubProjectStatus, ModuleId, Permission, ProjectRollup, ProjectType,
} from '@contrack/contract';
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

/**
 * Provided by projects: the release-1 project DTOs of a workspace in one read (the Project Hub lists them next to its
 * own columns). Ordered like GET /workspaces/:id/projects (updatedAt, newest first). Callers check access themselves.
 */
export abstract class ProjectCatalog {
    abstract list(workspaceId: WorkspaceId, filter: { archived: boolean }): Promise<ProjectDto[]>;
    /** undefined when the project does not exist in that workspace. */
    abstract find(workspaceId: WorkspaceId, projectId: ProjectId): Promise<ProjectDto | undefined>;
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

/** Subcontracting templates (Thai text; payload values arrive already formatted for Thai readers). */
export type ScNotificationTemplate =
    | 'sc.invitation' | 'sc.addendum' | 'sc.question_answered' | 'sc.deadline_soon' | 'sc.outcome_won'
    | 'sc.outcome_lost' | 'sc.package_cancelled' | 'sc.contract_to_accept' | 'sc.inspection_result'
    | 'sc.claim_paid' | 'sc.retention_due' | 'sc.variation_proposed' | 'sc.message'
    | 'sc.bid_received' | 'sc.declined' | 'sc.question_asked' | 'sc.contract_accepted' | 'sc.change_requested'
    | 'sc.claim_requested' | 'sc.variation_answered';

/**
 * ERP templates (docs/erp/01-architecture.md §7): text in Thai and English, rendered in each recipient's language.
 * Payloads carry raw values (`amount: number`, `date: 'YYYY-MM-DD'`, `docNumber`, `projectName`, …) formatted by the
 * renderer; the keys per template are listed in src/modules/platform/application/services/notification-templates.erp.ts.
 */
export type ErpNotificationTemplate =
    | 'approval.requested' | 'approval.decided' | 'quotation.viewed' | 'quotation.accepted' | 'quotation.change_requested'
    | 'variation.accepted' | 'variation.rejected' | 'invoice.due_soon' | 'invoice.overdue' | 'retention.release_due'
    | 'guarantee.expiring' | 'purchase_order.issued' | 'goods.short_delivery' | 'cost.overrun' | 'cash.negative_forecast'
    | 'warranty.claim_opened' | 'warranty.expiring' | 'trial.expiring' | 'pay_period.ready' | 'supplier_bill.due_soon';

/** Message templates the platform can send (text lives in the platform module). */
export type NotificationTemplate = ScNotificationTemplate | ErpNotificationTemplate;

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

// ─── Daily sweeps (docs/erp/01-architecture.md §7 item 7): run by the platform every 6 hours (first 60 s after start),
// never under NODE_ENV=test (tests call DailySweepsRunner.runOnce). A module registers its sweep once, in onModuleInit,
// checks itself that its module is released / active per workspace, and uses SweepMarks to notify once per key per day. ───

export interface SweepContext {
    now: Date;
    /** Bangkok calendar date of `now` (YYYY-MM-DD). */
    today: string;
}

export type DailySweep = (ctx: SweepContext) => Promise<void>;

/** Provided by core: the registry of daily sweeps (name → function). */
export class DailySweeps {
    private readonly sweeps = new Map<string, DailySweep>();

    register(name: string, sweep: DailySweep): void {
        if (this.sweeps.has(name)) throw new Error(`A daily sweep named "${name}" is already registered`);
        this.sweeps.set(name, sweep);
    }

    entries(): [string, DailySweep][] {
        return [...this.sweeps.entries()];
    }
}

/** Provided by platform (table `sweep_marks`): true the first time (sweep, key, date) is marked, false afterwards. */
export abstract class SweepMarks {
    abstract markOnce(sweep: string, key: string, date: string): Promise<boolean>;
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
    /**
     * Call after the caller's transaction committed, when `request` answered `pending`: sends `approval.requested` to
     * the members who may decide it (the requester excluded). Nothing for an unknown or no longer pending request.
     */
    abstract notifyRequested(requestId: string): Promise<void>;
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

// ─── Running document numbers and deletion guards (ERP foundation, docs/erp/01-architecture.md §8, §11). DocumentNumbering
// is implemented by src/modules/numbering; the guard registries live in core. ───

export interface IssueNumberInput {
    workspaceId: WorkspaceId;
    docType: DocType;
    /** Business date `YYYY-MM-DD` of the document: picks the counter period (never the server time). */
    issueDate: string;
    /** e.g. `quotation`, `ar_invoice`. */
    subjectType: string;
    /** The document's id (uuid); one number per (docType, subjectId). */
    subjectId: string;
    projectId: ProjectId | null;
    issuedBy: UserId;
}

export interface IssuedNumber {
    number: string;
    seq: number;
    periodKey: string;
    issuedDocumentId: string;
}

export interface VoidNumberInput {
    workspaceId: WorkspaceId;
    docType: DocType;
    subjectId: string;
    reason: string;
    by: UserId;
}

/**
 * Provided by numbering. Call `issue` inside the same `uow.run` that marks the document issued: a rollback leaves the
 * number unused (no gap). Errors: conflict `already_issued` (the subject has a number), unprocessable
 * `date_before_last_issued` (tax_invoice / receipt / credit_note dated before the series' latest), validation for a
 * bad date. Audited (`issued_document` / `issue` | `void`). No module check: the calling module checked its own.
 */
export abstract class DocumentNumbering {
    abstract issue(input: IssueNumberInput): Promise<Result<IssuedNumber, DomainError>>;
    /** The number stays (status `voided`); not found when the subject has no number, conflict `already_voided`. */
    abstract void(input: VoidNumberInput): Promise<Result<void, DomainError>>;
    /** Number the next document dated `issueDate` would get; reserves nothing. */
    abstract preview(workspaceId: WorkspaceId, docType: DocType, issueDate: string): Promise<string>;
}

/**
 * A workspace's company profile (stored row, or the defaults while nothing is saved). Images are file ids; the legal Thai
 * name falls back to the workspace name, the English one stays as saved (empty = not set).
 */
export interface CompanyProfile {
    workspaceId: WorkspaceId;
    /** Nothing saved yet. */
    isDefault: boolean;
    /** `workspaces.name`. */
    workspaceName: string;
    legalNameTh: string;
    legalNameEn: string;
    taxId: string;
    branchCode: string;
    branchNameTh: string;
    branchNameEn: string;
    addressTh: string;
    addressEn: string;
    phone: string;
    email: string;
    website: string;
    logoFileId: string | null;
    stampFileId: string | null;
    signatureFileId: string | null;
    vatRegistered: boolean;
    vatRate: number;
    businessProfiles: BusinessProfile[];
    defaultProjectType: ProjectType | null;
    defaultDocLanguage: DocLanguage;
    documentYearStyle: 'ce' | 'be';
    bankAccounts: BankAccount[];
    promptpayId: string;
    defaults: CompanyDefaults;
    brandColor: string;
    documentFooterTh: string;
    documentFooterEn: string;
    updatedBy: UserId | null;
    updatedAt: Date | null;
}

/**
 * The seller block copied onto an issued document, in the document's language (names, address, branch, footer
 * resolved; English falls back to Thai). Images are file ids (describe them with FileService when rendering: links expire).
 * `vatRate` is 0 when the company is not VAT registered.
 */
export interface CompanySnapshot {
    language: DocLanguage;
    legalName: string;
    taxId: string;
    branchCode: string;
    branchName: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    logoFileId: string | null;
    stampFileId: string | null;
    signatureFileId: string | null;
    vatRegistered: boolean;
    vatRate: number;
    bankAccounts: BankAccount[];
    promptpayId: string;
    brandColor: string;
    footer: string;
    yearStyle: 'ce' | 'be';
}

/** Provided by company. No module check: the calling module checked its own. */
export abstract class CompanyProfiles {
    /** The saved profile, or the defaults (legal Thai name = the workspace name). */
    abstract get(workspaceId: WorkspaceId): Promise<CompanyProfile>;
    /** Seller block for a document in `language`. */
    abstract snapshot(workspaceId: WorkspaceId, language: DocLanguage): Promise<CompanySnapshot>;
}

/** A customer of the register (`customers` row). */
export interface Customer {
    id: string;
    workspaceId: WorkspaceId;
    kind: 'individual' | 'juristic' | 'government';
    nameTh: string;
    nameEn: string;
    taxId: string;
    branchCode: string;
    addressTh: string;
    addressEn: string;
    contactName: string;
    phone: string;
    email: string;
    lineId: string;
    /** null = by kind. */
    defaultWhtRate: number | null;
    defaultDocLanguage: DocLanguage;
    paymentTermDays: number;
    note: string;
    archivedAt: Date | null;
    createdBy: UserId | null;
    createdAt: Date;
    updatedAt: Date;
}

/** Buyer block of a document in one language, stored in the document's `customer_snapshot`. */
export interface CustomerSnapshot {
    id: string;
    kind: Customer['kind'];
    /** In the document language; falls back to the other language when empty. */
    name: string;
    taxId: string;
    branchCode: string;
    address: string;
    contactName: string;
    phone: string;
    email: string;
    /** The withholding rate in force (the customer's own, or the rate of its kind). */
    whtRate: number;
    paymentTermDays: number;
    language: DocLanguage;
}

/** Provided by customers. No module check: the calling module checked its own. Every method filters by workspace. */
export abstract class CustomerLookup {
    abstract find(workspaceId: WorkspaceId, customerId: string): Promise<Customer | undefined>;
    abstract findMany(workspaceId: WorkspaceId, customerIds: readonly string[]): Promise<Customer[]>;
    abstract snapshot(workspaceId: WorkspaceId, customerId: string, language: DocLanguage): Promise<CustomerSnapshot | undefined>;
}

/** Why a delete is refused, e.g. `{ reason: 'document_issued_exists', count: 3 }`. */
export interface DeletionBlocker {
    reason: string;
    count: number;
}

export type ProjectDeletionGuard = (workspaceId: WorkspaceId, projectId: ProjectId) => Promise<DeletionBlocker[]>;
export type WorkspaceDeletionGuard = (workspaceId: WorkspaceId) => Promise<DeletionBlocker[]>;

/**
 * Provided by core: reasons a project may not be deleted. DeleteProjectUseCase asks inside its transaction, after
 * locking the project; any blocker → conflict with the first blocker's reason. Registered once in `onModuleInit`.
 */
export class ProjectDeletionGuards {
    private readonly guards: ProjectDeletionGuard[] = [];

    register(guard: ProjectDeletionGuard): void {
        this.guards.push(guard);
    }

    async blockers(workspaceId: WorkspaceId, projectId: ProjectId): Promise<DeletionBlocker[]> {
        const out: DeletionBlocker[] = [];
        for (const guard of this.guards) out.push(...await guard(workspaceId, projectId));
        return out;
    }
}

/** Provided by core: reasons a workspace may not be deleted (asked by DeleteWorkspaceUseCase inside its transaction). */
export class WorkspaceDeletionGuards {
    private readonly guards: WorkspaceDeletionGuard[] = [];

    register(guard: WorkspaceDeletionGuard): void {
        this.guards.push(guard);
    }

    async blockers(workspaceId: WorkspaceId): Promise<DeletionBlocker[]> {
        const out: DeletionBlocker[] = [];
        for (const guard of this.guards) out.push(...await guard(workspaceId));
        return out;
    }
}

// ─── Customer links (ERP foundation, docs/erp/02-domain-model.md §1.8). The registry lives in core; the owner module
// of each subject (quotations, variations, billing) registers its handler in `onModuleInit`. ───

/** What the public page shows for one subject (built by the owner module). */
export interface CustomerLinkSubjectView {
    projectId: ProjectId;
    language: DocLanguage;
    /** e.g. the document number. */
    title: string;
    /** The document is in a state the customer may answer (quotation version `issued`, VO `submitted`). */
    respondable: boolean;
    /** Subject-specific content for the web renderer; never costs or margins (01-architecture §14.7). */
    payload: unknown;
}

export interface CustomerLinkRespondInput {
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    subjectId: string;
    linkId: string;
    action: CustomerLinkAction;
    name: string;
    note: string;
    at: Date;
}

export interface CustomerLinkHandler {
    /** Permission (on the link's workspace) needed to create, list and revoke links of this subject. */
    permission: Permission;
    /**
     * The subject of `workspaceId`, or undefined when it does not exist there or its module is not active
     * (the link then answers 404, like a wrong token).
     */
    view(workspaceId: WorkspaceId, subjectId: string): Promise<CustomerLinkSubjectView | undefined>;
    /**
     * Applies the answer. Runs inside the customer-links transaction (an error rolls the answer back). The document no
     * longer answerable → conflict `invalid_transition`. Omitted = view only (respond → 422 `respond_not_supported`).
     */
    respond?(input: CustomerLinkRespondInput): Promise<Result<void, DomainError>>;
}

/** Provided by core: one handler per subject type, registered once at start-up. */
export class CustomerLinkHandlers {
    private readonly handlers = new Map<CustomerLinkSubject, CustomerLinkHandler>();

    register(subjectType: CustomerLinkSubject, handler: CustomerLinkHandler): void {
        if (this.handlers.has(subjectType)) throw new Error(`A customer link handler for "${subjectType}" is already registered`);
        this.handlers.set(subjectType, handler);
    }

    handlerOf(subjectType: CustomerLinkSubject): CustomerLinkHandler | undefined {
        return this.handlers.get(subjectType);
    }
}

// ─── Project Hub (docs/erp/02-domain-model.md §1.9, §12). ProjectLifecycle is implemented by src/modules/hub; the
// roll-up registry lives in core and every module that has figures per project registers in `onModuleInit`. ───

/**
 * Provided by hub: automatic project status changes from document events (quotation issued → `quoted`, accepted → `won`,
 * contract signed → `in_progress`, …). Forward only along `lead < estimating < quoted < won < in_progress < handover <
 * warranty < closed`: a project already at or past `to`, or `lost` / `cancelled`, is left as it is. Call inside the
 * caller's `uow.run` (locks the project row; audited when it changes). No module check: the calling module checked its own.
 */
export abstract class ProjectLifecycle {
    /** The status after the call; undefined when the project does not exist in that workspace. */
    abstract advance(workspaceId: WorkspaceId, projectId: ProjectId, to: HubProjectStatus, by: UserId | null): Promise<HubProjectStatus | undefined>;
}

/**
 * Figures of many projects of one workspace in one go (a constant number of queries, never one per project). Only the
 * fields the module owns; projects without figures may be left out of the map.
 */
export type HubRollupSource = (workspaceId: WorkspaceId, projectIds: readonly ProjectId[]) => Promise<Map<ProjectId, Partial<ProjectRollup>>>;

/**
 * Provided by core: one roll-up source per module. The hub calls only the sources whose module is active for the
 * workspace (the others' fields stay null); a source should still return an empty map when its module is off.
 */
export class HubRollups {
    private readonly entries: { module: ModuleId; source: HubRollupSource }[] = [];

    register(module: ModuleId, source: HubRollupSource): void {
        this.entries.push({ module, source });
    }

    sources(): readonly { module: ModuleId; source: HubRollupSource }[] {
        return this.entries;
    }
}
