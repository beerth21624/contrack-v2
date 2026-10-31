'use client';
/* eslint-disable @next/next/no-img-element -- signed file urls of the company, printed as plain images */

// ─── Pieces shared by the billing paper documents: style, letterhead, party box, signature block ───
import type { ReactNode } from 'react';
import { formatDocumentDate } from '@/i18n/format';
import type { DocumentTranslator } from '@/i18n/document-translator';
import type { DocLanguage } from '@/shared/contract';
import type { PrintCompany, PrintCustomer } from '../quotations/print-model';

export const DOC_CSS = `
.bpd { color: #000; font-size: 10.5pt; line-height: 1.4; }
.bpd table { width: 100%; border-collapse: collapse; }
.bpd th, .bpd td { padding: 3px 6px; vertical-align: top; }
.bpd .bpd-grid th, .bpd .bpd-grid td { border: 1px solid #9ca3af; }
.bpd .bpd-grid th { background: var(--bpd-soft, #f3f4f6); text-align: center; font-weight: 600; }
.bpd .num { text-align: right; white-space: nowrap; }
.bpd .ctr { text-align: center; }
.bpd .bpd-head { display: flex; gap: 16px; justify-content: space-between; align-items: flex-start; }
.bpd .bpd-logo { max-height: 64px; max-width: 160px; object-fit: contain; }
.bpd .bpd-title { font-size: 18pt; font-weight: 700; color: var(--bpd-brand); line-height: 1.2; }
.bpd .bpd-meta td { padding: 1px 0 1px 8px; }
.bpd .bpd-box { border: 1px solid #d1d5db; border-radius: 4px; padding: 8px 10px; }
.bpd .bpd-pre { white-space: pre-wrap; overflow-wrap: anywhere; }
.bpd .bpd-h { font-weight: 600; margin: 12px 0 4px; }
.bpd .bpd-strong td { font-weight: 700; background: var(--bpd-soft, #f3f4f6); }
.bpd .bpd-sign { display: flex; gap: 24px; margin-top: 28px; break-inside: avoid; }
.bpd .bpd-sign > div { flex: 1 1 0; text-align: center; min-width: 0; }
.bpd .bpd-sign img { max-height: 56px; max-width: 100%; object-fit: contain; }
.bpd .bpd-line { border-bottom: 1px solid #000; height: 48px; margin-bottom: 4px; display: flex; align-items: flex-end; justify-content: center; gap: 8px; }
.bpd .bpd-pay { display: flex; gap: 16px; align-items: center; break-inside: avoid; }
.bpd .bpd-scroll { overflow-x: auto; }
.bpd tr { break-inside: avoid; }
@media screen and (max-width: 600px) {
  .bpd { font-size: 10pt; }
  .bpd .bpd-head { flex-direction: column; }
  .bpd .bpd-sign { flex-direction: column; }
  .bpd th, .bpd td { padding: 3px 4px; }
}
`;

/** `#RRGGBB` at 12 % over white, for table heads. */
export function soft(brand: string): string {
    const n = Number.parseInt(brand.slice(1), 16);
    const mix = (c: number): number => Math.round(c * 0.12 + 255 * 0.88);
    return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

export const brandVars = (brand: string): Record<string, string> => ({ ['--bpd-brand']: brand, ['--bpd-soft']: soft(brand) });

export function branchText(c: { branchCode: string; branchName?: string }, t: DocumentTranslator): string {
    if (c.branchCode === '00000' || c.branchCode === '') return t('common.headOffice');
    return `${t('common.branch')} ${c.branchName !== undefined && c.branchName !== '' ? c.branchName : c.branchCode}`;
}

/** Logo, company name / address / tax id on the left; title and number / date rows on the right. */
export function Letterhead({ company, title, rows, t }: {
    company: PrintCompany;
    title: string;
    rows: ReactNode;
    t: DocumentTranslator;
}) {
    const c = company;
    return (
        <div className="bpd-head">
            <div className="flex min-w-0 gap-3" style={{ fontSize: '10pt' }}>
                {c.logoUrl !== null && <img className="bpd-logo" src={c.logoUrl} alt="" />}
                <div className="min-w-0">
                    <div style={{ fontWeight: 700, fontSize: '12pt' }}>{c.name}</div>
                    {c.address !== '' && <div className="bpd-pre">{c.address}</div>}
                    {(c.phone !== '' || c.email !== '') && <div>{[c.phone, c.email].filter(x => x !== '').join(' · ')}</div>}
                    {c.taxId !== '' && <div>{t('common.taxId')} {c.taxId} ({branchText(c, t)})</div>}
                </div>
            </div>
            <div style={{ textAlign: 'right' }}>
                <div className="bpd-title">{title}</div>
                <table className="bpd-meta" style={{ width: 'auto', marginLeft: 'auto' }}><tbody>{rows}</tbody></table>
            </div>
        </div>
    );
}

export function MetaRow({ label, children }: { label: string; children: ReactNode }) {
    return <tr><td>{label}</td><td>{children}</td></tr>;
}

export function PartyBox({ label, customer, t, extra }: { label: string; customer: PrintCustomer | null; t: DocumentTranslator; extra?: ReactNode }) {
    return (
        <div className="bpd-box" style={{ marginTop: 12 }}>
            {customer !== null && (
                <div>
                    <b>{label}</b> {customer.name}
                    {customer.address !== '' && <div className="bpd-pre">{customer.address}</div>}
                    {customer.taxId !== '' && <div>{t('common.taxId')} {customer.taxId} ({branchText(customer, t)})</div>}
                </div>
            )}
            {extra}
        </div>
    );
}

export function SignBlock({ left, company, rightLabel, t }: { left: string; company: PrintCompany; rightLabel: string; t: DocumentTranslator }) {
    return (
        <div className="bpd-sign">
            <div>
                <div className="bpd-line" />
                <div>{left}</div>
                <div>{t('common.date')} ______ / ______ / ______</div>
            </div>
            <div>
                <div className="bpd-line">
                    {company.signatureUrl !== null && <img src={company.signatureUrl} alt="" style={{ maxHeight: 44 }} />}
                    {company.stampUrl !== null && <img src={company.stampUrl} alt="" style={{ maxHeight: 44 }} />}
                </div>
                <div>{rightLabel}</div>
                <div>{company.name}</div>
            </div>
        </div>
    );
}

export const dateText = (value: string, language: DocLanguage, yearStyle: 'ce' | 'be'): string => formatDocumentDate(value, language, yearStyle);

export function Footer({ text }: { text: string }) {
    if (text.trim() === '') return null;
    return <div className="bpd-pre" style={{ marginTop: 12, textAlign: 'center', fontSize: '9pt', color: '#4b5563' }}>{text}</div>;
}
