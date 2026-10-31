'use client';
/* eslint-disable @next/next/no-img-element -- signed evidence links, printed as plain images */

// ─── The VO on paper / on the customer link: lines at sell price, totals, schedule impact, billing, evidence ───
import { useMemo } from 'react';
import { formatDateTime, formatMoney, formatQty } from '@/i18n/format';
import { documentTranslator } from '@/i18n/document-translator';
import { brandVars, DOC_CSS, dateText, Footer, Letterhead, MetaRow, PartyBox, SignBlock } from '../billing/DocParts';
import type { VariationPrintModel } from './print-model';

export function VariationPrintDocument({ model, showSign = true }: { model: VariationPrintModel; showSign?: boolean }) {
    const t = useMemo(() => documentTranslator(model.language), [model.language]);
    const lang = model.language;
    const c = model.company;
    const money = (v: number): string => formatMoney(v, lang);
    const days = model.scheduleImpactDays;
    return (
        <div className="bpd" lang={lang} style={brandVars(c.brandColor)}>
            <style>{DOC_CSS}</style>
            <Letterhead
                company={c}
                title={t('variation.title')}
                t={t}
                rows={(
                    <>
                        {model.number !== null && <MetaRow label={t('common.number')}>{model.number}</MetaRow>}
                        <MetaRow label={t('common.date')}>{dateText(model.date, lang, c.yearStyle)}</MetaRow>
                        {model.contractNumber !== null && <MetaRow label={t('variation.contractNo')}>{model.contractNumber}</MetaRow>}
                    </>
                )}
            />
            <PartyBox
                label={t('variation.client')}
                customer={model.customer}
                t={t}
                extra={(
                    <div style={{ marginTop: model.customer !== null ? 6 : 0 }}>
                        <div><b>{t('variation.project')}</b> {model.projectName}</div>
                        <div className="bpd-pre"><b>{t('variation.subject')}</b> {model.title}</div>
                        <div>
                            <b>{t('variation.reason')}</b> {t(`variation.reasons.${model.reason}`)}
                            {' · '}<b>{t('variation.requestedBy')}</b> {model.requestedByName}
                            {model.requestedDate !== null && <> {t('variation.requestedOn')} {dateText(model.requestedDate, lang, c.yearStyle)}</>}
                        </div>
                    </div>
                )}
            />
            <div className="bpd-scroll" style={{ marginTop: 12 }}>
                <table className="bpd-grid">
                    <thead>
                        <tr>
                            <th style={{ width: 28 }}>#</th>
                            <th style={{ width: 64 }}>{t('variation.code')}</th>
                            <th>{t('variation.item')}</th>
                            <th style={{ width: 70 }}>{t('variation.qty')}</th>
                            <th style={{ width: 50 }}>{t('variation.unit')}</th>
                            <th style={{ width: 90 }}>{t('variation.unitPrice')}</th>
                            <th style={{ width: 100 }}>{t('variation.amount')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {model.lines.length === 0 && <tr><td colSpan={7} className="ctr">{t('variation.noLines')}</td></tr>}
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
                    <tr><td>{t('variation.sellTotal')}</td><td className="num">{money(model.sellTotal)}</td></tr>
                    <tr><td>{t('variation.vat')}</td><td className="num">{money(model.vat)}</td></tr>
                    <tr className="bpd-strong"><td>{t('variation.grandTotal')}</td><td className="num">{money(model.grandTotal)}</td></tr>
                </tbody>
            </table>
            <div className="bpd-box" style={{ marginTop: 12 }}>
                <div>
                    <b>{t('variation.schedule')}</b>{' '}
                    {days === 0 ? t('variation.noScheduleImpact') : t(days > 0 ? 'variation.extendDays' : 'variation.shortenDays', { days: Math.abs(days) })}
                </div>
                <div><b>{t('variation.billingLabel')}</b> {t(`variation.billing.${model.billing}`)}</div>
            </div>
            {model.evidence.length > 0 && (
                <>
                    <div className="bpd-h">{t('variation.evidence')}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {model.evidence.map(e => (
                            <div key={e.id} className="bpd-box" style={{ flex: e.isImage ? '0 1 200px' : '1 1 100%', minWidth: 0, breakInside: 'avoid' }}>
                                {e.url !== null && e.isImage && (
                                    <a href={e.url} target="_blank" rel="noopener noreferrer">
                                        <img src={e.url} alt={e.name} style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 2 }} />
                                    </a>
                                )}
                                {e.url !== null && !e.isImage && (
                                    <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: 'anywhere' }}>{e.name}</a>
                                )}
                                {e.note.trim() !== '' && <div className="bpd-pre">{e.note}</div>}
                                {e.takenAt !== null && <div style={{ fontSize: '9pt', color: '#4b5563' }}>{formatDateTime(e.takenAt, lang)}</div>}
                            </div>
                        ))}
                    </div>
                </>
            )}
            {(model.accepted || model.rejected) && (
                <div className="bpd-box" style={{ marginTop: 12 }}>
                    <div>
                        <b>{model.accepted ? t('variation.acceptedBy') : t('variation.rejectedBy')}</b> {model.acceptedByName}
                        {model.acceptedAt !== null && <> · {dateText(model.acceptedAt, lang, c.yearStyle)}</>}
                    </div>
                    {model.responseNote.trim() !== '' && <div className="bpd-pre">{model.responseNote}</div>}
                </div>
            )}
            {showSign && <SignBlock left={t('variation.approvedBy')} company={c} rightLabel={t('variation.proposedBy')} t={t} />}
            <Footer text={c.footer} />
        </div>
    );
}
