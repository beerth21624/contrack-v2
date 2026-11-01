'use client';
/* eslint-disable @next/next/no-img-element -- signed file urls of the company, printed as plain images */

// ─── หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) on paper — Thai, Buddhist-era dates ───
import { useMemo } from 'react';
import { Alert, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { amountInWords, formatMoney, formatPercent } from '@/i18n/format';
import { documentTranslator } from '@/i18n/document-translator';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { branchText, DOC_CSS, dateText } from '../billing/DocParts';
import { useCompanyProfile } from '../company/hooks';
import { companyFromProfile } from '../quotations/print-model';
import { PrintFrame } from '../shared/PrintFrame';
import { useWhtCertificate } from './hooks';
import { buildWhtCertificatePrintModel, formatTaxId, type WhtCertificatePrintModel } from './print-model';

const FORM_BOXES = ['pnd1a', 'pnd1aSpecial', 'pnd2', 'pnd3', 'pnd2a', 'pnd3a', 'pnd53'] as const;
const CONDITIONS = ['withheld', 'paid_always', 'paid_once'] as const;
const INCOME_ROWS = ['salary', 'fee', 'royalty', 'interest', 'directive', 'other'] as const;

function Box({ checked }: { checked: boolean }) {
    return <span style={{ display: 'inline-block', width: 12, height: 12, border: '1px solid #000', marginRight: 4, verticalAlign: '-1px', textAlign: 'center', lineHeight: '10px', fontSize: '10px' }}>{checked ? '✓' : ''}</span>;
}

function Party({ title, name, taxId, branch, address }: { title: string; name: string; taxId: string; branch: string; address: string }) {
    const t = documentTranslator('th');
    return (
        <div className="bpd-box" style={{ marginTop: 8 }}>
            <div><b>{title}</b></div>
            <div>{t('whtCertificate.name')} {name}</div>
            <div>{t('common.taxId')} {formatTaxId(taxId) || '–'}{branch !== '' ? ` (${branch})` : ''}</div>
            <div className="bpd-pre">{t('whtCertificate.address')} {address !== '' ? address : '–'}</div>
        </div>
    );
}

export function WhtCertificateDocument({ model }: { model: WhtCertificatePrintModel }) {
    const t = useMemo(() => documentTranslator('th'), []);
    const money = (v: number): string => formatMoney(v, 'th');
    const date = dateText(model.payDate, 'th', 'be');
    // Every payment we make (services, transport, advertising, rent …) is an income of the form's line 6 "อื่น ๆ (ระบุ)".
    const incomeRow = 'other';
    const desc = [t(`whtCertificate.incomeTypes.${model.incomeType}`), model.incomeDesc.trim()].filter(x => x !== '').join(' · ');
    const branch = (code: string): string => branchText({ branchCode: code }, t);
    return (
        <div className="bpd" lang="th">
            <style>{DOC_CSS}</style>
            <div style={{ textAlign: 'center' }}>
                <div className="bpd-title" style={{ color: '#000' }}>{t('whtCertificate.title')}</div>
                <div>{t('whtCertificate.subtitle')}</div>
            </div>
            <div style={{ textAlign: 'right', marginTop: 4 }}>
                {model.bookNo !== '' && <span>{t('whtCertificate.bookNo')} {model.bookNo} · </span>}
                <b>{t('whtCertificate.number')} {model.number}</b>
            </div>
            <Party title={t('whtCertificate.payer')} name={model.payer.name} taxId={model.payer.taxId} branch={branch(model.payer.branchCode)} address={model.payer.address} />
            <Party title={t('whtCertificate.payee')} name={model.payee.name} taxId={model.payee.taxId} branch={branch(model.payee.branchCode)} address={model.payee.address} />
            <div className="bpd-box" style={{ marginTop: 8 }}>
                <b>{t('whtCertificate.formTitle')}</b>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px', marginTop: 2 }}>
                    {FORM_BOXES.map((f, i) => (
                        <span key={f}><Box checked={f === model.form} />({i + 1}) {t(`whtCertificate.forms.${f}`)}</span>
                    ))}
                </div>
            </div>
            <div className="bpd-scroll" style={{ marginTop: 8 }}>
                <table className="bpd-grid">
                    <thead>
                        <tr>
                            <th>{t('whtCertificate.incomeColumn')}</th>
                            <th style={{ width: 110 }}>{t('whtCertificate.payDateColumn')}</th>
                            <th style={{ width: 110 }}>{t('whtCertificate.amountColumn')}</th>
                            <th style={{ width: 110 }}>{t('whtCertificate.taxColumn')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {INCOME_ROWS.map((r, i) => {
                            const on = r === incomeRow;
                            return (
                                <tr key={r}>
                                    <td>
                                        {i + 1}. {t(`whtCertificate.incomeRows.${r}`)}
                                        {on && <div style={{ fontWeight: 600 }}>{desc}</div>}
                                    </td>
                                    <td className="ctr">{on ? date : ''}</td>
                                    <td className="num">{on ? money(model.baseAmount) : ''}</td>
                                    <td className="num">{on ? money(model.whtAmount) : ''}</td>
                                </tr>
                            );
                        })}
                        <tr className="bpd-strong">
                            <td colSpan={2} style={{ textAlign: 'right' }}>{t('whtCertificate.total')}</td>
                            <td className="num">{money(model.baseAmount)}</td>
                            <td className="num">{money(model.whtAmount)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div style={{ marginTop: 6 }}>
                <b>{t('whtCertificate.totalWords')}</b> {amountInWords(model.whtAmount, 'th')}
                <span style={{ marginLeft: 12, color: '#4b5563' }}>({t('whtCertificate.rate')} {formatPercent(model.whtRate, 'th')})</span>
            </div>
            <div className="bpd-box" style={{ marginTop: 8 }}>
                <b>{t('whtCertificate.condition')}</b>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 16px', marginTop: 2 }}>
                    {CONDITIONS.map((c, i) => <span key={c}><Box checked={c === model.condition} />({i + 1}) {t(`whtCertificate.conditions.${c}`)}</span>)}
                </div>
            </div>
            <div style={{ marginTop: 10 }}>{t('whtCertificate.certify')}</div>
            <div className="bpd-sign">
                <div />
                <div>
                    <div className="bpd-line">
                        {model.signatureUrl !== null && <img src={model.signatureUrl} alt="" style={{ maxHeight: 44 }} />}
                        {model.stampUrl !== null && <img src={model.stampUrl} alt="" style={{ maxHeight: 44 }} />}
                    </div>
                    <div>{t('whtCertificate.signer')}</div>
                    <div>{model.payer.name}</div>
                    <div>{t('whtCertificate.issueDate')} {date}</div>
                </div>
            </div>
            <div style={{ marginTop: 10, fontSize: '9pt', color: '#4b5563' }}>{t('whtCertificate.remark')}</div>
        </div>
    );
}

export function WhtCertificatePrintPage({ certificateId }: { certificateId: string }) {
    const t = useTranslations('payables.print');
    const toText = useErrorMessage();
    const cert = useWhtCertificate(certificateId);
    const c = cert.data;
    const company = useCompanyProfile(c?.workspaceId);
    const model = useMemo(() => {
        if (c === undefined || company.data === undefined) return null;
        return buildWhtCertificatePrintModel(c, companyFromProfile(company.data, 'th'));
    }, [c, company.data]);
    const error = cert.error ?? company.error;
    if (error !== null) return <div className="p-4"><Alert type="error" showIcon title={t('loadFailed')} description={toText(error)} /></div>;
    if (model === null) return <div className="p-6"><Skeleton active /></div>;
    return (
        <PrintFrame language="th" watermark={model.watermark} title={model.number} ready>
            <WhtCertificateDocument model={model} />
        </PrintFrame>
    );
}
