'use client';

// ─── The PO on paper: letterhead, supplier, lines, totals, terms, signatures (in the PO's own language) ───
import { useMemo } from 'react';
import { amountInWords, formatMoney, formatPercent, formatQty } from '@/i18n/format';
import { documentTranslator } from '@/i18n/document-translator';
import { brandVars, DOC_CSS, dateText, Footer, Letterhead, MetaRow, PartyBox, SignBlock } from '../billing/DocParts';
import type { PurchaseOrderPrintModel } from './print-model';

export function PurchaseOrderPrintDocument({ model }: { model: PurchaseOrderPrintModel }) {
    const t = useMemo(() => documentTranslator(model.language), [model.language]);
    const lang = model.language;
    const c = model.company;
    const money = (v: number): string => formatMoney(v, lang);
    const afterDiscount = model.subtotal - model.discount;
    return (
        <div className="bpd" lang={lang} style={brandVars(c.brandColor)}>
            <style>{DOC_CSS}</style>
            <Letterhead
                company={c}
                title={t('purchaseOrder.title')}
                t={t}
                rows={(
                    <>
                        <MetaRow label={t('common.number')}>{model.number ?? t('purchaseOrder.draftNote')}</MetaRow>
                        {model.orderDate !== null && <MetaRow label={t('purchaseOrder.orderDate')}>{dateText(model.orderDate, lang, c.yearStyle)}</MetaRow>}
                        {model.deliveryDate !== null && <MetaRow label={t('purchaseOrder.deliveryDate')}>{dateText(model.deliveryDate, lang, c.yearStyle)}</MetaRow>}
                    </>
                )}
            />
            <PartyBox
                label={t('purchaseOrder.supplier')}
                customer={model.supplier}
                t={t}
                extra={(
                    <div style={{ marginTop: model.supplier !== null ? 6 : 0 }}>
                        {model.supplier !== null && (model.supplier.contactName !== '' || model.supplier.phone !== '') && (
                            <div><b>{t('purchaseOrder.contact')}</b> {[model.supplier.contactName, model.supplier.phone].filter(x => x !== '').join(' · ')}</div>
                        )}
                        <div><b>{t('purchaseOrder.project')}</b> {model.projectName}</div>
                        {model.deliveryAddress.trim() !== '' && <div className="bpd-pre"><b>{t('purchaseOrder.deliveryAddress')}</b> {model.deliveryAddress}</div>}
                        <div>
                            <b>{t('purchaseOrder.paymentTerms')}</b>{' '}
                            {model.paymentTermDays === null || model.paymentTermDays === 0 ? t('purchaseOrder.cash') : t('purchaseOrder.creditDays', { days: model.paymentTermDays })}
                        </div>
                    </div>
                )}
            />
            <div className="bpd-scroll" style={{ marginTop: 12 }}>
                <table className="bpd-grid">
                    <thead>
                        <tr>
                            <th style={{ width: 28 }}>{t('purchaseOrder.no')}</th>
                            <th style={{ width: 64 }}>{t('purchaseOrder.code')}</th>
                            <th>{t('purchaseOrder.item')}</th>
                            <th style={{ width: 70 }}>{t('purchaseOrder.qty')}</th>
                            <th style={{ width: 50 }}>{t('purchaseOrder.unit')}</th>
                            <th style={{ width: 90 }}>{t('purchaseOrder.unitPrice')}</th>
                            <th style={{ width: 100 }}>{t('purchaseOrder.amount')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {model.lines.length === 0 && <tr><td colSpan={7} className="ctr">{t('purchaseOrder.noLines')}</td></tr>}
                        {model.lines.map((l, i) => (
                            <tr key={`${l.code}-${String(i)}`}>
                                <td className="ctr">{i + 1}</td>
                                <td>{l.code}</td>
                                <td className="bpd-pre">{l.text}</td>
                                <td className="num">{formatQty(l.qty, lang)}</td>
                                <td className="ctr">{l.unit}</td>
                                <td className="num">{money(l.unitPrice)}</td>
                                <td className="num">{money(l.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <table className="bpd-grid" style={{ marginTop: 12, marginLeft: 'auto', width: '55%', minWidth: 260 }}>
                <tbody>
                    <tr><td>{t('purchaseOrder.subtotal')}</td><td className="num">{money(model.subtotal)}</td></tr>
                    {model.discount > 0 && <tr><td>{t('purchaseOrder.discount')}</td><td className="num">-{money(model.discount)}</td></tr>}
                    {model.discount > 0 && <tr><td>{t('purchaseOrder.afterDiscount')}</td><td className="num">{money(afterDiscount)}</td></tr>}
                    {model.vatRate > 0 && <tr><td>{t('purchaseOrder.vat', { rate: formatPercent(model.vatRate, lang) })}</td><td className="num">{money(model.vat)}</td></tr>}
                    <tr className="bpd-strong"><td>{t('purchaseOrder.grandTotal')}</td><td className="num">{money(model.total)}</td></tr>
                </tbody>
            </table>
            <div style={{ marginTop: 6, textAlign: 'right' }}>({amountInWords(model.total, lang)})</div>
            {model.terms.trim() !== '' && (
                <div className="bpd-box" style={{ marginTop: 12 }}>
                    <div><b>{t('purchaseOrder.terms')}</b></div>
                    <div className="bpd-pre">{model.terms}</div>
                </div>
            )}
            <SignBlock left={t('purchaseOrder.acceptedBy')} company={c} rightLabel={t('purchaseOrder.orderedBy')} t={t} />
            <Footer text={c.footer} />
        </div>
    );
}
