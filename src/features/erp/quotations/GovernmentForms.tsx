'use client';

// ─── Thai government forms of a quotation: ปร.6 (all parts, when more than one), ปร.5 (per part), ปร.4 (detail) ───
// Factor F includes VAT (D-12/D-40). Direct costs are shown only when the caller may see cost (`costBasis`).
import { amountInWords, formatMoney, formatNumber, formatPercent, formatQty } from '@/i18n/format';
import type { DocumentTranslator } from '@/i18n/document-translator';
import type { GovernmentModel, QuotationPrintModel } from './print-model';

export function GovernmentForms({ model, government: g, t }: { model: QuotationPrintModel; government: GovernmentModel; t: DocumentTranslator }) {
    const lang = model.language;
    const money = (v: number): string => formatMoney(v, lang);
    const factor = (f: number): string => formatNumber(f, lang, { min: 2, max: 4 });
    const vatLine = (
        <>
            {model.vatNote === 'included' && <div style={{ fontSize: '9.5pt' }}>{t('government.vatIncluded', { rate: formatPercent(model.vatRate, lang), amount: money(model.vat) })}</div>}
            {model.vatNote === 'none' && <div style={{ fontSize: '9.5pt' }}>{t('government.noVat')}</div>}
        </>
    );
    return (
        <>
            {g.pr6 !== null && (
                <section className="qtd-form" style={{ marginTop: 12 }}>
                    <div className="qtd-h" style={{ textAlign: 'center' }}>{t('government.pr6')}</div>
                    <table className="qtd-grid">
                        <thead>
                            <tr><th style={{ width: 44 }}>{t('government.no')}</th><th>{t('government.part')}</th><th style={{ width: 120 }}>{t('government.amount')}</th></tr>
                        </thead>
                        <tbody>
                            {g.pr6.map(r => (
                                <tr key={r.no}><td className="ctr">{r.no}</td><td>{r.text}</td><td className="num">{money(r.amount)}</td></tr>
                            ))}
                            <tr className="qtd-grand"><td /><td className="num">{t('government.grandTotal')}</td><td className="num">{money(model.grandTotal)}</td></tr>
                        </tbody>
                    </table>
                    <div style={{ marginTop: 6 }}><b>{t('common.amountInWords')}:</b> {amountInWords(model.grandTotal, lang)}</div>
                    {vatLine}
                </section>
            )}

            {g.pr5.map(p => (
                <section key={p.key} className="qtd-form" style={{ marginTop: 12 }}>
                    <div className="qtd-h" style={{ textAlign: 'center' }}>{t('government.pr5')}{p.title !== '' ? ` · ${p.title}` : ''}</div>
                    <table className="qtd-grid">
                        <thead>
                            <tr><th style={{ width: 44 }}>{t('government.no')}</th><th>{t('government.workTitle')}</th><th style={{ width: 120 }}>{t('government.amount')}</th></tr>
                        </thead>
                        <tbody>
                            {p.rows.map(r => (
                                <tr key={r.no}><td className="ctr">{r.no}</td><td>{r.text}</td><td className="num">{money(r.amount)}</td></tr>
                            ))}
                            {p.costTotal !== null && (
                                <>
                                    <tr className="qtd-sub"><td /><td className="num">{t('government.costTotal')}</td><td className="num">{money(p.costTotal)}</td></tr>
                                    <tr><td /><td className="num">{t('government.factorF')}</td><td className="num">{factor(p.factorF)}</td></tr>
                                </>
                            )}
                            <tr className="qtd-grand">
                                <td />
                                <td className="num">{p.costTotal !== null ? t('government.partTotal') : t('government.partTotalF', { factor: factor(p.factorF) })}</td>
                                <td className="num">{money(p.sell)}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div style={{ marginTop: 6 }}><b>{t('common.amountInWords')}:</b> {amountInWords(p.sell, lang)}</div>
                    {g.pr6 === null && vatLine}
                </section>
            ))}

            <section className="qtd-form" style={{ marginTop: 12 }}>
                <div className="qtd-h" style={{ textAlign: 'center' }}>{t('government.pr4')}</div>
                <div className="qtd-scroll">
                    <table className="qtd-grid">
                        <thead>
                            <tr>
                                <th style={{ width: 44 }}>{t('government.no')}</th>
                                <th>{t('government.description')}</th>
                                <th className="qtd-hide-sm" style={{ width: 62 }}>{t('government.qty')}</th>
                                <th className="qtd-hide-sm" style={{ width: 52 }}>{t('government.unit')}</th>
                                <th className="qtd-hide-sm" style={{ width: 82 }}>{t('government.materialUnit')}</th>
                                <th className="qtd-hide-sm" style={{ width: 82 }}>{t('government.labourUnit')}</th>
                                <th style={{ width: 96 }}>{t('government.amount')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {g.pr4.map((r, i) => {
                                if (r.kind === 'section') return <tr key={i} className="qtd-section"><td className="ctr">{r.no}</td><td colSpan={5}>{r.text}</td><td /></tr>;
                                if (r.kind === 'note') return <tr key={i} className="qtd-note"><td /><td colSpan={6}>{r.text}</td></tr>;
                                if (r.kind === 'subtotal') {
                                    return (
                                        <tr key={i} className="qtd-sub">
                                            <td />
                                            <td colSpan={5} className="num">{t('government.sectionTotal', { title: r.text })}</td>
                                            <td className="num">{money(r.amount ?? 0)}</td>
                                        </tr>
                                    );
                                }
                                return (
                                    <tr key={i}>
                                        <td className="ctr">{r.no}</td>
                                        <td>
                                            {r.text}
                                            <div className="qtd-show-sm">{formatQty(r.qty ?? 0, lang)} {r.unit}</div>
                                        </td>
                                        <td className="qtd-hide-sm num">{formatQty(r.qty ?? 0, lang)}</td>
                                        <td className="qtd-hide-sm ctr">{r.unit}</td>
                                        <td className="qtd-hide-sm num">{money(r.matUnit ?? 0)}</td>
                                        <td className="qtd-hide-sm num">{money(r.labUnit ?? 0)}</td>
                                        <td className="num">{money(r.amount ?? 0)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    );
}
