// ─── The printed contract as plain data: the filled template (HTML) and the milestone annex ───
// Pure (no React). Text is picked in the contract's language; numbers and dates are formatted by the component.
import { type MainContractTemplateData, renderMainContract } from '@/domain/erp/main-contract-template';
import { sumMoney } from '@/domain/money';
import type { ContractMilestoneDto, DocLanguage, MainContractDto } from '@/shared/contract';
import type { PrintCompany, PrintCustomer } from '../quotations/print-model';

export interface ContractAnnexRow {
    no: string;
    label: string;
    kind: ContractMilestoneDto['kind'];
    trigger: ContractMilestoneDto['trigger'];
    triggerProgress: number | null;
    dueDate: string | null;
    pct: number;
    amount: number;
    source: ContractMilestoneDto['source'];
}

export interface ContractPrintModel {
    language: DocLanguage;
    number: string | null;
    watermark: 'draft' | 'void' | null;
    company: PrintCompany;
    customer: PrintCustomer | null;
    /** Sanitized HTML of the contract text, placeholders filled. */
    bodyHtml: string;
    annex: ContractAnnexRow[];
    annexTotal: number;
    vatRate: number;
    currentValue: number;
}

export function contractMilestoneLabel(m: Pick<ContractMilestoneDto, 'labelTh' | 'labelEn'>, language: DocLanguage): string {
    if (language === 'en') return m.labelEn !== '' ? m.labelEn : m.labelTh;
    return m.labelTh !== '' ? m.labelTh : m.labelEn;
}

export function buildContractPrintModel(input: {
    contract: MainContractDto;
    company: PrintCompany;
    customer: PrintCustomer | null;
    projectName: string;
    siteAddress: string;
}): ContractPrintModel {
    const { contract: c, company, customer } = input;
    const language = c.language;
    const milestones = [...c.milestones].sort((a, b) => a.no - b.no);
    const data: MainContractTemplateData = {
        language,
        contractNo: c.number ?? '',
        signDate: c.signDate,
        companyName: company.name,
        customerName: customer?.name ?? '',
        projectName: input.projectName,
        siteAddress: input.siteAddress,
        title: c.title,
        // The text states the contract price as agreed at signing; variations are on their own documents.
        value: c.originalValue,
        vatRate: c.vatRate,
        startDate: c.startDate,
        finishDate: c.finishDate,
        durationDays: c.durationDays,
        milestones: milestones.filter(m => m.source === 'contract').map(m => ({
            no: m.no, label: contractMilestoneLabel(m, language), kind: m.kind, pct: m.pct, amount: m.amount,
        })),
        advancePct: c.terms.advancePct,
        retentionPct: c.terms.retentionPct,
        penaltyRatePerDay: c.terms.penaltyRatePerDay,
        penaltyCapPct: c.terms.penaltyCapPct,
        warrantyMonths: c.terms.warrantyMonths,
        guaranteePct: c.terms.guaranteePct,
        paymentTermDays: c.terms.paymentTermDays,
    };
    const body = language === 'en' ? c.bodyEn : c.bodyTh;
    const annex: ContractAnnexRow[] = milestones.map(m => ({
        no: m.kind === 'advance' ? '-' : String(m.no),
        label: contractMilestoneLabel(m, language),
        kind: m.kind, trigger: m.trigger, triggerProgress: m.triggerProgress, dueDate: m.dueDate, pct: m.pct, amount: m.amount, source: m.source,
    }));
    const watermark = c.status === 'draft' ? 'draft' : c.status === 'cancelled' || c.status === 'terminated' ? 'void' : null;
    return {
        language, number: c.number, watermark, company, customer, bodyHtml: renderMainContract(body, data), annex,
        // Work and final milestones add up to the contract value; the advance is paid against them.
        annexTotal: sumMoney(milestones.filter(m => m.kind !== 'advance').map(m => m.amount)),
        vatRate: c.vatRate, currentValue: c.currentValue,
    };
}
