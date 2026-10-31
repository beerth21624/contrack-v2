'use client';

// ─── The full-form tax invoice / credit note sheet (docs/erp/01-architecture.md §15) ───
// Has everything a full tax invoice needs: the words "ใบกำกับภาษี" / "Tax invoice", seller and buyer with tax id and branch,
// number, date, lines, amount before VAT, VAT and the total.
import { useMemo } from 'react';
import { amountInWords, formatMoney, formatPercent } from '@/i18n/format';
import { documentTranslator } from '@/i18n/document-translator';
import { brandVars, DOC_CSS, dateText, Footer, Letterhead, MetaRow, PartyBox, SignBlock } from './DocParts';
import type { InvoicePrintModel } from './print-model';

export function TaxInvoicePrintDocument({ model }: { model: InvoicePrintModel }) {
    const t = useMemo(() => documentTranslator(model.language), [model.language]);
    const lang = model.language;
    const c = model.company;
    const money = (v: number): string => formatMoney(v, lang);
    const credit = model.kind === 'creditNote';
    const vatLabel = model.vatRate === null ? t('taxInvoice.vat') : t('common.vat', { rate: formatPercent(model.vatRate, lang) });
    const total = model.rows.find(r => r.key === 'total')?.amount ?? model.total;
    return (
        <div className="bpd" lang={lang} style={brandVars(c.brandColor)}>
            <style>{DOC_CSS}</style>
            <Letterhead
                company={c}
                title={credit ? t('taxInvoice.creditNoteTitle') : t('taxInvoice.title')}
                t={t}
                rows={(
                    <>
                        <MetaRow label={t('common.number')}>{model.number ?? t('taxInvoice.draftNote')}</MetaRow>
                        <MetaRow label={t('common.date')}>{dateText(model.issueDate, lang, c.yearStyle)}</MetaRow>
                        {!credit && <tr><td colSpan={2} style={{ textAlign: 'right', fontSize: '9pt' }}>{t('taxInvoice.original')}</td></tr>}
                    </>
                )}
            />
            <PartyBox
                label={t('taxInvoice.buyer')}
                customer={model.customer}
                t={t}
                extra={model.relatedNumber !== null && (
                    <div style={{ marginTop: model.customer !== null ? 6 : 0 }}>
                        {t(model.relatedIsTaxInvoice ? 'taxInvoice.referenceTax' : 'taxInvoice.reference', { number: model.relatedNumber })}
                    </div>
                )}
            />
            <div className="bpd-scroll" style={{ marginTop: 12 }}>
                <table className="bpd-grid">
                    <thead>
                        <tr>
                            <th style={{ width: 44 }}>{t('taxInvoice.no')}</th>
                            <th>{t('taxInvoice.description')}</th>
                            <th style={{ width: 120 }}>{t('taxInvoice.amount')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {model.lines.map((l, i) => (
                            <tr key={i}>
                                <td className="ctr">{i + 1}</td>
                                <td className="bpd-pre">{l.text}</td>
                                <td className="num">{money(l.amount)}</td>
                            </tr>
                        ))}
                        <tr><td /><td style={{ textAlign: 'right' }}>{t('taxInvoice.net')}</td><td className="num">{money(model.net)}</td></tr>
                        <tr><td /><td style={{ textAlign: 'right' }}>{vatLabel}</td><td className="num">{money(model.vat)}</td></tr>
                        <tr className="bpd-strong"><td /><td style={{ textAlign: 'right' }}>{t('taxInvoice.total')}</td><td className="num">{money(total)}</td></tr>
                    </tbody>
                </table>
            </div>
            <div style={{ marginTop: 6 }}><b>{t('common.amountInWords')}</b> {amountInWords(total, lang)}</div>
            {model.note.trim() !== '' && <div style={{ marginTop: 8 }} className="bpd-pre">{model.note}</div>}
            <SignBlock left={t('invoice.receivedBy')} company={c} rightLabel={t('taxInvoice.authorized')} t={t} />
            <Footer text={c.footer} />
        </div>
    );
}
