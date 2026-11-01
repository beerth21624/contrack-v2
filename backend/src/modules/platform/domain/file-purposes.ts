// ─── Which business module each upload purpose belongs to (an upload needs the platform to offer that module) ───
import type { FilePurpose, ModuleId } from '@contrack/contract';

/** A Record, so a new FilePurpose in the contract does not compile until it names its module. */
export const FILE_PURPOSE_MODULE: Readonly<Record<FilePurpose, ModuleId>> = {
    package_attachment: 'subcontracting',
    bid_photo: 'subcontracting',
    claim_photo: 'subcontracting',
    portfolio_photo: 'subcontracting',
    contract_scan: 'subcontracting',
    contract_pdf: 'subcontracting',
    company_logo: 'project-hub',
    company_stamp: 'project-hub',
    company_signature: 'project-hub',
    customer_document: 'project-hub',
    quotation_attachment: 'quotations',
    main_contract_scan: 'contracts',
    guarantee_scan: 'contracts',
    payment_slip: 'billing',
    customer_wht_certificate: 'billing',
    variation_evidence: 'variations',
    supplier_quote: 'procurement',
    delivery_note_photo: 'procurement',
    goods_photo: 'procurement',
    site_photo: 'site-diary',
    supplier_bill_scan: 'payables',
};
