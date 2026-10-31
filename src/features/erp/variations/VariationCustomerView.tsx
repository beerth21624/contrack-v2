'use client';

// ─── The VO on the customer link page (/c/[token]): the document with its evidence, no cost fields, no sign-in ───
// Registered as the renderer of subject `variation`; the answer form (accept / reject) is the page's.
import { useMemo } from 'react';
import { Alert } from 'antd';
import { variationLinkPayloadSchema } from '@/shared/contract';
import { registerCustomerLinkRenderer, type CustomerLinkRendererProps } from '../customer-links/renderers';
import { customerFromSnapshot, type PrintCompany } from '../quotations/print-model';
import { buildVariationPrintModel } from './print-model';
import { VariationPrintDocument } from './VariationPrintDocument';

function VariationCustomerView({ view, t }: CustomerLinkRendererProps<'variation'>) {
    const model = useMemo(() => {
        const parsed = variationLinkPayloadSchema.safeParse(view.payload);
        if (!parsed.success) return null;
        const { variation, projectName, contractNumber } = parsed.data;
        const company: PrintCompany = {
            name: view.companyName, taxId: '', branchCode: '', branchName: '', address: '', phone: '', email: '', website: '',
            brandColor: '#F97316', logoUrl: null, stampUrl: null, signatureUrl: null, bankAccounts: [], promptpayId: '', footer: '', yearStyle: 'ce',
        };
        const customer = variation.customerSnapshot !== null ? customerFromSnapshot(variation.customerSnapshot) : null;
        // The link page shows its own status and answer form: no watermark, no signature lines.
        return { ...buildVariationPrintModel({ variation, company, customer, projectName, contractNumber }), watermark: null };
    }, [view.payload, view.companyName]);

    if (model === null) return <Alert type="warning" showIcon title={t('noRenderer')} />;
    return (
        <div style={{ overflowX: 'auto' }}>
            <VariationPrintDocument model={model} showSign={false} />
        </div>
    );
}

registerCustomerLinkRenderer('variation', VariationCustomerView);

export { VariationCustomerView };
