'use client';
/* eslint-disable @next/next/no-img-element -- signed file urls of the company, printed as plain images */

// ─── The quotation sheet: shared by the print page (inside PrintFrame) and the customer link page ───
// Text, numbers and dates follow the document's language (model.language), never the UI locale.
import { useMemo, type ReactNode } from 'react';
import { amountInWords, formatDocumentDate, formatMoney, formatPercent, formatQty } from '@/i18n/format';
import { documentTranslator, type DocumentTranslator } from '@/i18n/document-translator';
import { GovernmentForms } from './GovernmentForms';
import type { QuotationPrintModel, StandardMode } from './print-model';

const CSS = `
.qtd { color: #000; font-size: 10.5pt; line-height: 1.4; }
.qtd table { width: 100%; border-collapse: collapse; }
.qtd th, .qtd td { padding: 3px 6px; vertical-align: top; }
.qtd .qtd-grid th, .qtd .qtd-grid td { border: 1px solid #9ca3af; }
.qtd .qtd-grid th { background: var(--qtd-brand-soft, #f3f4f6); text-align: center; font-weight: 600; }
.qtd .num { text-align: right; white-space: nowrap; }
.qtd .ctr { text-align: center; }
.qtd .qtd-head { display: flex; gap: 16px; justify-content: space-between; align-items: flex-start; }
.qtd .qtd-logo { max-height: 64px; max-width: 160px; object-fit: contain; }
.qtd .qtd-company { font-size: 10pt; }
.qtd .qtd-title { font-size: 18pt; font-weight: 700; color: var(--qtd-brand); line-height: 1.2; }
.qtd .qtd-meta td { padding: 1px 0 1px 8px; }
.qtd .qtd-box { border: 1px solid #d1d5db; border-radius: 4px; padding: 8px 10px; }
.qtd .qtd-section td { background: #f9fafb; font-weight: 600; }
.qtd .qtd-sub td { font-weight: 600; border-top: 1px solid #9ca3af; }
.qtd .qtd-note td { font-style: italic; color: #4b5563; }
.qtd .qtd-h { font-weight: 600; margin: 12px 0 4px; }
.qtd .qtd-pre { white-space: pre-wrap; overflow-wrap: anywhere; }
.qtd .qtd-grand td { font-weight: 700; background: var(--qtd-brand-soft, #f3f4f6); }
.qtd .qtd-sign { display: flex; gap: 24px; margin-top: 28px; break-inside: avoid; }
.qtd .qtd-sign > div { flex: 1 1 0; text-align: center; min-width: 0; }
.qtd .qtd-sign img { max-height: 56px; max-width: 100%; object-fit: contain; }
.qtd .qtd-show-sm { display: none; font-size: 9pt; color: #4b5563; }
.qtd .qtd-line { border-bottom: 1px solid #000; height: 48px; margin-bottom: 4px; }
.qtd .qtd-form { break-before: page; }
.qtd .qtd-form:first-of-type { break-before: auto; }
.qtd tr { break-inside: avoid; }
.qtd-scroll { overflow-x: auto; }
@media screen and (max-width: 600px) {
  .qtd { font-size: 10pt; }
  .qtd .qtd-head { flex-direction: column; }
  .qtd .qtd-hide-sm { display: none; }
  .qtd .qtd-show-sm { display: block; }
  .qtd th, .qtd td { padding: 3px 4px; }
  .qtd .qtd-sign { flex-direction: column; }
}
`;

/** `#RRGGBB` at 12 % over white, for table heads. */
function soft(brand: string): string {
    const n = Number.parseInt(brand.slice(1), 16);
    const mix = (c: number): number => Math.round(c * 0.12 + 255 * 0.88);
    return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

function Header({ m, t }: { m: QuotationPrintModel; t: DocumentTranslator }) {
    const c = m.company;
    const lang = m.language;
    const branch = c.branchCode === '00000' || c.branchCode === '' ? t('common.headOffice') : `${t('common.branch')} ${c.branchName !== '' ? c.branchName : c.branchCode}`;
    return (
        <>
            <div className="qtd-head">
                <div className="qtd-company flex min-w-0 gap-3">
                    {c.logoUrl !== null && <img className="qtd-logo" src={c.logoUrl} alt="" />}
                    <div className="min-w-0">
                        <div style={{ fontWeight: 700, fontSize: '12pt' }}>{c.name}</div>
                        {c.address !== '' && <div className="qtd-pre">{c.address}</div>}
                        {(c.phone !== '' || c.email !== '') && <div>{[c.phone, c.email].filter(x => x !== '').join(' · ')}</div>}
                        {c.website !== '' && <div>{c.website}</div>}
                        {c.taxId !== '' && <div>{t('common.taxId')} {c.taxId} ({branch})</div>}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div className="qtd-title">{t('quotation.title')}</div>
                    <table className="qtd-meta" style={{ width: 'auto', marginLeft: 'auto' }}>
                        <tbody>
                            <tr><td>{t('common.number')}</td><td>{m.number ?? t('quotation.draftNote')}</td></tr>
                            {m.issueDate !== null && <tr><td>{t('common.date')}</td><td>{formatDocumentDate(m.issueDate, lang, c.yearStyle)}</td></tr>}
                            {m.validUntil !== null && <tr><td>{t('quotation.validUntil')}</td><td>{formatDocumentDate(m.validUntil, lang, c.yearStyle)}</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="qtd-box" style={{ marginTop: 12 }}>
                {m.customer !== null && (
                    <div>
                        <b>{t('quotation.to')}</b> {m.customer.name}
                        {m.customer.address !== '' && <div className="qtd-pre">{m.customer.address}</div>}
                        {m.customer.taxId !== '' && <div>{t('common.taxId')} {m.customer.taxId}</div>}
                        {m.customer.contactName !== '' && <div>{t('quotation.attention')} {m.customer.contactName}{m.customer.phone !== '' ? ` · ${m.customer.phone}` : ''}</div>}
                    </div>
                )}
                {(m.title !== '' || m.projectName !== null) && (
                    <div style={{ marginTop: m.customer !== null ? 6 : 0 }}>
                        <b>{t('quotation.project')}</b> {m.projectName ?? m.title}
                        {m.projectName !== null && m.title !== '' && m.title !== m.projectName ? ` (${m.title})` : ''}
                    </div>
                )}
            </div>
        </>
    );
}

function StandardTable({ m, t }: { m: QuotationPrintModel; t: DocumentTranslator }) {
    const lang = m.language;
    const mode: StandardMode = m.mode;
    const money = (v: number): string => formatMoney(v, lang);
    const lines = mode === 'lines' || mode === 'split';
    const span = mode === 'split' ? 7 : mode === 'lines' ? 6 : 3;
    return (
        <div className="qtd-scroll" style={{ marginTop: 12 }}>
            <table className="qtd-grid">
                <thead>
                    <tr>
                        <th style={{ width: 44 }}>{t('quotation.no')}</th>
                        <th>{t('quotation.description')}</th>
                        {lines && <th className="qtd-hide-sm" style={{ width: 62 }}>{t('quotation.qty')}</th>}
                        {lines && <th className="qtd-hide-sm" style={{ width: 52 }}>{t('quotation.unit')}</th>}
                        {mode === 'split' && <th className="qtd-hide-sm" style={{ width: 82 }}>{t('quotation.material')}</th>}
                        {mode === 'split' && <th className="qtd-hide-sm" style={{ width: 82 }}>{t('quotation.labour')}</th>}
                        {mode === 'lines' && <th className="qtd-hide-sm" style={{ width: 88 }}>{t('quotation.unitPrice')}</th>}
                        <th style={{ width: 96 }}>{t('quotation.amount')}</th>
                    </tr>
                </thead>
                <tbody>
                    {m.rows.map((r, i) => {
                        switch (r.kind) {
                            case 'lump':
                                return (
                                    <tr key={i}>
                                        <td className="ctr">{r.no}</td>
                                        <td>{m.title !== '' ? m.title : t('quotation.workTotal')}</td>
                                        <td className="num">{money(r.amount)}</td>
                                    </tr>
                                );
                            case 'section':
                                return (
                                    <tr key={i} className={r.amount === null ? 'qtd-section' : undefined}>
                                        <td className="ctr">{r.no}</td>
                                        <td colSpan={r.amount === null ? span - 2 : 1}>{r.text}</td>
                                        {r.amount !== null && <td className="num">{money(r.amount)}</td>}
                                        {r.amount === null && <td className="num" />}
                                    </tr>
                                );
                            case 'note':
                                return <tr key={i} className="qtd-note"><td /><td colSpan={span - 1}>{r.text}</td></tr>;
                            case 'subtotal':
                                return (
                                    <tr key={i} className="qtd-sub">
                                        <td />
                                        <td colSpan={span - 2} className="num">{t('quotation.sectionTotal', { title: r.text })}</td>
                                        <td className="num">{money(r.amountOf)}</td>
                                    </tr>
                                );
                            default:
                                return (
                                    <tr key={i}>
                                        <td className="ctr">{r.no}</td>
                                        <td>
                                            {r.text}
                                            <div className="qtd-show-sm">
                                                {formatQty(r.qty, lang)} {r.unit} × {money(mode === 'split' ? r.matUnit + r.labUnit : r.unitPrice)}
                                            </div>
                                        </td>
                                        <td className="qtd-hide-sm num">{formatQty(r.qty, lang)}</td>
                                        <td className="qtd-hide-sm ctr">{r.unit}</td>
                                        {mode === 'split' && <td className="qtd-hide-sm num">{money(r.matUnit)}</td>}
                                        {mode === 'split' && <td className="qtd-hide-sm num">{money(r.labUnit)}</td>}
                                        {mode === 'lines' && <td className="qtd-hide-sm num">{money(r.unitPrice)}</td>}
                                        <td className="num">{money(r.amount)}</td>
                                    </tr>
                                );
                        }
                    })}
                </tbody>
            </table>
        </div>
    );
}

function Totals({ m, t }: { m: QuotationPrintModel; t: DocumentTranslator }) {
    const lang = m.language;
    const label = (key: QuotationPrintModel['totals'][number]['key']): string => {
        switch (key) {
            case 'subtotal': return t('common.total');
            case 'discount': return t('quotation.discount');
            case 'rounding': return t('quotation.rounding');
            case 'beforeVat': return t('quotation.beforeVat');
            case 'vat': return t('common.vat', { rate: formatPercent(m.vatRate, lang) });
            default: return t('common.grandTotal');
        }
    };
    return (
        <div style={{ marginTop: 8 }}>
            <table style={{ width: '100%' }}>
                <tbody>
                    {m.totals.map(r => (
                        <tr key={r.key} className={r.key === 'grand' ? 'qtd-grand' : undefined}>
                            <td className="num" style={{ width: '100%' }}>{label(r.key)}</td>
                            <td className="num" style={{ minWidth: 110 }}>{formatMoney(r.amount, lang)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div style={{ marginTop: 6 }}>
                <b>{t('common.amountInWords')}:</b> {amountInWords(m.grandTotal, lang)}
            </div>
            {m.vatNote === 'included' && <div style={{ fontSize: '9.5pt' }}>{t('quotation.vatIncluded', { rate: formatPercent(m.vatRate, lang), amount: formatMoney(m.vat, lang) })}</div>}
            {m.vatNote === 'none' && <div style={{ fontSize: '9.5pt' }}>{t('quotation.noVat')}</div>}
        </div>
    );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
    return <div style={{ breakInside: 'avoid' }}><div className="qtd-h">{title}</div>{children}</div>;
}

function Terms({ m, t }: { m: QuotationPrintModel; t: DocumentTranslator }) {
    const lang = m.language;
    const c = m.company;
    return (
        <>
            {m.paymentTerms.length > 0 && (
                <Block title={t('quotation.paymentTerms')}>
                    <table>
                        <tbody>
                            {m.paymentTerms.map((p, i) => (
                                <tr key={i}>
                                    <td>{i + 1}. {p.label}</td>
                                    <td className="num">{formatPercent(p.pct, lang)}</td>
                                    <td className="num">{formatMoney(p.amount, lang)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Block>
            )}
            {m.terms.trim() !== '' && <Block title={t('quotation.terms')}><div className="qtd-pre">{m.terms}</div></Block>}
            {m.note.trim() !== '' && <Block title={t('quotation.note')}><div className="qtd-pre">{m.note}</div></Block>}
            {(c.bankAccounts.length > 0 || c.promptpayId !== '') && (
                <Block title={t('quotation.bank')}>
                    {c.bankAccounts.map((b, i) => (
                        <div key={i}>{b.bankName}{b.branch !== '' ? ` (${b.branch})` : ''} · {b.accountName} · {t('quotation.account')} {b.accountNo}</div>
                    ))}
                    {c.promptpayId !== '' && <div>{t('quotation.promptpay')} {c.promptpayId}</div>}
                </Block>
            )}
            <div className="qtd-sign">
                <div>
                    {m.acceptedByName !== '' ? <div className="qtd-line" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>{t('quotation.acceptedLine', { name: m.acceptedByName })}</div> : <div className="qtd-line" />}
                    <div>{t('quotation.acceptedBy')}</div>
                    <div>{t('common.date')} ______ / ______ / ______</div>
                </div>
                <div>
                    <div className="qtd-line" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8 }}>
                        {c.signatureUrl !== null && <img src={c.signatureUrl} alt="" style={{ maxHeight: 44 }} />}
                        {c.stampUrl !== null && <img src={c.stampUrl} alt="" style={{ maxHeight: 44 }} />}
                    </div>
                    <div>{t('quotation.offeredBy')}</div>
                    <div>{c.name}</div>
                </div>
            </div>
            {c.footer.trim() !== '' && <div className="qtd-pre" style={{ marginTop: 12, textAlign: 'center', fontSize: '9pt', color: '#4b5563' }}>{c.footer}</div>}
        </>
    );
}

export function QuotationPrintDocument({ model }: { model: QuotationPrintModel }) {
    const t = useMemo(() => documentTranslator(model.language), [model.language]);
    const brand = model.company.brandColor;
    return (
        <div className="qtd" lang={model.language} style={{ ['--qtd-brand' as string]: brand, ['--qtd-brand-soft' as string]: soft(brand) }}>
            <style>{CSS}</style>
            <Header m={model} t={t} />
            {model.government !== null ? (
                <GovernmentForms model={model} government={model.government} t={t} />
            ) : (
                <>
                    <StandardTable m={model} t={t} />
                    <Totals m={model} t={t} />
                </>
            )}
            <Terms m={model} t={t} />
        </div>
    );
}
