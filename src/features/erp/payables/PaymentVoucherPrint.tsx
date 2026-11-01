'use client';

// ─── ใบสำคัญจ่าย (payment voucher, `PV`) on paper — Thai ───
import { useMemo } from 'react';
import { Alert, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { amountInWords, formatMoney } from '@/i18n/format';
import { documentTranslator } from '@/i18n/document-translator';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { brandVars, DOC_CSS, dateText, Footer, Letterhead, MetaRow } from '../billing/DocParts';
import { useCompanyProfile } from '../company/hooks';
import { companyFromProfile } from '../quotations/print-model';
import { PrintFrame } from '../shared/PrintFrame';
import { useApPayment } from './hooks';
import { buildPaymentVoucherPrintModel, type PaymentVoucherPrintModel } from './print-model';

export function PaymentVoucherDocument({ model }: { model: PaymentVoucherPrintModel }) {
    const t = useMemo(() => documentTranslator('th'), []);
    const c = model.company;
    const money = (v: number): string => formatMoney(v, 'th');
    return (
        <div className="bpd" lang="th" style={brandVars(c.brandColor)}>
            <style>{DOC_CSS}</style>
            <Letterhead
                company={c}
                title={t('paymentVoucher.title')}
                t={t}
                rows={(
                    <>
                        <MetaRow label={t('common.number')}>{model.number}</MetaRow>
                        <MetaRow label={t('common.date')}>{dateText(model.payDate, 'th', c.yearStyle)}</MetaRow>
                    </>
                )}
            />
            <div className="bpd-box" style={{ marginTop: 12 }}>
                <div><b>{t('paymentVoucher.payTo')}</b> {model.payeeName}</div>
                <div>
                    <b>{t('paymentVoucher.method')}</b> {t(`paymentVoucher.methods.${model.method}`)}
                    {model.bankRef !== '' && <> · {t('paymentVoucher.bankRef')} {model.bankRef}</>}
                </div>
                {model.whtCertificateNumber !== null && <div><b>{t('paymentVoucher.whtCertificate')}</b> {model.whtCertificateNumber}</div>}
            </div>
            <div className="bpd-scroll" style={{ marginTop: 12 }}>
                <table className="bpd-grid">
                    <thead>
                        <tr>
                            <th style={{ width: 28 }}>{t('paymentVoucher.no')}</th>
                            <th>{t('paymentVoucher.billNo')}</th>
                            <th>{t('paymentVoucher.invoiceNo')}</th>
                            <th style={{ width: 105 }}>{t('paymentVoucher.settled')}</th>
                            <th style={{ width: 105 }}>{t('paymentVoucher.wht')}</th>
                            <th style={{ width: 105 }}>{t('paymentVoucher.cash')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {model.rows.map((r, i) => (
                            <tr key={i}>
                                <td className="ctr">{i + 1}</td>
                                <td>{r.billNumber}</td>
                                <td>{r.supplierInvoiceNo}</td>
                                <td className="num">{money(r.settled)}</td>
                                <td className="num">{money(r.wht)}</td>
                                <td className="num">{money(r.cash)}</td>
                            </tr>
                        ))}
                        <tr className="bpd-strong">
                            <td colSpan={3} style={{ textAlign: 'right' }}>{t('paymentVoucher.total')}</td>
                            <td className="num">{money(model.settledTotal)}</td>
                            <td className="num">{money(model.whtTotal)}</td>
                            <td className="num">{money(model.cashTotal)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div style={{ marginTop: 6, textAlign: 'right' }}>({amountInWords(model.cashTotal, 'th')})</div>
            <div className="bpd-sign">
                {(['preparedBy', 'approvedBy', 'receivedBy'] as const).map(k => (
                    <div key={k}>
                        <div className="bpd-line" />
                        <div>{t(`paymentVoucher.${k}`)}</div>
                        <div>{t('common.date')} ______ / ______ / ______</div>
                    </div>
                ))}
            </div>
            <Footer text={c.footer} />
        </div>
    );
}

export function PaymentVoucherPrintPage({ paymentId }: { paymentId: string }) {
    const t = useTranslations('payables.print');
    const toText = useErrorMessage();
    const payment = useApPayment(paymentId);
    const p = payment.data;
    const company = useCompanyProfile(p?.workspaceId);
    const model = useMemo(() => {
        if (p === undefined || company.data === undefined) return null;
        return buildPaymentVoucherPrintModel(p, companyFromProfile(company.data, 'th'));
    }, [p, company.data]);
    const error = payment.error ?? company.error;
    if (error !== null) return <div className="p-4"><Alert type="error" showIcon title={t('loadFailed')} description={toText(error)} /></div>;
    if (model === null) return <div className="p-6"><Skeleton active /></div>;
    return (
        <PrintFrame language="th" watermark={model.watermark} title={model.number} ready>
            <PaymentVoucherDocument model={model} />
        </PrintFrame>
    );
}
