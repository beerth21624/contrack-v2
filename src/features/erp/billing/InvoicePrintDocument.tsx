'use client';

// ─── The invoice sheet (claim / advance / retention release): print page, customer link page ───
// Text, numbers and dates follow the document's language (model.language), never the UI locale.
import { useMemo } from 'react';
import { amountInWords, formatMoney, formatPercent } from '@/i18n/format';
import { documentTranslator } from '@/i18n/document-translator';
import { brandVars, DOC_CSS, dateText, Footer, Letterhead, MetaRow, PartyBox, SignBlock } from './DocParts';
import { PromptPayQr } from './PromptPayQr';
import type { InvoicePrintModel } from './print-model';

export interface InvoicePayInfo {
    /** EMVCo payload of the cash still to pay; null = no QR. */
    payload: string | null;
    /** Cash the QR asks for. */
    amount: number;
}

export function InvoicePrintDocument({ model, pay }: { model: InvoicePrintModel; pay?: InvoicePayInfo | null }) {
    const t = useMemo(() => documentTranslator(model.language), [model.language]);
    const lang = model.language;
    const c = model.company;
    const money = (v: number): string => formatMoney(v, lang);
    const title = model.kind === 'advance' ? t('invoice.advanceTitle') : model.kind === 'retention' ? t('invoice.retentionTitle') : t('invoice.title');
    const label = (key: string): string => {
        if (key === 'vat') return t('common.vat', { rate: model.vatRate === null ? '' : formatPercent(model.vatRate, lang) }).trim();
        if (key === 'total') return t('invoice.vatIncluded');
        if (key === 'subtotal') return t('invoice.subtotal');
        if (key === 'retention') return t('invoice.retention');
        if (key === 'penalty') return t('invoice.penalty');
        if (key === 'otherDeduction') return t('invoice.otherDeduction');
        if (key === 'wht') return t('invoice.wht');
        return t('invoice.payable');
    };
    const wordsOf = model.outstanding > 0 ? model.outstanding : model.payable;
    return (
        <div className="bpd" lang={lang} style={brandVars(c.brandColor)}>
            <style>{DOC_CSS}</style>
            <Letterhead
                company={c}
                title={title}
                t={t}
                rows={(
                    <>
                        <MetaRow label={t('common.number')}>{model.number ?? t('invoice.draftNote')}</MetaRow>
                        <MetaRow label={t('common.date')}>{dateText(model.issueDate, lang, c.yearStyle)}</MetaRow>
                        <MetaRow label={t('invoice.dueDate')}>{dateText(model.dueDate, lang, c.yearStyle)}</MetaRow>
                    </>
                )}
            />
            <PartyBox
                label={t('invoice.billTo')}
                customer={model.customer}
                t={t}
                extra={model.projectName !== null && <div style={{ marginTop: model.customer !== null ? 6 : 0 }}><b>{t('invoice.project')}</b> {model.projectName}</div>}
            />
            <div className="bpd-scroll" style={{ marginTop: 12 }}>
                <table className="bpd-grid">
                    <thead>
                        <tr>
                            <th style={{ width: 44 }}>{t('invoice.no')}</th>
                            <th>{t('invoice.description')}</th>
                            <th style={{ width: 120 }}>{t('invoice.amount')}</th>
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
                        {model.rows.map(r => (
                            <tr key={r.key} className={r.key === 'payable' ? 'bpd-strong' : undefined}>
                                <td />
                                <td style={{ textAlign: 'right', fontWeight: r.key === 'payable' || r.key === 'total' ? 600 : undefined }}>{label(r.key)}</td>
                                <td className="num">{money(r.amount)}</td>
                            </tr>
                        ))}
                        {model.paid > 0 && (
                            <tr>
                                <td />
                                <td style={{ textAlign: 'right' }}>{t('invoice.paid')}</td>
                                <td className="num">{money(-model.paid)}</td>
                            </tr>
                        )}
                        {model.paid > 0 && (
                            <tr className="bpd-strong">
                                <td />
                                <td style={{ textAlign: 'right' }}>{t('invoice.outstanding')}</td>
                                <td className="num">{money(model.outstanding)}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div style={{ marginTop: 6 }}>
                <b>{t('common.amountInWords')}</b> {amountInWords(wordsOf, lang)}
            </div>
            {model.note.trim() !== '' && <div style={{ marginTop: 8 }}><b>{t('invoice.note')}</b> <span className="bpd-pre">{model.note}</span></div>}
            {(c.bankAccounts.length > 0 || c.promptpayId !== '' || (pay?.payload ?? null) !== null) && model.outstanding > 0 && (
                <div className="bpd-box" style={{ marginTop: 12 }}>
                    <div className="bpd-h" style={{ marginTop: 0 }}>{t('invoice.payTitle')}</div>
                    <div className="bpd-pay">
                        {pay?.payload != null && (
                            <div style={{ textAlign: 'center' }}>
                                <PromptPayQr payload={pay.payload} size={140} />
                                <div style={{ fontSize: '9pt' }}>{t('invoice.scanToPay', { amount: formatMoney(pay.amount, lang) })}</div>
                            </div>
                        )}
                        <div className="min-w-0">
                            {c.promptpayId !== '' && <div>{t('invoice.promptpay')} {c.promptpayId}</div>}
                            {c.bankAccounts.map((b, i) => (
                                <div key={i}>{t('invoice.bankTransfer')} {b.bankName}{b.branch !== '' ? ` (${b.branch})` : ''} · {t('invoice.accountNo')} {b.accountNo} · {b.accountName}</div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            <SignBlock left={t('invoice.receivedBy')} company={c} rightLabel={t('invoice.issuedBy')} t={t} />
            <Footer text={c.footer} />
        </div>
    );
}
