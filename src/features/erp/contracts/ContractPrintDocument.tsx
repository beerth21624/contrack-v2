'use client';
/* eslint-disable @next/next/no-img-element -- signed file urls of the company, printed as plain images */

// ─── The contract sheet: the contract text (filled template) and the annex of milestones ───
// Text, numbers and dates follow the contract's language (model.language), never the UI locale.
import { documentTranslator } from '@/i18n/document-translator';
import { formatDocumentDate, formatMoney, formatPercent } from '@/i18n/format';
import { useMemo } from 'react';
import type { ContractPrintModel } from './print-model';

const CSS = `
.ctd { color: #000; font-size: 11pt; line-height: 1.5; }
.ctd table { width: 100%; border-collapse: collapse; }
.ctd th, .ctd td { padding: 3px 6px; vertical-align: top; }
.ctd .ctd-body h1 { font-size: 16pt; text-align: center; margin: 12px 0; }
.ctd .ctd-body h2 { font-size: 12pt; margin: 14px 0 4px; }
.ctd .ctd-body p { margin: 4px 0; text-align: justify; overflow-wrap: anywhere; }
.ctd .ctd-body table th, .ctd .ctd-body table td { border: 1px solid #9ca3af; }
.ctd .ctd-body table th { background: #f3f4f6; }
.ctd .ctd-body table:last-of-type:not(:has(th)) td { border: none; padding-top: 36px; text-align: center; }
.ctd .ctd-head { display: flex; gap: 12px; align-items: flex-start; }
.ctd .ctd-logo { max-height: 56px; max-width: 140px; object-fit: contain; }
.ctd .ctd-grid th, .ctd .ctd-grid td { border: 1px solid #9ca3af; }
.ctd .ctd-grid th { background: #f3f4f6; text-align: center; font-weight: 600; }
.ctd .num { text-align: right; white-space: nowrap; }
.ctd .ctr { text-align: center; }
.ctd .ctd-annex { break-before: page; }
.ctd .ctd-h { font-size: 13pt; font-weight: 700; margin: 0 0 8px; }
.ctd tr { break-inside: avoid; }
.ctd-scroll { overflow-x: auto; }
`;

export function ContractPrintDocument({ model }: { model: ContractPrintModel }) {
    const lang = model.language;
    const t = useMemo(() => documentTranslator(lang), [lang]);
    const c = model.company;
    const branch = c.branchCode === '00000' || c.branchCode === '' ? t('common.headOffice') : `${t('common.branch')} ${c.branchName !== '' ? c.branchName : c.branchCode}`;
    const triggerText = (r: ContractPrintModel['annex'][number]): string => {
        switch (r.trigger) {
            case 'progress': return t('contract.triggerProgress', { pct: formatPercent(r.triggerProgress ?? 0, lang) });
            case 'date': return t('contract.triggerDate', { date: r.dueDate === null ? '-' : formatDocumentDate(r.dueDate, lang, c.yearStyle) });
            case 'signing': return t('contract.triggerSigning');
            case 'handover': return t('contract.triggerHandover');
            default: return t('contract.triggerManual');
        }
    };
    return (
        <div className="ctd">
            <style>{CSS}</style>
            <div className="ctd-head">
                {c.logoUrl !== null && <img className="ctd-logo" src={c.logoUrl} alt="" />}
                <div style={{ fontSize: '10pt' }}>
                    <div style={{ fontWeight: 700, fontSize: '12pt' }}>{c.name}</div>
                    {c.address !== '' && <div style={{ whiteSpace: 'pre-wrap' }}>{c.address}</div>}
                    {c.taxId !== '' && <div>{t('common.taxId')} {c.taxId} ({branch})</div>}
                </div>
            </div>
            {model.number === null && <div style={{ marginTop: 8, color: '#6b7280' }}>{t('contract.draftNote')}</div>}
            {/* Sanitized by renderMainContract (sanitizeDocumentHtml): a whitelist of tags and attributes. */}
            <div className="ctd-body" dangerouslySetInnerHTML={{ __html: model.bodyHtml }} />
            <section className="ctd-annex">
                <h2 className="ctd-h">{t('contract.annexTitle')}</h2>
                <div className="ctd-scroll">
                    <table className="ctd-grid">
                        <thead>
                            <tr>
                                <th style={{ width: 44 }}>{t('contract.no')}</th>
                                <th>{t('contract.description')}</th>
                                <th>{t('contract.trigger')}</th>
                                <th style={{ width: 60 }}>{t('contract.share')}</th>
                                <th style={{ width: 100 }}>{t('contract.amount')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {model.annex.map((r, i) => (
                                <tr key={i}>
                                    <td className="ctr">{r.no}</td>
                                    <td>{r.label}{r.source === 'variation' ? ` (${t('contract.variation')})` : ''}</td>
                                    <td>{triggerText(r)}</td>
                                    <td className="num">{r.source === 'variation' ? '-' : formatPercent(r.pct, lang)}</td>
                                    <td className="num">{formatMoney(r.amount, lang)}</td>
                                </tr>
                            ))}
                            <tr style={{ fontWeight: 700 }}>
                                <td />
                                <td colSpan={3} className="num">{t('contract.total')}</td>
                                <td className="num">{formatMoney(model.annexTotal, lang)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p style={{ fontSize: '10pt', marginTop: 8 }}>
                    {model.vatRate > 0 ? t('contract.vatNote', { rate: formatPercent(model.vatRate, lang) }) : t('contract.noVatNote')}
                </p>
            </section>
        </div>
    );
}
