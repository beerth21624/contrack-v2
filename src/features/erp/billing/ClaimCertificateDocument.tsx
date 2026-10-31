'use client';

// ─── The progress claim certificate: work done per cost code, the deductions, the net payable, the inspector's name ───
import { useMemo } from 'react';
import { formatMoney, formatPercent } from '@/i18n/format';
import { documentTranslator } from '@/i18n/document-translator';
import { brandVars, DOC_CSS, dateText, Footer, Letterhead, MetaRow, PartyBox, SignBlock } from './DocParts';
import type { ClaimPrintModel } from './print-model';

export function ClaimCertificateDocument({ model }: { model: ClaimPrintModel }) {
    const t = useMemo(() => documentTranslator(model.language), [model.language]);
    const lang = model.language;
    const c = model.company;
    const money = (v: number): string => formatMoney(v, lang);
    const pct = (v: number): string => formatPercent(v, lang);
    const period = model.periodFrom !== null && model.periodTo !== null
        ? `${dateText(model.periodFrom, lang, c.yearStyle)} - ${dateText(model.periodTo, lang, c.yearStyle)}`
        : null;
    return (
        <div className="bpd" lang={lang} style={brandVars(c.brandColor)}>
            <style>{DOC_CSS}</style>
            <Letterhead
                company={c}
                title={t('claim.title')}
                t={t}
                rows={(
                    <>
                        <MetaRow label={t('claim.claimNo')}>{model.claimNo}</MetaRow>
                        {model.contractNumber !== null && <MetaRow label={t('claim.contractNo')}>{model.contractNumber}</MetaRow>}
                        {period !== null && <MetaRow label={t('claim.period')}>{period}</MetaRow>}
                    </>
                )}
            />
            <PartyBox
                label={t('claim.client')}
                customer={model.customer}
                t={t}
                extra={<div style={{ marginTop: model.customer !== null ? 6 : 0 }}><b>{t('claim.project')}</b> {model.projectName}</div>}
            />
            <div className="bpd-scroll" style={{ marginTop: 12 }}>
                {model.milestone ? null : (
                    <table className="bpd-grid">
                        <thead>
                            <tr>
                                <th style={{ width: 54 }}>{t('claim.code')}</th>
                                <th>{t('claim.item')}</th>
                                <th style={{ width: 90 }}>{t('claim.contractAmount')}</th>
                                <th style={{ width: 52 }}>{t('claim.prevProgress')}</th>
                                <th style={{ width: 52 }}>{t('claim.cumProgress')}</th>
                                <th style={{ width: 90 }}>{t('claim.prevAmount')}</th>
                                <th style={{ width: 90 }}>{t('claim.cumAmount')}</th>
                                <th style={{ width: 90 }}>{t('claim.thisAmount')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {model.lines.length === 0 && <tr><td colSpan={8} className="ctr">{t('claim.noLines')}</td></tr>}
                            {model.lines.map(l => (
                                <tr key={l.code}>
                                    <td>{l.code}</td>
                                    <td className="bpd-pre">{l.text}{l.note !== '' ? ` (${t('claim.lineNote')} ${l.note})` : ''}</td>
                                    <td className="num">{money(l.contractAmount)}</td>
                                    <td className="num">{pct(l.prevProgress)}</td>
                                    <td className="num">{pct(l.cumProgress)}</td>
                                    <td className="num">{money(l.prevAmount)}</td>
                                    <td className="num">{money(l.cumAmount)}</td>
                                    <td className="num">{money(l.thisAmount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <table className="bpd-grid" style={{ marginTop: 12, marginLeft: 'auto', width: '60%', minWidth: 280 }}>
                <tbody>
                    {model.summary.map(r => (
                        <tr key={r.key} className={r.key === 'payable' ? 'bpd-strong' : undefined}>
                            <td style={{ fontWeight: r.key === 'base' || r.key === 'payable' ? 600 : undefined }}>{r.key === 'workValue' && model.milestone ? t('claim.milestone') : t(`claim.${r.key}`)}</td>
                            <td className="num">{money(r.amount)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="bpd-box" style={{ marginTop: 12 }}>
                {model.certified ? (
                    <>
                        <div><b>{t('claim.certifiedBy')}</b> {model.certifiedByName}{model.certifiedAt !== null ? ` · ${t('claim.certifiedOn')} ${dateText(model.certifiedAt, lang, c.yearStyle)}` : ''}</div>
                        {model.certifiedNote.trim() !== '' && <div className="bpd-pre"><b>{t('claim.certifiedNote')}</b> {model.certifiedNote}</div>}
                    </>
                ) : (
                    <div>{t('claim.notCertified')}</div>
                )}
            </div>
            <SignBlock left={t('claim.certifiedBy')} company={c} rightLabel={t('claim.claimedBy')} t={t} />
            <Footer text={c.footer} />
        </div>
    );
}
