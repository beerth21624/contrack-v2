import { CUSTOMER_KIND_WHT_RATE } from '@contrack/contract';
import type { Customer, CustomerSnapshot } from '../../../shared/application/ports';

/** The withholding rate in force: the customer's own, else the rate of its kind. */
export const effectiveWhtRate = (c: Pick<Customer, 'kind' | 'defaultWhtRate'>): number => c.defaultWhtRate ?? CUSTOMER_KIND_WHT_RATE[c.kind];

/** Case-insensitive match on names, tax id, contact, phone, email and LINE id. */
export function matchesCustomerQuery(c: Customer, q: string): boolean {
    const needle = q.trim().toLowerCase();
    return [c.nameTh, c.nameEn, c.taxId, c.contactName, c.phone, c.email, c.lineId].some(v => v.toLowerCase().includes(needle));
}

/** Buyer block for a document in `language`; an empty name/address falls back to the other language. */
export function customerSnapshot(c: Customer, language: 'th' | 'en'): CustomerSnapshot {
    const pick = (th: string, en: string) => (language === 'en' ? (en || th) : (th || en));
    return {
        id: c.id,
        kind: c.kind,
        name: pick(c.nameTh, c.nameEn),
        taxId: c.taxId,
        branchCode: c.branchCode,
        address: pick(c.addressTh, c.addressEn),
        contactName: c.contactName,
        phone: c.phone,
        email: c.email,
        whtRate: effectiveWhtRate(c),
        paymentTermDays: c.paymentTermDays,
        language,
    };
}
