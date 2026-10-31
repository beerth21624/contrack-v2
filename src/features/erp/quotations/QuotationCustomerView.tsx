'use client';

// ─── The quotation on the customer link page (/c/[token]): the document, no cost fields, no sign-in ───
// Registered as the renderer of subject `quotation`; the answer form (accept / request change / reject) is the page's.
import { useMemo } from 'react';
import { Alert } from 'antd';
import { quotationLinkPayloadSchema } from '@/shared/contract';
import { registerCustomerLinkRenderer, type CustomerLinkRendererProps } from '../customer-links/renderers';
import { QuotationPrintDocument } from './QuotationPrintDocument';
import { buildQuotationPrintModel, companyFromSnapshot, customerFromSnapshot, type PrintCompany } from './print-model';

function QuotationCustomerView({ view, t }: CustomerLinkRendererProps<'quotation'>) {
    const model = useMemo(() => {
        const parsed = quotationLinkPayloadSchema.safeParse(view.payload);
        if (!parsed.success) return null;
        const { version, projectName } = parsed.data;
        const company: PrintCompany = version.companySnapshot !== null
            ? companyFromSnapshot(version.companySnapshot)
            : {
                name: view.companyName, taxId: '', branchCode: '', branchName: '', address: '', phone: '', email: '', website: '',
                brandColor: '#F97316', logoUrl: null, stampUrl: null, signatureUrl: null, bankAccounts: [], promptpayId: '', footer: '', yearStyle: 'ce',
            };
        const customer = version.customerSnapshot !== null ? customerFromSnapshot(version.customerSnapshot) : null;
        // The link page shows its own status; the paper watermark is not needed here.
        return { ...buildQuotationPrintModel({ version, company, customer, projectName }), watermark: null };
    }, [view.payload, view.companyName]);

    if (model === null) return <Alert type="warning" showIcon title={t('noRenderer')} />;
    return (
        <div style={{ overflowX: 'auto' }}>
            <QuotationPrintDocument model={model} />
        </div>
    );
}

registerCustomerLinkRenderer('quotation', QuotationCustomerView);

export { QuotationCustomerView };
