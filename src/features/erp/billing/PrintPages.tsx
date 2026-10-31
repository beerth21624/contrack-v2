'use client';

// ─── /print/invoice|receipt|claim/[id]: billing documents on paper (issued: snapshots; draft: live company / customer) ───
import { useMemo, type ReactNode } from 'react';
import { Alert, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import type { DocLanguage, QuotationCompanySnapshot, QuotationCustomerSnapshot } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useCompanyProfile } from '../company/hooks';
import { useContract } from '../contracts/hooks';
import { useCustomer } from '../customers/hooks';
import { useHubProject } from '../hub/hooks';
import {
    companyFromProfile, companyFromSnapshot, customerFromDto, customerFromSnapshot, type PrintCompany, type PrintCustomer,
} from '../quotations/print-model';
import { PrintFrame } from '../shared/PrintFrame';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { useClaim, useInvoice, useInvoicePromptPay, useReceipt } from './hooks';
import { ClaimCertificateDocument } from './ClaimCertificateDocument';
import { InvoicePrintDocument } from './InvoicePrintDocument';
import { ReceiptPrintDocument } from './ReceiptPrintDocument';
import { TaxInvoicePrintDocument } from './TaxInvoicePrintDocument';
import { buildClaimPrintModel, buildInvoicePrintModel, buildReceiptPrintModel } from './print-model';

/** The company / customer of a document: its snapshots once issued, the live records before (null while loading). */
function useParties(args: {
    projectId: string | null | undefined;
    language: DocLanguage | undefined;
    companySnapshot: QuotationCompanySnapshot | null | undefined;
    customerSnapshot: QuotationCustomerSnapshot | null | undefined;
    customerId: string | undefined;
}) {
    const hub = useHubProject(args.projectId ?? undefined);
    const erpWs = useErpWorkspace();
    const workspaceId = hub.data?.project.workspaceId ?? (args.projectId == null ? erpWs.workspaceId : undefined);
    const company = useCompanyProfile(workspaceId);
    const customer = useCustomer(args.customerSnapshot === null ? args.customerId : undefined);
    const { language, companySnapshot, customerSnapshot } = args;
    const parties = useMemo(() => {
        if (language === undefined) return null;
        // Images are the company's current files (a snapshot keeps only their ids).
        const images = {
            logoUrl: company.data?.logo?.url ?? null,
            stampUrl: company.data?.stamp?.url ?? null,
            signatureUrl: company.data?.signature?.url ?? null,
        };
        let co: PrintCompany | null = null;
        if (companySnapshot != null) co = companyFromSnapshot(companySnapshot, images);
        else if (company.data !== undefined) co = companyFromProfile(company.data, language);
        if (co === null) return null;
        let cu: PrintCustomer | null = null;
        if (customerSnapshot != null) cu = customerFromSnapshot(customerSnapshot);
        else if (customer.data !== undefined) cu = customerFromDto(customer.data, language);
        return { company: co, customer: cu };
    }, [language, companySnapshot, customerSnapshot, company.data, customer.data]);
    const error: unknown = hub.isError ? hub.error : company.isError ? company.error : null;
    return { parties, error, projectName: hub.data?.project.name ?? null, projectLoading: args.projectId != null && hub.data === undefined && !hub.isError };
}

function Wait({ error, children }: { error: unknown; children?: ReactNode }) {
    const t = useTranslations('billing');
    const toText = useErrorMessage();
    if (error !== null && error !== undefined) {
        return <div className="p-4"><Alert type="error" showIcon title={t('loadFailed')} description={toText(error)} /></div>;
    }
    return <div className="p-6">{children ?? <Skeleton active />}</div>;
}

export function InvoicePrintPage({ invoiceId }: { invoiceId: string }) {
    const invoice = useInvoice(invoiceId);
    const inv = invoice.data;
    const related = useInvoice(inv?.relatedInvoiceId ?? undefined);
    const { parties, error, projectName, projectLoading } = useParties({
        projectId: inv?.projectId, language: inv?.language, companySnapshot: inv?.companySnapshot,
        customerSnapshot: inv?.customerSnapshot, customerId: inv?.customerId,
    });
    const wantsQr = inv !== undefined && (inv.kind === 'invoice' || inv.kind === 'advance_invoice') && (inv.status === 'issued' || inv.status === 'partially_paid');
    const promptpay = useInvoicePromptPay(invoiceId, wantsQr);
    const model = useMemo(() => {
        if (inv === undefined || parties === null) return null;
        return buildInvoicePrintModel({
            invoice: inv, company: parties.company, customer: parties.customer, projectName, relatedNumber: related.data?.number ?? null,
        });
    }, [inv, parties, projectName, related.data]);

    if (invoice.isError) return <Wait error={invoice.error} />;
    const qrPending = wantsQr && promptpay.isLoading;
    if (model === null || inv === undefined || projectLoading || qrPending || (inv.relatedInvoiceId !== null && related.isLoading)) return <Wait error={error} />;
    const tax = model.kind === 'taxInvoice' || model.kind === 'creditNote';
    return (
        <PrintFrame language={inv.language} watermark={model.watermark} title={inv.number ?? undefined} ready>
            {tax
                ? <TaxInvoicePrintDocument model={model} />
                : <InvoicePrintDocument model={model} pay={promptpay.data === undefined ? null : { payload: promptpay.data.payload, amount: promptpay.data.amount }} />}
        </PrintFrame>
    );
}

export function ReceiptPrintPage({ receiptId }: { receiptId: string }) {
    const receipt = useReceipt(receiptId);
    const r = receipt.data;
    const { parties, error } = useParties({
        projectId: r?.projectId, language: r?.language, companySnapshot: r?.companySnapshot,
        customerSnapshot: r?.customerSnapshot, customerId: r?.customerId,
    });
    const model = useMemo(() => (r === undefined || parties === null ? null : buildReceiptPrintModel({ receipt: r, company: parties.company, customer: parties.customer })), [r, parties]);
    if (receipt.isError) return <Wait error={receipt.error} />;
    if (model === null || r === undefined) return <Wait error={error} />;
    const vatRate = r.companySnapshot?.vatRate ?? null;
    return (
        <PrintFrame language={r.language} watermark={model.watermark} title={r.number} ready>
            <ReceiptPrintDocument model={model} vatRate={vatRate} />
        </PrintFrame>
    );
}

export function ClaimPrintPage({ claimId }: { claimId: string }) {
    const claim = useClaim(claimId);
    const c = claim.data;
    const contract = useContract(c?.contractId);
    const k = contract.data;
    const { parties, error, projectName, projectLoading } = useParties({
        projectId: c?.projectId, language: k?.language, companySnapshot: k?.companySnapshot,
        customerSnapshot: k?.customerSnapshot, customerId: k?.customerId,
    });
    const model = useMemo(() => {
        if (c === undefined || k === undefined || parties === null || projectName === null) return null;
        return buildClaimPrintModel({ claim: c, contract: k, company: parties.company, customer: parties.customer, projectName });
    }, [c, k, parties, projectName]);
    if (claim.isError) return <Wait error={claim.error} />;
    if (contract.isError) return <Wait error={contract.error} />;
    if (model === null || k === undefined || projectLoading) return <Wait error={error} />;
    return (
        <PrintFrame language={k.language} watermark={model.watermark} title={`${k.number ?? k.title} #${model.claimNo}`} ready>
            <ClaimCertificateDocument model={model} />
        </PrintFrame>
    );
}
