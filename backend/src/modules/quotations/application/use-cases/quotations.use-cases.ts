// ─── Quotation use cases (docs/erp/04-implementation-plan.md WP-23, docs/erp/02-domain-model.md §2) ───
// Read `quotations.read`, edit `quotations.manage`, issue / record an answer `quotations.issue`. Cost and margin fields
// are left out of every DTO for callers without `quotations.seeMargins`.
import { Injectable } from '@nestjs/common';
import {
    CUSTOM_SECTION_NO_MIN, type CreateQuotationRequest, type IssueQuotationVersionRequest, type NewQuotationVersionRequest,
    type PatchQuotationVersionRequest, QUOTATION_DEFAULT_VALID_DAYS, type QuotationCompareDto, type QuotationCompareQuery, type QuotationDto,
    type QuotationVersionDto, type RecordQuotationResponseRequest,
} from '@contrack/contract';
import { addDays, bangkokToday } from '@contrack/domain/dates/business-date';
import {
    type QuotationLineInput, type QuotationPart, type QuotationPricing, QuotationPricingError, type QuotationSectionInput,
    buildQuotationDraft, compareQuotationVersions, defaultGovernmentParts, lineCostAmount,
} from '@contrack/domain/quotation';
import { type ProjectGrant, ModuleAccess } from '../../../../shared/application/module-access';
import {
    Approvals, AuditLog, type BoqVersionSourceContent, BoqVersionSource, Clock, IdGenerator, UnitOfWork,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { can } from '../../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { requireDraft, requireStatus } from '../../domain/quotation-state';
import {
    QuotationRepository, type QuotationRecord, type QuotationVersionRecord, type QuotationVersionRows, type StoredQuotationLine,
} from '../ports/quotation.repository';
import { compareDto, quotationDto, versionDto } from '../quotation-views';
import { MODULE, QuotationAccess, QuotationWorkflow, seesMargins, transact } from '../quotation.service';

const canEdit = (grant: ProjectGrant, v: QuotationVersionRecord): boolean =>
    v.status === 'draft' && can(grant.role, 'quotations.manage') && !grant.archived;

const draftExists = (): DomainError =>
    DomainError.conflict('This quotation already has a draft; issue or cancel it first', { reason: 'draft_exists' });

function pricingError(e: unknown): DomainError {
    if (e instanceof QuotationPricingError) {
        const first = e.issues[0];
        return DomainError.validation(e.message, { reason: first?.reason, path: first?.path, issues: e.issues });
    }
    throw e;
}

/** Section inputs of stored sections. */
const sectionInputs = (rows: QuotationVersionRows): QuotationSectionInput[] => rows.sections.map(s => ({
    sectionNo: s.sectionNo, titleTh: s.titleTh, titleEn: s.titleEn, included: s.included, sort: s.sort,
    markupRate: s.markupRate, overheadRate: s.overheadRate, profitRate: s.profitRate, vatRate: s.vatRate,
}));

/** Line inputs of stored lines (ids kept). */
const lineInputs = (rows: QuotationVersionRows): (QuotationLineInput & { id: string })[] => rows.lines.map(l => ({
    id: l.id, sectionNo: l.sectionNo, sort: l.sort, kind: l.kind, lineKey: l.lineKey, descTh: l.descTh, descEn: l.descEn,
    unit: l.unit, qty: l.qty, costMatUnit: l.costMatUnit, costLabUnit: l.costLabUnit, costAmount: l.costAmount,
}));

/** Government parts that still cover every included section exactly once (stale section numbers dropped). */
function fitParts(parts: readonly QuotationPart[], sections: readonly QuotationSectionInput[]): QuotationPart[] {
    const nos = new Set(sections.map(s => s.sectionNo));
    const seen = new Set<number>();
    const fitted = parts.map(p => ({
        ...p,
        sectionNos: p.sectionNos.filter(n => {
            if (!nos.has(n) || seen.has(n)) return false;
            seen.add(n);
            return true;
        }),
    }));
    if (fitted.length === 0) return defaultGovernmentParts(sections);
    const missing = sections.filter(s => s.included && !seen.has(s.sectionNo)).map(s => s.sectionNo);
    if (missing.length > 0 && fitted[0] !== undefined) fitted[0] = { ...fitted[0], sectionNos: [...fitted[0].sectionNos, ...missing] };
    return fitted;
}

/** Pricing adjusted to a format: government ↔ the others switch the VAT mode and the parts. */
function pricingForFormat(
    pricing: QuotationPricing, format: QuotationVersionRecord['format'], sections: readonly QuotationSectionInput[], vatRegistered: boolean,
    explicit: Partial<QuotationPricing>,
): QuotationPricing {
    const government = format === 'government';
    const next = { ...pricing, ...explicit };
    if (explicit.vatMode === undefined) {
        if (government) next.vatMode = 'included_in_factor';
        else if (next.vatMode === 'included_in_factor') next.vatMode = vatRegistered ? 'document' : 'none';
    }
    if (explicit.parts === undefined) next.parts = government ? fitParts(next.parts, sections) : [];
    if (government) {
        if (explicit.discount === undefined) next.discount = null;
        if (explicit.rounding === undefined) next.rounding = 'none';
    }
    return next;
}

// ── reads ──

/** GET /projects/:projectId/quotations — `quotations.read`; newest first, every version summarised. */
@Injectable()
export class ListQuotationsUseCase {
    constructor(private readonly access: ModuleAccess, private readonly repo: QuotationRepository) {}

    async execute(userId: UserId, projectId: ProjectId): Promise<Result<QuotationDto[], DomainError>> {
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: ['quotations.read'], write: false });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;
        const quotations = await this.repo.listByProject(ws, projectId);
        const versions = await this.repo.versionsOf(ws, quotations.map(q => q.id));
        return ok(quotations.map(q => quotationDto(q, versions)));
    }
}

/** GET /quotations/:quotationId — `quotations.read`. */
@Injectable()
export class GetQuotationUseCase {
    constructor(private readonly quotations: QuotationAccess, private readonly repo: QuotationRepository) {}

    async execute(userId: UserId, quotationId: string): Promise<Result<QuotationDto, DomainError>> {
        const loaded = await this.quotations.quotation(userId, quotationId, ['quotations.read'], false);
        if (!loaded.ok) return loaded;
        const { quotation } = loaded.value;
        return ok(quotationDto(quotation, await this.repo.versionsOf(quotation.workspaceId, [quotation.id])));
    }
}

/** Builds the full version DTO the caller may see. */
@Injectable()
export class QuotationVersionViews {
    constructor(private readonly repo: QuotationRepository) {}

    async dto(grant: ProjectGrant, q: QuotationRecord, v: QuotationVersionRecord): Promise<QuotationVersionDto> {
        const rows = await this.repo.rows(v.workspaceId, v.id);
        return versionDto(q, v, rows, { seesMargins: seesMargins(grant), canEdit: canEdit(grant, v) });
    }

    /** Re-reads quotation + version after a change. */
    async fresh(grant: ProjectGrant, versionId: string): Promise<Result<QuotationVersionDto, DomainError>> {
        const v = await this.repo.findVersion(versionId);
        const q = v === undefined ? undefined : await this.repo.findQuotation(v.quotationId);
        if (v === undefined || q === undefined) return err(DomainError.notFound('QuotationVersion'));
        return ok(await this.dto(grant, q, v));
    }
}

/** GET /quotation-versions/:versionId — `quotations.read`; with sections, lines and parts. */
@Injectable()
export class GetQuotationVersionUseCase {
    constructor(private readonly quotations: QuotationAccess, private readonly views: QuotationVersionViews) {}

    async execute(userId: UserId, versionId: string): Promise<Result<QuotationVersionDto, DomainError>> {
        const loaded = await this.quotations.version(userId, versionId, ['quotations.read'], false);
        if (!loaded.ok) return loaded;
        const { grant, quotation, version } = loaded.value;
        return ok(await this.views.dto(grant, quotation, version));
    }
}

/** GET /quotations/:quotationId/compare?from=&to= — `quotations.read`; both versions of that quotation. */
@Injectable()
export class CompareQuotationVersionsUseCase {
    constructor(private readonly quotations: QuotationAccess, private readonly repo: QuotationRepository) {}

    async execute(userId: UserId, quotationId: string, query: QuotationCompareQuery): Promise<Result<QuotationCompareDto, DomainError>> {
        const loaded = await this.quotations.quotation(userId, quotationId, ['quotations.read'], false);
        if (!loaded.ok) return loaded;
        const { grant, quotation } = loaded.value;
        const versions = await this.repo.versionsOf(quotation.workspaceId, [quotation.id]);
        const from = versions.find(v => v.id === query.from.toLowerCase());
        const to = versions.find(v => v.id === query.to.toLowerCase());
        if (from === undefined || to === undefined) return err(DomainError.notFound('QuotationVersion'));
        const a = await this.repo.rows(quotation.workspaceId, from.id);
        const b = await this.repo.rows(quotation.workspaceId, to.id);
        const comparison = compareQuotationVersions(
            { sections: a.sections, lines: a.lines, totals: from.totals },
            { sections: b.sections, lines: b.lines, totals: to.totals },
        );
        return ok(compareDto(from, to, comparison, seesMargins(grant)));
    }
}

// ── writes ──

/**
 * POST /projects/:projectId/quotations — `quotations.manage`. Sections and lines from `boqVersionId`, or from a new
 * revision `QT-<n>` of the current BOQ; terms from the project's commercial settings; priced by src/domain/quotation.
 */
@Injectable()
export class CreateQuotationUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly repo: QuotationRepository,
        private readonly workflow: QuotationWorkflow,
        private readonly boq: BoqVersionSource,
        private readonly views: QuotationVersionViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; projectId: ProjectId; body: CreateQuotationRequest }): Promise<Result<QuotationVersionDto, DomainError>> {
        const { userId, projectId, body } = input;
        const grant = await this.access.toProject(userId, projectId, MODULE, { permissions: ['quotations.manage'], write: true });
        if (!grant.ok) return grant;
        const ws = grant.value.workspaceId;

        let customerId: string | null;
        if (body.customerId !== undefined) {
            const checked = await this.workflow.checkCustomer(ws, body.customerId);
            if (!checked.ok) return checked;
            customerId = checked.value;
        } else {
            // The project's customer when it is still a usable one.
            const checked = await this.workflow.checkCustomer(ws, await this.workflow.hubCustomerId(ws, projectId));
            customerId = checked.ok ? checked.value : null;
        }

        const created = await transact(this.uow, async (): Promise<Result<string, DomainError>> => {
            const content = await this.boqContent(ws, projectId, body.boqVersionId, userId);
            if (!content.ok) return content;
            const s = await this.workflow.settings(ws, projectId);
            const project = {
                ...s.project,
                quotationFormat: body.format ?? s.project.quotationFormat,
                detailLevel: body.detailLevel ?? s.project.detailLevel,
                documentLanguage: body.language ?? s.project.documentLanguage,
            };
            let draft: ReturnType<typeof buildQuotationDraft>;
            try {
                draft = buildQuotationDraft(content.value, { project, vatRegistered: s.vatRegistered, vatRate: s.vatRate });
            } catch (e) {
                return err(pricingError(e));
            }
            const now = this.clock.now();
            const title = body.title !== undefined && body.title !== '' ? body.title : await this.workflow.projectName(ws, projectId);
            const quotation: QuotationRecord = {
                id: this.ids.newId(), workspaceId: ws, projectId, customerId, title, number: null, currentVersionId: null,
                acceptedVersionId: null, createdBy: userId, createdAt: now, updatedAt: now,
            };
            const version: QuotationVersionRecord = {
                id: this.ids.newId(), quotationId: quotation.id, workspaceId: ws, projectId, versionNo: 1, status: 'draft',
                boqVersionId: content.value.versionId, format: draft.format, detailLevel: draft.detailLevel, language: draft.language,
                issueDate: null, validUntil: null, number: null, customerSnapshot: null, companySnapshot: null,
                pricing: draft.pricing, totals: draft.totals, paymentTerms: draft.paymentTerms, termsTh: '', termsEn: '', note: '',
                acceptedAt: null, acceptedByName: '', responseNote: '', issuedBy: null, issuedAt: null,
                createdBy: userId, createdAt: now, updatedAt: now,
            };
            const lines: StoredQuotationLine[] = draft.lines.map(l => ({ ...l, id: this.ids.newId() }));
            await this.repo.insertQuotation({ ...quotation, currentVersionId: version.id });
            await this.repo.insertVersion(version, { sections: draft.sections, lines });
            await this.audit.record({
                workspaceId: ws, projectId, actor: userId, entityType: 'quotation', entityId: quotation.id, action: 'create',
                data: { versionId: version.id, boqVersionId: version.boqVersionId, format: version.format, grandTotal: version.totals.grandTotal },
            });
            return ok(version.id);
        });
        if (!created.ok) return created;
        return this.views.fresh(grant.value, created.value);
    }

    private async boqContent(
        ws: WorkspaceId, projectId: ProjectId, boqVersionId: string | undefined, by: UserId,
    ): Promise<Result<BoqVersionSourceContent, DomainError>> {
        if (boqVersionId === undefined) return this.boq.snapshot(ws, projectId, { labelPrefix: 'QT', by });
        const content = await this.boq.content(ws, projectId, boqVersionId.toLowerCase());
        return content === undefined ? err(DomainError.notFound('BoqVersion')) : ok(content);
    }
}

/**
 * PATCH /quotation-versions/:versionId — `quotations.manage`, draft only (issued → 409 `already_issued`). Sections /
 * lines replace the lists when sent; everything is priced again on the server.
 */
@Injectable()
export class PatchQuotationVersionUseCase {
    constructor(
        private readonly quotations: QuotationAccess,
        private readonly repo: QuotationRepository,
        private readonly workflow: QuotationWorkflow,
        private readonly views: QuotationVersionViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; versionId: string; body: PatchQuotationVersionRequest }): Promise<Result<QuotationVersionDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.quotations.version(userId, input.versionId, ['quotations.manage'], true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;

        let customerId: string | null | undefined;
        if (body.customerId !== undefined && body.customerId !== loaded.value.quotation.customerId) {
            const checked = await this.workflow.checkCustomer(ws, body.customerId);
            if (!checked.ok) return checked;
            customerId = checked.value;
        }

        const saved = await transact(this.uow, async (): Promise<Result<string, DomainError>> => {
            const q = await this.repo.lockQuotation(ws, loaded.value.quotation.id);
            const v = await this.repo.findVersion(loaded.value.version.id);
            if (q === undefined || v === undefined) return err(DomainError.notFound('QuotationVersion'));
            const draft = requireDraft(v.status);
            if (!draft.ok) return draft;
            const issueDate = body.issueDate !== undefined ? body.issueDate : v.issueDate;
            const validUntil = body.validUntil !== undefined ? body.validUntil : v.validUntil;
            if (issueDate !== null && validUntil !== null && validUntil < issueDate) {
                return err(DomainError.validation('validUntil is before issueDate', { reason: 'valid_until_before_issue_date' }));
            }

            const stored = await this.repo.rows(ws, v.id);
            const format = body.format ?? v.format;
            const detailLevel = body.detailLevel ?? v.detailLevel;
            const basePricing = { ...v.pricing, ...(body.pricing?.defaults !== undefined ? { defaults: body.pricing.defaults } : {}) };
            const sections = body.sections === undefined ? sectionInputs(stored) : this.sections(body.sections, stored, basePricing);
            const lines = body.lines === undefined ? lineInputs(stored) : this.lines(body.lines, stored);
            const { vatRegistered } = await this.workflow.settings(ws, v.projectId);
            const pricing = pricingForFormat(basePricing, format, sections, vatRegistered, body.pricing ?? {});
            const priced = await this.workflow.price(ws, { format, detailLevel, pricing, sections, lines });
            if (!priced.ok) return priced;

            const now = this.clock.now();
            const next: QuotationVersionRecord = {
                ...v, format, detailLevel, pricing, totals: priced.value.totals, issueDate, validUntil,
                language: body.language ?? v.language,
                paymentTerms: body.paymentTerms ?? v.paymentTerms,
                termsTh: body.termsTh ?? v.termsTh,
                termsEn: body.termsEn ?? v.termsEn,
                note: body.note ?? v.note,
                updatedAt: now,
            };
            await this.repo.saveVersion(next);
            await this.repo.replaceRows(ws, v.id, priced.value.rows);
            const quotation: QuotationRecord = {
                ...q, title: body.title ?? q.title, customerId: customerId !== undefined ? customerId : q.customerId, updatedAt: now,
            };
            await this.repo.saveQuotation(quotation);
            const changed: Record<string, unknown> = {};
            if (quotation.title !== q.title) changed.title = [q.title, quotation.title];
            if (quotation.customerId !== q.customerId) changed.customerId = [q.customerId, quotation.customerId];
            if (next.format !== v.format) changed.format = [v.format, next.format];
            if (next.totals.grandTotal !== v.totals.grandTotal) changed.grandTotal = [v.totals.grandTotal, next.totals.grandTotal];
            await this.audit.record({
                workspaceId: ws, projectId: v.projectId, actor: userId, entityType: 'quotation_version', entityId: v.id, action: 'update',
                data: { ...changed, fields: Object.keys(body) },
            });
            return ok(v.id);
        });
        if (!saved.ok) return saved;
        return this.views.fresh(grant, saved.value);
    }

    private sections(
        input: NonNullable<PatchQuotationVersionRequest['sections']>, stored: QuotationVersionRows, pricing: QuotationPricing,
    ): QuotationSectionInput[] {
        const before = new Map(stored.sections.map(s => [s.sectionNo, s]));
        return input.map(s => {
            const old = before.get(s.sectionNo);
            return {
                sectionNo: s.sectionNo, titleTh: s.titleTh, titleEn: s.titleEn, included: s.included, sort: s.sort, vatRate: s.vatRate,
                markupRate: s.markupRate ?? old?.markupRate ?? pricing.defaults.markupRate,
                overheadRate: s.overheadRate ?? old?.overheadRate ?? pricing.defaults.overheadRate,
                profitRate: s.profitRate ?? old?.profitRate ?? pricing.defaults.profitRate,
            };
        });
    }

    /** Stored lines keep their BOQ cost unless qty or unit costs changed; new lines get new ids. */
    private lines(input: NonNullable<PatchQuotationVersionRequest['lines']>, stored: QuotationVersionRows): (QuotationLineInput & { id: string })[] {
        const before = new Map(stored.lines.map(l => [l.id, l]));
        const used = new Set<string>();
        return input.map(l => {
            const key = l.id?.toLowerCase();
            const old = key === undefined || used.has(key) ? undefined : before.get(key);
            if (old !== undefined) used.add(old.id);
            const costMatUnit = l.costMatUnit ?? old?.costMatUnit ?? 0;
            const costLabUnit = l.costLabUnit ?? old?.costLabUnit ?? 0;
            const sameCost = old?.kind === l.kind && old.qty === l.qty
                && old.costMatUnit === costMatUnit && old.costLabUnit === costLabUnit;
            return {
                id: old?.id ?? this.ids.newId(),
                sectionNo: l.sectionNo, sort: l.sort, kind: l.kind,
                lineKey: l.kind === 'boq' ? (l.lineKey ?? old?.lineKey ?? null) : l.lineKey,
                descTh: l.descTh, descEn: l.descEn, unit: l.unit, qty: l.qty, costMatUnit, costLabUnit,
                costAmount: sameCost ? old.costAmount : lineCostAmount(l.qty, costMatUnit, costLabUnit),
            };
        });
    }
}

/**
 * POST /quotations/:quotationId/versions — `quotations.manage`. Copies a version (default the latest), or rebuilds the
 * sections and lines from a BOQ version keeping the commercial choices. One open draft per quotation (409 `draft_exists`);
 * an accepted quotation takes no new version (409 `invalid_transition`).
 */
@Injectable()
export class NewQuotationVersionUseCase {
    constructor(
        private readonly quotations: QuotationAccess,
        private readonly repo: QuotationRepository,
        private readonly workflow: QuotationWorkflow,
        private readonly boq: BoqVersionSource,
        private readonly views: QuotationVersionViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; quotationId: string; body: NewQuotationVersionRequest }): Promise<Result<QuotationVersionDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.quotations.quotation(userId, input.quotationId, ['quotations.manage'], true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;

        const created = await transact(this.uow, async (): Promise<Result<string, DomainError>> => {
            const q = await this.repo.lockQuotation(ws, loaded.value.quotation.id);
            if (q === undefined) return err(DomainError.notFound('Quotation'));
            const versions = await this.repo.versionsOf(ws, [q.id]);
            if (q.acceptedVersionId !== null) {
                return err(DomainError.conflict('The quotation has been accepted', { reason: 'invalid_transition', status: 'accepted' }));
            }
            if (versions.some(v => v.status === 'draft' || v.status === 'pending_approval')) return err(draftExists());
            const latest = versions.reduce<QuotationVersionRecord | undefined>((m, v) => (m === undefined || v.versionNo > m.versionNo ? v : m), undefined);
            const source = body.fromVersionId === undefined ? latest : versions.find(v => v.id === body.fromVersionId?.toLowerCase());
            if (source === undefined || latest === undefined) return err(DomainError.notFound('QuotationVersion'));
            const stored = await this.repo.rows(ws, source.id);

            let boqVersionId = source.boqVersionId;
            let sections = sectionInputs(stored);
            let lines = lineInputs(stored).map(l => ({ ...l, id: this.ids.newId() }));
            let pricing = source.pricing;
            if (body.fromBoq || body.boqVersionId !== undefined) {
                const content = body.boqVersionId === undefined
                    ? await this.boq.snapshot(ws, q.projectId, { labelPrefix: 'QT', by: userId })
                    : await this.contentOf(ws, q.projectId, body.boqVersionId);
                if (!content.ok) return content;
                boqVersionId = content.value.versionId;
                const rebuilt = await this.rebuild(ws, q.projectId, source, stored, content.value);
                if (!rebuilt.ok) return rebuilt;
                ({ sections, lines, pricing } = rebuilt.value);
            }
            const priced = await this.workflow.price(ws, { format: source.format, detailLevel: source.detailLevel, pricing, sections, lines });
            if (!priced.ok) return priced;

            const now = this.clock.now();
            const version: QuotationVersionRecord = {
                ...source,
                id: this.ids.newId(), versionNo: latest.versionNo + 1, status: 'draft', boqVersionId, pricing, totals: priced.value.totals,
                issueDate: null, validUntil: null, number: null, customerSnapshot: null, companySnapshot: null,
                acceptedAt: null, acceptedByName: '', responseNote: '', issuedBy: null, issuedAt: null,
                createdBy: userId, createdAt: now, updatedAt: now,
            };
            await this.repo.insertVersion(version, priced.value.rows);
            await this.repo.saveQuotation({ ...q, currentVersionId: version.id, updatedAt: now });
            await this.audit.record({
                workspaceId: ws, projectId: q.projectId, actor: userId, entityType: 'quotation_version', entityId: version.id, action: 'create',
                data: { fromVersionId: source.id, versionNo: version.versionNo, boqVersionId, grandTotal: version.totals.grandTotal },
            });
            return ok(version.id);
        });
        if (!created.ok) return created;
        return this.views.fresh(grant, created.value);
    }

    private async contentOf(ws: WorkspaceId, projectId: ProjectId, boqVersionId: string): Promise<Result<BoqVersionSourceContent, DomainError>> {
        const content = await this.boq.content(ws, projectId, boqVersionId.toLowerCase());
        return content === undefined ? err(DomainError.notFound('BoqVersion')) : ok(content);
    }

    /**
     * Sections and lines from the BOQ, with the source version's choices: section titles / rates / inclusion where the
     * section still exists, the user's own sections (≥ 100) and every custom / note line, the pricing and parts.
     */
    private async rebuild(
        ws: WorkspaceId, projectId: ProjectId, source: QuotationVersionRecord, stored: QuotationVersionRows, content: BoqVersionSourceContent,
    ): Promise<Result<{ sections: QuotationSectionInput[]; lines: (QuotationLineInput & { id: string })[]; pricing: QuotationPricing }, DomainError>> {
        const s = await this.workflow.settings(ws, projectId);
        let draft: ReturnType<typeof buildQuotationDraft>;
        try {
            draft = buildQuotationDraft(content, {
                project: { ...s.project, quotationFormat: source.format, detailLevel: source.detailLevel, documentLanguage: source.language },
                vatRegistered: s.vatRegistered, vatRate: s.vatRate, rates: source.pricing.defaults,
            });
        } catch (e) {
            return err(pricingError(e));
        }
        const old = new Map(stored.sections.map(x => [x.sectionNo, x]));
        const sections: QuotationSectionInput[] = draft.sections.map(x => {
            const o = old.get(x.sectionNo);
            return o === undefined
                ? { ...x }
                : { ...x, titleTh: o.titleTh, titleEn: o.titleEn, included: o.included, markupRate: o.markupRate, overheadRate: o.overheadRate, profitRate: o.profitRate, vatRate: o.vatRate };
        });
        const boqNos = new Set(sections.map(x => x.sectionNo));
        for (const o of sectionInputs(stored)) {
            if (o.sectionNo >= CUSTOM_SECTION_NO_MIN && !boqNos.has(o.sectionNo)) sections.push(o);
        }
        const kept = new Set(sections.map(x => x.sectionNo));
        const lines = [
            ...draft.lines.map(l => ({ ...l, id: this.ids.newId() })),
            ...lineInputs(stored).filter(l => l.kind !== 'boq' && kept.has(l.sectionNo)).map(l => ({ ...l, id: this.ids.newId() })),
        ];
        const pricing: QuotationPricing = {
            ...source.pricing,
            parts: source.format === 'government' ? fitParts(source.pricing.parts, sections) : [],
        };
        return ok({ sections, lines, pricing });
    }
}

/**
 * POST /quotation-versions/:versionId/issue — `quotations.issue`, draft only. Approval `quotation.issue` first: approved
 * at once (auto-skip) → issued now; otherwise `pending_approval` until the approver decides (QuotationApprovalHandler).
 */
@Injectable()
export class IssueQuotationVersionUseCase {
    constructor(
        private readonly quotations: QuotationAccess,
        private readonly repo: QuotationRepository,
        private readonly workflow: QuotationWorkflow,
        private readonly approvals: Approvals,
        private readonly views: QuotationVersionViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; versionId: string; body: IssueQuotationVersionRequest }): Promise<Result<QuotationVersionDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.quotations.version(userId, input.versionId, ['quotations.issue'], true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;

        const done = await transact(this.uow, async (): Promise<Result<{ pendingRequestId: string | null }, DomainError>> => {
            const q = await this.repo.lockQuotation(ws, loaded.value.quotation.id);
            const v = await this.repo.findVersion(loaded.value.version.id);
            if (q === undefined || v === undefined) return err(DomainError.notFound('QuotationVersion'));
            const draft = requireDraft(v.status);
            if (!draft.ok) return draft;
            const issueDate = body.issueDate ?? v.issueDate ?? bangkokToday(this.clock.now());
            const validUntil = body.validUntil ?? v.validUntil ?? addDays(issueDate, QUOTATION_DEFAULT_VALID_DAYS);
            if (validUntil < issueDate) {
                return err(DomainError.validation('validUntil is before issueDate', { reason: 'valid_until_before_issue_date' }));
            }
            const dated: QuotationVersionRecord = { ...v, issueDate, validUntil };
            const ticket = await this.approvals.request({
                workspaceId: ws, subject: 'quotation.issue', subjectId: v.id, projectId: v.projectId, amount: v.totals.grandTotal,
                title: `${q.title} (v${v.versionNo})`, requestedBy: userId, requesterRole: grant.role,
            });
            if (!ticket.ok) return ticket;
            if (ticket.value.status === 'approved') {
                const issued = await this.workflow.issueLocked(q, dated, userId);
                if (!issued.ok) return issued;
                return ok({ pendingRequestId: null });
            }
            const now = this.clock.now();
            await this.repo.saveVersion({ ...dated, status: 'pending_approval', updatedAt: now });
            await this.audit.record({
                workspaceId: ws, projectId: v.projectId, actor: userId, entityType: 'quotation_version', entityId: v.id, action: 'submit',
                data: { status: [v.status, 'pending_approval'], approvalRequestId: ticket.value.requestId },
            });
            return ok({ pendingRequestId: ticket.value.requestId });
        });
        if (!done.ok) return done;
        if (done.value.pendingRequestId !== null) await this.approvals.notifyRequested(done.value.pendingRequestId);
        return this.views.fresh(grant, loaded.value.version.id);
    }
}

/** POST /quotation-versions/:versionId/cancel — `quotations.manage`; a draft, or one waiting for approval (withdrawn). */
@Injectable()
export class CancelQuotationVersionUseCase {
    constructor(
        private readonly quotations: QuotationAccess,
        private readonly repo: QuotationRepository,
        private readonly approvals: Approvals,
        private readonly views: QuotationVersionViews,
        private readonly audit: AuditLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; versionId: string }): Promise<Result<QuotationVersionDto, DomainError>> {
        const loaded = await this.quotations.version(input.userId, input.versionId, ['quotations.manage'], true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<void, DomainError>> => {
            const q = await this.repo.lockQuotation(ws, loaded.value.quotation.id);
            const v = await this.repo.findVersion(loaded.value.version.id);
            if (q === undefined || v === undefined) return err(DomainError.notFound('QuotationVersion'));
            const allowed = requireStatus(v.status, ['draft', 'pending_approval']);
            if (!allowed.ok) return allowed;
            if (v.status === 'pending_approval') await this.approvals.cancel(ws, 'quotation.issue', v.id, input.userId);
            await this.repo.saveVersion({ ...v, status: 'cancelled', updatedAt: this.clock.now() });
            await this.audit.record({
                workspaceId: ws, projectId: v.projectId, actor: input.userId, entityType: 'quotation_version', entityId: v.id, action: 'cancel',
                data: { status: [v.status, 'cancelled'] },
            });
            return ok(undefined);
        });
        if (!done.ok) return done;
        return this.views.fresh(grant, loaded.value.version.id);
    }
}

/**
 * POST /quotation-versions/:versionId/record-response — `quotations.issue`; the customer's answer given outside the link
 * (issued versions only, `acceptedByName` required). Accept → project `won`, the other members notified.
 */
@Injectable()
export class RecordQuotationResponseUseCase {
    constructor(
        private readonly quotations: QuotationAccess,
        private readonly repo: QuotationRepository,
        private readonly workflow: QuotationWorkflow,
        private readonly views: QuotationVersionViews,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { userId: UserId; versionId: string; body: RecordQuotationResponseRequest }): Promise<Result<QuotationVersionDto, DomainError>> {
        const { userId, body } = input;
        const loaded = await this.quotations.version(userId, input.versionId, ['quotations.issue'], true);
        if (!loaded.ok) return loaded;
        const { grant } = loaded.value;
        const ws = grant.workspaceId;
        const done = await transact(this.uow, async (): Promise<Result<QuotationVersionRecord, DomainError>> => {
            const q = await this.repo.lockQuotation(ws, loaded.value.quotation.id);
            const v = await this.repo.findVersion(loaded.value.version.id);
            if (q === undefined || v === undefined) return err(DomainError.notFound('QuotationVersion'));
            return this.workflow.respondLocked(q, v, {
                action: body.action, name: body.acceptedByName, note: body.note, at: this.clock.now(), actor: userId, via: 'recorded',
            });
        });
        if (!done.ok) return done;
        const template = body.action === 'accept' ? 'quotation.accepted' : body.action === 'request_change' ? 'quotation.change_requested' : null;
        if (template !== null) {
            await this.workflow.notifyResponse({
                workspaceId: ws, projectId: done.value.projectId, versionId: done.value.id, template, note: body.note, exceptUserId: userId,
            });
        }
        return this.views.fresh(grant, done.value.id);
    }
}
