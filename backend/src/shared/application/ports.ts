// ─── Ports shared between modules ───
// Abstract classes double as Nest DI tokens (type-safe, no string tokens). A module depends only on these
// abstractions; the module that owns the data provides the implementation (exported from its Nest module).
import type {
    AssignmentUpdatedEvent, DocUpdatedEvent, ProjectDeletedEvent, ProjectDocDto, ProjectDto, ProjectUpdatedEvent, Role,
} from '@contrack/contract';
import type {
    ApprovalDecision, ApprovalStatus, ApprovalSubject, BankAccount, BaselineReason, BaselineStatus, BusinessProfile, CompanyDefaults,
    CostCategory, CostCodeSource, CostCodeStatus, CostEntryKind, CustomerLinkAction, CustomerLinkSubject, DocLanguage, DocType, FileDto,
    FilePurpose, FinCounterpartyType, FinDirection, FinEventType, HubProjectFields, HubProjectStatus, ModuleId, Permission, ProjectRollup, ProjectType,
} from '@contrack/contract';
import type {
    ContractMilestoneKind, ContractMilestoneSource, ContractMilestoneStatus, ContractMilestoneTrigger, ContractVariationBilling,
    MainContractBillingMode, MainContractStatus, MainContractTerms, MilestoneTemplateItem,
} from '@contrack/contract';
import type { DomainError } from '../domain/domain-error';
import type { ProjectId, RateCardId, RevisionId, UserId, WorkspaceId } from '../domain/ids';
import type { Result } from '../domain/result';
import type { BoqVersionLine, BoqVersionSection } from '@contrack/domain/boq-control/version-lines';
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
    /** Workspace of a customer by id alone (the caller authorizes on that workspace next); undefined when unknown. */
    abstract locate(customerId: string): Promise<WorkspaceId | undefined>;
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
    /** After an answer committed (notify the team). Errors are logged, never returned to the customer. */
    afterRespond?(input: CustomerLinkRespondInput): Promise<void>;
    /** After the public page was opened (`firstView` = the link's first opening). Errors are logged and ignored. */
    onViewed?(input: CustomerLinkViewedInput): Promise<void>;
}

export interface CustomerLinkViewedInput {
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    subjectId: string;
    linkId: string;
    firstView: boolean;
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
    /** The hub columns of a project (customer, project type, settings); undefined when not a project of that workspace. */
    abstract hubFields(workspaceId: WorkspaceId, projectId: ProjectId): Promise<HubProjectFields | undefined>;
    /**
     * Moves `planned_finish` by `days` (an accepted variation's schedule impact) inside the caller's `uow.run`; nothing
     * when days = 0 or no planned finish is set. Audited when it changes.
     */
    abstract shiftPlannedFinish(workspaceId: WorkspaceId, projectId: ProjectId, days: number, by: UserId | null): Promise<void>;
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

// ── BOQ history (WP-17, docs/erp/01-architecture.md §11) ──

/** A project revision as other modules see it (without its snapshot). */
export interface RevisionInfo {
    id: RevisionId;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    label: string;
    note: string | null;
    createdBy: UserId;
    createdAt: Date;
}

/** What a revision hook receives: the revision just inserted, with the project snapshot it stores. */
export interface RevisionCreated extends RevisionInfo {
    snapshot: BoqProject;
}

export type RevisionHook = (revision: RevisionCreated) => Promise<void>;

/**
 * Provided by core: run by CreateRevisionUseCase inside its transaction right after the revision row is inserted
 * (the project row is locked). A hook checks itself that its module is active; a throw rolls the revision back.
 */
export class RevisionHooks {
    private readonly hooks: RevisionHook[] = [];

    register(hook: RevisionHook): void {
        this.hooks.push(hook);
    }

    async run(revision: RevisionCreated): Promise<void> {
        for (const hook of this.hooks) await hook(revision);
    }
}

/**
 * Provided by projects: creates a revision of the project's current documents exactly as `POST /projects/:id/revisions`
 * does (lock, recompute, insert, activity, hooks) without checking permissions — the caller did. Joins the caller's
 * `uow.run`. Conflict (`details.label`) when the label is taken; unprocessable when the project no longer computes.
 */
export abstract class RevisionWriter {
    abstract create(
        workspaceId: WorkspaceId, projectId: ProjectId, input: { label: string; note?: string; by: UserId },
    ): Promise<Result<RevisionInfo, DomainError>>;
}

/** Provided by projects: revisions of a project (callers check access themselves). */
export abstract class RevisionLookup {
    /** Oldest first. */
    abstract list(workspaceId: WorkspaceId, projectId: ProjectId): Promise<RevisionInfo[]>;
    /** The stored project snapshot of one revision; undefined when it is not a revision of that project. */
    abstract snapshot(workspaceId: WorkspaceId, projectId: ProjectId, revisionId: RevisionId): Promise<BoqProject | undefined>;
}

/** Sections and lines of one BOQ version (`boq_version_sections` / `boq_version_lines`). */
export interface BoqVersionSourceContent {
    versionId: string;
    versionNo: number;
    sections: BoqVersionSection[];
    lines: BoqVersionLine[];
}

/** Provided by boq-control: BOQ versions as documents are built from them (no module check: the caller checked its own). */
export abstract class BoqVersionSource {
    /** A version of the project; undefined when it is not one (another project, workspace, or unknown id). */
    abstract content(workspaceId: WorkspaceId, projectId: ProjectId, versionId: string): Promise<BoqVersionSourceContent | undefined>;
    /**
     * A new revision `<labelPrefix>-<n>` of the project's current documents and its BOQ version, inside the caller's
     * `uow.run`. unprocessable `project_does_not_compute` when the project no longer computes.
     */
    abstract snapshot(
        workspaceId: WorkspaceId, projectId: ProjectId, input: { labelPrefix: string; by: UserId },
    ): Promise<Result<BoqVersionSourceContent, DomainError>>;
}

// ── Baseline + cost codes (WP-18, docs/erp/02-domain-model.md §1.10, 01-architecture §11) ──

export type BoqEditLock = (workspaceId: WorkspaceId, projectId: ProjectId, docKey: string) => Promise<boolean>;

/**
 * Provided by core: PutDocUseCase asks inside its transaction (project row locked) whether a document may not be
 * written because the BOQ is locked (boq-control registers: active baseline + `calc:*` / `boq:*` / `journey`).
 * No lock registered = every document writable (release 1). A lock checks itself that its module is active.
 */
export class BoqEditLocks {
    private readonly locks: BoqEditLock[] = [];

    register(lock: BoqEditLock): void {
        this.locks.push(lock);
    }

    async isLocked(workspaceId: WorkspaceId, projectId: ProjectId, docKey: string): Promise<boolean> {
        for (const lock of this.locks) if (await lock(workspaceId, projectId, docKey)) return true;
        return false;
    }
}

/** Why a baseline may not be unlocked, e.g. `{ reason: 'contract_signed', count: 1 }`. */
export type BaselineUnlockBlocker = DeletionBlocker;
export type BaselineUnlockGuard = (workspaceId: WorkspaceId, projectId: ProjectId) => Promise<BaselineUnlockBlocker[]>;

/**
 * Provided by core: reasons the baseline of a project may not be unlocked (main-contracts: signed contract, billing:
 * claims, variations: accepted VO, ledger: entries). Asked by the unlock use case inside its transaction.
 */
export class BaselineUnlockGuards {
    private readonly guards: BaselineUnlockGuard[] = [];

    register(guard: BaselineUnlockGuard): void {
        this.guards.push(guard);
    }

    async blockers(workspaceId: WorkspaceId, projectId: ProjectId): Promise<BaselineUnlockBlocker[]> {
        const out: BaselineUnlockBlocker[] = [];
        for (const guard of this.guards) out.push(...await guard(workspaceId, projectId));
        return out;
    }
}

/** One `project_cost_codes` row as other modules see it (money rounded, quantities to 4 places). */
export interface CostCode {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    code: string;
    source: CostCodeSource;
    sourceRef: string | null;
    sectionNo: number;
    lineKey: string | null;
    descTh: string;
    descEn: string;
    unit: string;
    sort: number;
    baselineQty: number;
    baselineMatUnit: number;
    baselineLabUnit: number;
    baselineMat: number;
    baselineLab: number;
    baselineTotal: number;
    voQty: number;
    voCost: number;
    /** = baselineTotal + voCost. */
    budgetTotal: number;
    contractAmount: number;
    voContractAmount: number;
    reportedProgress: number;
    certifiedProgress: number;
    status: CostCodeStatus;
    createdAt: Date;
    updatedAt: Date;
}

/** One line of an accepted VO. `costCodeId` null = a new item (a cost code `VO{voSeq}-{n}` is made). */
export interface CostCodeVariationLine {
    costCodeId: string | null;
    sectionNo: number;
    lineKey: string | null;
    descTh: string;
    descEn: string;
    unit: string;
    /** Signed. */
    qtyDelta: number;
    /** Signed cost of the change. */
    costAmount: number;
    /** Signed selling value of the change (no VAT). */
    sellAmount: number;
}

/** One line of the accepted quotation for allocateContractAmounts. */
export interface CostCodeContractLine {
    lineKey: string | null;
    sectionNo: number;
    descTh: string;
    descEn: string;
    unit: string;
    /** Sell amount of the line (weight of the allocation). */
    sellAmount: number;
}

export interface ContractAllocationResult {
    /** Manual cost codes made for quotation lines without a baseline cost code. */
    created: number;
    /** Active baseline cost codes left at contract_amount 0 (no quotation line). */
    uncoveredCount: number;
}

/**
 * Provided by boq-control. No module check (the calling module checked its own); every method filters by workspace
 * and project. Writes join the caller's `uow.run`.
 */
export abstract class CostCodeLookup {
    /** The cost codes of the project among `ids` (unknown ids left out). */
    abstract findMany(workspaceId: WorkspaceId, projectId: ProjectId, ids: readonly string[]): Promise<CostCode[]>;
    /** Every cost code of the project (also omitted ones): baseline, variation, manual; BOQ order. */
    abstract listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<CostCode[]>;
    /**
     * Effect of an accepted VO: existing codes `vo_qty += qtyDelta`, `vo_cost += costAmount`, `budget_total`,
     * `vo_contract_amount += sellAmount` (a code cut to zero quantity → omitted); new items → `source='variation'`.
     * Returns the cost code id of every line (same order). not_found when a costCodeId is not of the project.
     */
    abstract applyVariation(
        workspaceId: WorkspaceId, projectId: ProjectId, input: { variationId: string; voSeq: number; lines: readonly CostCodeVariationLine[] },
    ): Promise<Result<string[], DomainError>>;
    /** Latest cumulative progress (fraction 0–1) from site reports; unknown ids ignored. */
    abstract setReportedProgress(
        workspaceId: WorkspaceId, projectId: ProjectId, entries: readonly { costCodeId: string; progress: number }[],
    ): Promise<void>;
    /** Latest cumulative progress (fraction 0–1) of certified claims; unknown ids ignored. */
    abstract setCertifiedProgress(
        workspaceId: WorkspaceId, projectId: ProjectId, entries: readonly { costCodeId: string; progress: number }[],
    ): Promise<void>;
    /**
     * Spreads `total` (contract value without VAT) over `contract_amount` so that Σ = total exactly: by the quotation
     * lines' sell amounts when given (matched by line_key), else by baseline_total. Every other cost code gets 0.
     * unprocessable `no_cost_codes` when there is nothing to allocate to.
     */
    abstract allocateContractAmounts(
        workspaceId: WorkspaceId, projectId: ProjectId, input: { total: number; lines?: readonly CostCodeContractLine[] },
    ): Promise<Result<ContractAllocationResult, DomainError>>;
}

export interface BaselineInfo {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    versionId: string;
    revisionId: RevisionId;
    status: BaselineStatus;
    reason: BaselineReason;
    contractId: string | null;
    lockedBy: UserId;
    lockedAt: Date;
}

/** Provided by boq-control (no module check: the calling module checked its own). */
export abstract class BaselineControl {
    /**
     * Locks the BOQ inside the caller's `uow.run`: the given BOQ version of the project, or a new revision
     * `BASELINE-<n>` of the current documents; builds / updates the cost codes. conflict `baseline_already_locked`,
     * not_found for a version of another project, unprocessable when the project no longer computes.
     */
    abstract lock(
        workspaceId: WorkspaceId, projectId: ProjectId,
        input: { versionId?: string; reason: BaselineReason; contractId: string | null; by: UserId },
    ): Promise<Result<BaselineInfo, DomainError>>;
    /** The active baseline; undefined when the BOQ is not locked. */
    abstract status(workspaceId: WorkspaceId, projectId: ProjectId): Promise<BaselineInfo | undefined>;
    /** The project snapshot of the active baseline (for VO pricing); undefined when not locked. */
    abstract baselineProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<BoqProject | undefined>;
}

// ── Cost ledger + financial events (WP-20, docs/erp/02-domain-model.md §1.11, 01-architecture §12.4) ──
// Provided by the ledger module (foundation, no module check: the calling module checked its own). Every write joins
// the caller's `uow.run` and validates everything before writing (an `err` returned does not roll back).

/** One cost row to post. `amount` signed, without VAT (rounded to 2 places on write). */
export interface CostLedgerEntryInput {
    projectId: ProjectId;
    /** A cost code of the project (checked; omitted codes allowed), or null for overhead. */
    costCodeId: string | null;
    entryDate: string;
    kind: CostEntryKind;
    category: CostCategory;
    amount: number;
    qty?: number | null;
    /** e.g. `purchase_order`, `goods_receipt` (COST_SOURCE_TYPES). */
    sourceType: string;
    sourceId: string;
    sourceLineId?: string | null;
    /**
     * The PO / contract line the row opens (commit) or frees (commit_release, required). A commit without one uses
     * `sourceLineId ?? sourceId`. The open amount per (commitmentRef, costCodeId) may never drop below 0.
     */
    commitmentRef?: string | null;
    note?: string;
    by: UserId;
}

export interface CostLedgerEntry {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    costCodeId: string | null;
    entryDate: string;
    kind: CostEntryKind;
    category: CostCategory;
    amount: number;
    qty: number | null;
    sourceType: string;
    sourceId: string;
    sourceLineId: string | null;
    commitmentRef: string | null;
    reversesId: string | null;
    note: string;
    createdBy: UserId;
    createdAt: Date;
}

/** committedOpen = committed + released (released ≤ 0). */
export interface CostLedgerTotals {
    committed: number;
    released: number;
    committedOpen: number;
    actual: number;
}

export interface CostLedgerCodeTotals extends CostLedgerTotals {
    costCodeId: string | null;
}

export interface CostLedgerReverseInput {
    by: UserId;
    /** Business date of the reversal row. */
    date: string;
    note?: string;
}

export abstract class CostLedger {
    /**
     * Appends the rows (one call = one batch, inside the caller's transaction). validation_failed for a bad row,
     * not_found for a project / cost code not of the workspace, unprocessable `commitment_exceeded` when a release
     * (or a negative commit) would leave a commitment below 0.
     */
    abstract post(workspaceId: WorkspaceId, entries: readonly CostLedgerEntryInput[]): Promise<Result<CostLedgerEntry[], DomainError>>;
    /**
     * A new row with negated amount / qty pointing at the original. not_found; conflict `already_reversed` (also for a
     * reversal row); unprocessable `commitment_exceeded` (reverse the releases of a commitment before its commit).
     */
    abstract reverse(workspaceId: WorkspaceId, entryId: string, input: CostLedgerReverseInput): Promise<Result<CostLedgerEntry, DomainError>>;
    /** Reverses every not yet reversed row of a source (releases first). Ok with [] when there is nothing to reverse. */
    abstract reverseSource(
        workspaceId: WorkspaceId, sourceType: string, sourceId: string, input: CostLedgerReverseInput,
    ): Promise<Result<CostLedgerEntry[], DomainError>>;
    /** One row per cost code that has entries (null = overhead). */
    abstract totalsByCostCode(workspaceId: WorkspaceId, projectId: ProjectId): Promise<CostLedgerCodeTotals[]>;
    /** Totals per project (projects without entries are absent). One query for the whole set. */
    abstract totalsByProject(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<Map<ProjectId, CostLedgerTotals>>;
    /** Rows posted by a source, oldest first (reversals included). */
    abstract entriesBySource(workspaceId: WorkspaceId, sourceType: string, sourceId: string): Promise<CostLedgerEntry[]>;
    /** Open amount (Σ commit + Σ commit_release) per commitment ref; refs without rows are absent. */
    abstract openCommitments(workspaceId: WorkspaceId, refs: readonly string[]): Promise<Map<string, number>>;
}

/** One money event to post (amounts signed, rounded to 2 places on write). */
export interface FinEventInput {
    projectId: ProjectId | null;
    eventDate: string;
    eventType: FinEventType;
    direction: FinDirection;
    counterpartyType: FinCounterpartyType;
    counterpartyId?: string | null;
    counterpartyName: string;
    counterpartyTaxId?: string;
    counterpartyBranch?: string;
    docType?: string | null;
    docNumber?: string | null;
    docDate?: string | null;
    sourceType: string;
    sourceId: string;
    /** Without VAT. */
    net: number;
    vat?: number;
    wht?: number;
    retention?: number;
    /** Money that actually moved (0 when none). */
    cash?: number;
    data?: Record<string, unknown>;
    by: UserId;
}

export interface FinEvent {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId | null;
    eventDate: string;
    eventType: FinEventType;
    direction: FinDirection;
    counterpartyType: FinCounterpartyType;
    counterpartyId: string | null;
    counterpartyName: string;
    counterpartyTaxId: string;
    counterpartyBranch: string;
    docType: string | null;
    docNumber: string | null;
    docDate: string | null;
    sourceType: string;
    sourceId: string;
    net: number;
    vat: number;
    wht: number;
    retention: number;
    cash: number;
    reversesId: string | null;
    data: Record<string, unknown>;
    createdBy: UserId;
    createdAt: Date;
}

/** Dates inclusive; `types` empty / absent = every type. */
export interface FinEventFilter {
    from?: string;
    to?: string;
    types?: readonly FinEventType[];
    projectId?: ProjectId;
}

export abstract class FinancialEvents {
    /** Appends one event inside the caller's transaction. validation_failed; not_found for a project of another workspace. */
    abstract post(workspaceId: WorkspaceId, event: FinEventInput): Promise<Result<FinEvent, DomainError>>;
    /** A new event with every amount negated, `reverses_id` = the original. not_found; conflict `already_reversed`. */
    abstract reverse(workspaceId: WorkspaceId, eventId: string, input: CostLedgerReverseInput): Promise<Result<FinEvent, DomainError>>;
    /** Oldest first (event date, then creation). */
    abstract list(workspaceId: WorkspaceId, filter: FinEventFilter): Promise<FinEvent[]>;
    /** Events of a source, oldest first (reversals included). */
    abstract bySource(workspaceId: WorkspaceId, sourceType: string, sourceId: string): Promise<FinEvent[]>;
}

// ── Quotations as other modules read them (WP-26) ──

/** The accepted version of a quotation, as a contract is made from it. */
export interface AcceptedQuotation {
    quotationId: string;
    versionId: string;
    projectId: ProjectId;
    customerId: string | null;
    title: string;
    /** Number of the accepted version. */
    number: string | null;
    language: DocLanguage;
    boqVersionId: string | null;
    /** Price without VAT (after discount / rounding; government: split out of the VAT-inclusive total, D-40). */
    vatBase: number;
    vat: number;
    grandTotal: number;
    marginPct: number;
    paymentTerms: MilestoneTemplateItem[];
}

/** Provided by quotations. No module check (the caller checked its own); filters by workspace. */
export abstract class QuotationLookup {
    /** not_found (not a quotation of the workspace); conflict `quotation_not_accepted` when no version is accepted. */
    abstract accepted(workspaceId: WorkspaceId, quotationId: string): Promise<Result<AcceptedQuotation, DomainError>>;
    /** Priced lines (`boq` / `custom` of included sections) of a version, for allocateContractAmounts; [] when unknown. */
    abstract contractLines(workspaceId: WorkspaceId, versionId: string): Promise<CostCodeContractLine[]>;
}

/** Sell factor (no VAT) per BOQ section, and the one for sections the quotation does not list (WP-33). */
export interface QuotationSellFactors {
    bySection: Record<number, number>;
    fallback: number;
}

/** Provided by quotations (WP-33). No module check (the caller checked its own); filters by workspace. */
export abstract class QuotationPricingLookup {
    /**
     * Sell factors of a quotation version's sections (`qt_quotation_sections`): 1 + markup + overhead + profit; a
     * government version uses its part's Factor F without VAT. Unknown / null version → the default rates.
     */
    abstract sellFactors(workspaceId: WorkspaceId, quotationVersionId: string | null): Promise<QuotationSellFactors>;
}

// ── Main contracts (WP-26, docs/erp/02-domain-model.md §3) ──

export interface MainContractMilestone {
    id: string;
    contractId: string;
    no: number;
    labelTh: string;
    labelEn: string;
    kind: ContractMilestoneKind;
    pct: number;
    amount: number;
    trigger: ContractMilestoneTrigger;
    triggerProgress: number | null;
    dueDate: string | null;
    costCodeIds: string[];
    /** As stored (`planned` may already be claimable by its trigger: see the contract DTO). */
    status: ContractMilestoneStatus;
    source: ContractMilestoneSource;
    variationId: string | null;
}

/** A main contract as other modules see it (amounts without VAT). */
export interface MainContractInfo {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    customerId: string;
    quotationId: string | null;
    quotationVersionId: string | null;
    quotedMarginPct: number | null;
    number: string | null;
    status: MainContractStatus;
    title: string;
    language: DocLanguage;
    signDate: string | null;
    startDate: string | null;
    finishDate: string | null;
    billingMode: MainContractBillingMode;
    originalValue: number;
    currentValue: number;
    vatRate: number;
    extensionDays: number;
    terms: MainContractTerms;
    /** Business date the work was handed over (signed → completed); null before. */
    completedAt: string | null;
    /** `no` order (the advance one, no 0, first). */
    milestones: MainContractMilestone[];
}

/**
 * Provided by main-contracts. No module check (the caller checked its own); filters by workspace. Writes join the
 * caller's `uow.run`, lock the contract row and are audited; an `err` is returned before anything is written.
 */
export abstract class MainContracts {
    abstract find(workspaceId: WorkspaceId, contractId: string): Promise<MainContractInfo | undefined>;
    /** Workspace and project of a contract by id alone (any workspace: the caller authorizes on the project next). */
    abstract locate(contractId: string): Promise<{ workspaceId: WorkspaceId; projectId: ProjectId } | undefined>;
    /** The project's effective contract (not cancelled / terminated; may still be a draft). */
    abstract forProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<MainContractInfo | undefined>;
    /**
     * An accepted variation on a signed contract: `current_value += sellDelta`, `extension_days += extensionDays`,
     * `finish_date` moved; milestones by `billing` (`separate_milestone` adds one `source='variation'`, `spread`
     * re-allocates the unclaimed ones, `next_claim` leaves them). unprocessable `invalid_billing_option` for
     * `next_claim` on a milestone-billed contract; conflict `invalid_transition` when not signed.
     */
    abstract applyVariation(
        workspaceId: WorkspaceId, contractId: string,
        input: { sellDelta: number; extensionDays: number; billing: ContractVariationBilling; variationId: string; label?: { th: string; en: string }; by: UserId | null },
    ): Promise<Result<void, DomainError>>;
    /** Sets a milestone's stored status (billing: claimed → invoiced → paid, and back when a claim / invoice is voided). */
    abstract markMilestone(workspaceId: WorkspaceId, milestoneId: string, status: ContractMilestoneStatus): Promise<Result<void, DomainError>>;
    /** signed → completed on `date` (handover accepted). conflict `invalid_transition` otherwise. */
    abstract complete(workspaceId: WorkspaceId, contractId: string, date: string, by?: UserId | null): Promise<Result<void, DomainError>>;
}

// ── Billing totals (WP-30): what other modules (closeout WP-55) read of a project's receivables ──

export interface ProjectBillingTotals {
    /** Σ net of issued (not voided) claim and advance invoices. */
    billed: number;
    /** Σ settled (cash + customer WHT) on the project's invoices. */
    received: number;
    /** Customer retention still held (withheld − released − forfeited). */
    retentionHeld: number;
    /** Advance received and not recovered yet. */
    advanceOutstanding: number;
}

/** Provided by billing. No module check (the caller checked its own); filters by workspace. */
export abstract class BillingTotals {
    abstract totalsByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<ProjectBillingTotals>;
}
