'use client';

// ─── The receipt sheet; with one tax invoice it is printed as "receipt / tax invoice" (full tax invoice details) ───
import { useMemo } from 'react';
import { amountInWords, formatMoney, formatPercent } from '@/i18n/format';
import { documentTranslator } from '@/i18n/document-translator';
import { brandVars, DOC_CSS, dateText, Footer, Letterhead, MetaRow, PartyBox, SignBlock } from './DocParts';
import type { ReceiptPrintModel } from './print-model';

export function ReceiptPrintDocument({ model, vatRate }: { model: ReceiptPrintModel; vatRate?: number | null }) {
    const t = useMemo(() => documentTranslator(model.language), [model.language]);
    const lang = model.language;
    const c = model.company;
    const money = (v: number): string => formatMoney(v, lang);
    const combined = model.combined;
    const showTi = model.taxInvoiceNumbers.length > 0;
    const vatLabel = vatRate == null ? t('receipt.vat') : t('common.vat', { rate: formatPercent(vatRate, lang) });
    return (
        <div className="bpd" lang={lang} style={brandVars(c.brandColor)}>
            <style>{DOC_CSS}</style>
            <Letterhead
                company={c}
                title={combined !== null ? t('receipt.titleTaxInvoice') : t('receipt.title')}
                t={t}
                rows={(
                    <>
                        <MetaRow label={t('common.number')}>{model.number}</MetaRow>
                        {combined !== null && combined.number !== '' && <MetaRow label={t('receipt.taxInvoiceNo')}>{combined.number}</MetaRow>}
                        <MetaRow label={t('common.date')}>{dateText(model.receiptDate, lang, c.yearStyle)}</MetaRow>
                    </>
                )}
            />
            <PartyBox
                label={t('receipt.receivedFrom')}
                customer={model.customer}
                t={t}
                extra={(
                    <div style={{ marginTop: model.customer !== null ? 6 : 0 }}>
                        <b>{t('receipt.method')}</b> {t(`receipt.methods.${model.method}`)}
                        {model.bankRef !== '' && <> · {t('receipt.bankRef')} {model.bankRef}</>}
                    </div>
                )}
            />
            <div className="bpd-scroll" style={{ marginTop: 12 }}>
                <table className="bpd-grid">
                    <thead>
                        <tr>
                            <th>{t('receipt.invoiceNo')}</th>
                            {showTi && combined === null && <th>{t('receipt.taxInvoiceNo')}</th>}
                            <th style={{ width: 110 }}>{t('receipt.cash')}</th>
                            <th style={{ width: 110 }}>{t('receipt.wht')}</th>
                            <th style={{ width: 110 }}>{t('receipt.settled')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {model.rows.map((r, i) => (
                            <tr key={i}>
                                <td>{r.invoiceNumber}</td>
                                {showTi && combined === null && <td>{r.taxInvoiceNumber ?? ''}</td>}
                                <td className="num">{money(r.cash)}</td>
                                <td className="num">{money(r.wht)}</td>
                                <td className="num">{money(r.settled)}</td>
                            </tr>
                        ))}
                        <tr className="bpd-strong">
                            <td colSpan={showTi && combined === null ? 2 : 1} style={{ textAlign: 'right' }}>{t('receipt.totalSettled')}</td>
                            <td className="num">{money(model.cashAmount)}</td>
                            <td className="num">{money(model.whtAmount)}</td>
                            <td className="num">{money(model.settledTotal)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            {combined !== null && (
                <div className="bpd-scroll" style={{ marginTop: 12 }}>
                    <table className="bpd-grid">
                        <thead>
                            <tr>
                                <th>{t('receipt.description')}</th>
                                <th style={{ width: 120 }}>{t('receipt.amount')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {combined.lines.map((l, i) => (
                                <tr key={i}><td className="bpd-pre">{l.text}</td><td className="num">{money(l.amount)}</td></tr>
                            ))}
                            <tr><td style={{ textAlign: 'right' }}>{t('receipt.net')}</td><td className="num">{money(combined.net)}</td></tr>
                            <tr><td style={{ textAlign: 'right' }}>{vatLabel}</td><td className="num">{money(combined.vat)}</td></tr>
                            <tr className="bpd-strong"><td style={{ textAlign: 'right' }}>{t('receipt.total')}</td><td className="num">{money(combined.total)}</td></tr>
                        </tbody>
                    </table>
                </div>
            )}
            {combined === null && showTi && (
                <div style={{ marginTop: 8 }}>{t('receipt.taxInvoices', { numbers: model.taxInvoiceNumbers.join(', ') })}</div>
            )}
            <div style={{ marginTop: 6 }}><b>{t('common.amountInWords')}</b> {amountInWords(model.cashAmount, lang)}</div>
            {model.whtCertificateNo !== '' && <div style={{ marginTop: 4 }}>{t('receipt.whtCertificate')} {model.whtCertificateNo}</div>}
            {model.note.trim() !== '' && <div style={{ marginTop: 8 }}><b>{t('receipt.note')}</b> <span className="bpd-pre">{model.note}</span></div>}
            {model.voidReason !== '' && <div style={{ marginTop: 8 }}><b>{t('receipt.voidReason')}</b> {model.voidReason}</div>}
            <SignBlock left={t('receipt.payer')} company={c} rightLabel={t('receipt.receiver')} t={t} />
            <Footer text={c.footer} />
        </div>
    );
}
