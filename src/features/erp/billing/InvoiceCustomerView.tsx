'use client';

// ─── The invoice on the customer link page (/c/[token]): the document, the PromptPay QR and the bank accounts ───
// Registered as the renderer of subject `invoice` (view only: there is no answer form).
import { useMemo } from 'react';
import { Alert } from 'antd';
import { invoiceLinkPayloadSchema } from '@/shared/contract';
import { registerCustomerLinkRenderer, type CustomerLinkRendererProps } from '../customer-links/renderers';
import { companyFromSnapshot, customerFromSnapshot, type PrintCompany } from '../quotations/print-model';
import { InvoicePrintDocument } from './InvoicePrintDocument';
import { buildInvoicePrintModel } from './print-model';

function InvoiceCustomerView({ view, t }: CustomerLinkRendererProps<'invoice'>) {
    const parsed = useMemo(() => {
        const p = invoiceLinkPayloadSchema.safeParse(view.payload);
        if (!p.success) return null;
        const { invoice, projectName, bankAccounts, outstanding, promptpay } = p.data;
        const base: PrintCompany = invoice.companySnapshot !== null
            ? companyFromSnapshot(invoice.companySnapshot)
            : {
                name: view.companyName, taxId: '', branchCode: '', branchName: '', address: '', phone: '', email: '', website: '',
                brandColor: '#F97316', logoUrl: null, stampUrl: null, signatureUrl: null, bankAccounts: [], promptpayId: '', footer: '', yearStyle: 'ce',
            };
        const company: PrintCompany = bankAccounts.length > 0 ? { ...base, bankAccounts } : base;
        const customer = invoice.customerSnapshot !== null ? customerFromSnapshot(invoice.customerSnapshot) : null;
        // The link page shows its own status; the paper watermark is not needed here.
        const model = { ...buildInvoicePrintModel({ invoice, company, customer, projectName }), watermark: null, outstanding };
        return { model, pay: promptpay === null ? null : { payload: promptpay.payload, amount: promptpay.amount } };
    }, [view.payload, view.companyName]);

    if (parsed === null) return <Alert type="warning" showIcon title={t('noRenderer')} />;
    return (
        <div style={{ overflowX: 'auto' }}>
            <InvoicePrintDocument model={parsed.model} pay={parsed.pay} />
        </div>
    );
}

registerCustomerLinkRenderer('invoice', InvoiceCustomerView);

export { InvoiceCustomerView };
