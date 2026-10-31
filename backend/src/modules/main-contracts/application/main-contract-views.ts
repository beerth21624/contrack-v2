// ─── Main contract records → DTOs (files described fresh, milestone statuses computed on read) ───
import { Injectable } from '@nestjs/common';
import type {
    ContractGuaranteeDto, ContractMilestoneDto, MainContractDto, MainContractSummaryDto, ProjectMainContractDto,
} from '@contrack/contract';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import type { ProjectGrant } from '../../../shared/application/module-access';
import { Clock, CostCodeLookup, FileService } from '../../../shared/application/ports';
import { can } from '../../../shared/domain/permissions';
import { effectiveMilestoneStatus, weightedProgress } from '../domain/main-contract-rules';
import { SIGNED_STATUSES } from '../domain/main-contract-state';
import {
    type GuaranteeRecord, MainContractRepository, type MainContractRecord, type MilestoneRecord,
} from './ports/main-contract.repository';

export const summaryDto = (c: MainContractRecord): MainContractSummaryDto => ({
    id: c.id, number: c.number, status: c.status, title: c.title, originalValue: c.originalValue, currentValue: c.currentValue,
    signDate: c.signDate, updatedAt: c.updatedAt.toISOString(),
});

@Injectable()
export class MainContractViews {
    constructor(
        private readonly repo: MainContractRepository,
        private readonly files: FileService,
        private readonly costCodes: CostCodeLookup,
        private readonly clock: Clock,
    ) {}

    async contract(grant: ProjectGrant, c: MainContractRecord): Promise<MainContractDto> {
        const milestones = await this.repo.milestonesOf(c.workspaceId, [c.id]);
        const progress = SIGNED_STATUSES.includes(c.status)
            ? weightedProgress(await this.costCodes.listByProject(c.workspaceId, c.projectId))
            : null;
        const today = bangkokToday(this.clock.now());
        const ctx = { contractStatus: c.status, today, progress };
        const base: MainContractDto = {
            id: c.id, projectId: c.projectId, customerId: c.customerId, quotationId: c.quotationId, quotationVersionId: c.quotationVersionId,
            number: c.number, status: c.status, title: c.title, language: c.language, signDate: c.signDate, startDate: c.startDate,
            finishDate: c.finishDate, durationDays: c.durationDays, billingMode: c.billingMode, originalValue: c.originalValue,
            currentValue: c.currentValue, vatRate: c.vatRate, extensionDays: c.extensionDays, terms: c.terms, bodyTh: c.bodyTh, bodyEn: c.bodyEn,
            customerSnapshot: c.customerSnapshot, companySnapshot: c.companySnapshot,
            signedScans: c.signedScanFileIds.length === 0 ? [] : await this.files.describe(c.signedScanFileIds),
            completedAt: c.completedAt, closedAt: c.closedAt, terminatedAt: c.terminatedAt, terminationReason: c.terminationReason,
            progress,
            milestones: milestones.map(m => milestoneDto(m, effectiveMilestoneStatus(m, ctx))),
            canEdit: c.status === 'draft' && can(grant.role, 'contracts.manage') && !grant.archived,
            createdBy: c.createdBy, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
        };
        return can(grant.role, 'quotations.seeMargins') ? { ...base, quotedMarginPct: c.quotedMarginPct } : base;
    }

    async project(grant: ProjectGrant, contracts: readonly MainContractRecord[]): Promise<ProjectMainContractDto> {
        const effective = contracts.find(c => c.status !== 'cancelled' && c.status !== 'terminated');
        return {
            contract: effective === undefined ? null : await this.contract(grant, effective),
            ended: contracts.filter(c => c !== effective).map(summaryDto),
        };
    }

    async guarantees(list: readonly GuaranteeRecord[]): Promise<ContractGuaranteeDto[]> {
        const ids = [...new Set(list.flatMap(g => g.fileIds))];
        const described = ids.length === 0 ? [] : await this.files.describe(ids);
        const byId = new Map(described.map(f => [f.id, f]));
        return list.map(g => ({
            id: g.id, contractId: g.contractId, projectId: g.projectId, kind: g.kind, form: g.form, issuer: g.issuer, refNo: g.refNo,
            amount: g.amount, issueDate: g.issueDate, expiryDate: g.expiryDate, status: g.status, returnedAt: g.returnedAt,
            files: g.fileIds.flatMap(id => { const f = byId.get(id); return f === undefined ? [] : [f]; }),
            note: g.note, createdAt: g.createdAt.toISOString(), updatedAt: g.updatedAt.toISOString(),
        }));
    }
}

function milestoneDto(m: MilestoneRecord, status: ContractMilestoneDto['status']): ContractMilestoneDto {
    return {
        id: m.id, no: m.no, labelTh: m.labelTh, labelEn: m.labelEn, kind: m.kind, pct: m.pct, amount: m.amount, trigger: m.trigger,
        triggerProgress: m.triggerProgress, dueDate: m.dueDate, costCodeIds: [...m.costCodeIds], status, source: m.source,
        variationId: m.variationId,
    };
}
