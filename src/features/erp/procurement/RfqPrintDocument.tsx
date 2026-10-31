'use client';

// ─── The RFQ on paper: what we ask a supplier to quote, with room to fill in price and terms ───
import { useMemo } from 'react';
import { formatQty } from '@/i18n/format';
import { documentTranslator } from '@/i18n/document-translator';
import { brandVars, DOC_CSS, dateText, Footer, Letterhead, MetaRow, PartyBox, SignBlock } from '../billing/DocParts';
import type { RfqPrintModel } from './print-model';

export function RfqPrintDocument({ model }: { model: RfqPrintModel }) {
    const t = useMemo(() => documentTranslator(model.language), [model.language]);
    const lang = model.language;
    const c = model.company;
    return (
        <div className="bpd" lang={lang} style={brandVars(c.brandColor)}>
            <style>{DOC_CSS}</style>
            <Letterhead
                company={c}
                title={t('rfq.title')}
                t={t}
                rows={(
                    <>
                        <MetaRow label={t('common.number')}>{model.number ?? t('rfq.draftNote')}</MetaRow>
                        <MetaRow label={t('common.date')}>{dateText(model.date, lang, c.yearStyle)}</MetaRow>
                    </>
                )}
            />
            <PartyBox
                label={t('rfq.to')}
                customer={model.supplier}
                t={t}
                extra={(
                    <div style={{ marginTop: model.supplier !== null ? 6 : 0 }}>
                        {model.supplier === null && <div>{t('rfq.toBlank')}</div>}
                        <div><b>{t('rfq.project')}</b> {model.projectName}</div>
                        {model.title.trim() !== '' && <div className="bpd-pre"><b>{t('rfq.subject')}</b> {model.title}</div>}
                        {model.deliveryAddress.trim() !== '' && <div className="bpd-pre"><b>{t('rfq.deliveryAddress')}</b> {model.deliveryAddress}</div>}
                        {model.dueDate !== null && <div><b>{t('rfq.dueDate')}</b> {dateText(model.dueDate, lang, c.yearStyle)}</div>}
                    </div>
                )}
            />
            <p style={{ margin: '12px 0 0' }}>{t('rfq.intro')}</p>
            <div className="bpd-scroll" style={{ marginTop: 8 }}>
                <table className="bpd-grid">
                    <thead>
                        <tr>
                            <th style={{ width: 28 }}>{t('rfq.no')}</th>
                            <th style={{ width: 64 }}>{t('rfq.code')}</th>
                            <th>{t('rfq.item')}</th>
                            <th style={{ width: 70 }}>{t('rfq.qty')}</th>
                            <th style={{ width: 50 }}>{t('rfq.unit')}</th>
                            <th style={{ width: 110 }}>{t('rfq.unitPrice')}</th>
                            <th style={{ width: 100 }}>{t('rfq.remark')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {model.lines.length === 0 && <tr><td colSpan={7} className="ctr">{t('rfq.noLines')}</td></tr>}
                        {model.lines.map((l, i) => (
                            <tr key={`${l.code}-${String(i)}`}>
                                <td className="ctr">{i + 1}</td>
                                <td>{l.code}</td>
                                <td className="bpd-pre">{l.text}</td>
                                <td className="num">{formatQty(l.qty, lang)}</td>
                                <td className="ctr">{l.unit}</td>
                                <td />
                                <td />
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="bpd-box" style={{ marginTop: 12 }}>
                <div><b>{t('rfq.conditions')}</b></div>
                <div>{t('rfq.vatNote')}</div>
                <div>{t('rfq.validity')}</div>
                <div>{t('rfq.delivery')}</div>
                <div>{t('rfq.payment')}</div>
            </div>
            <SignBlock left={t('rfq.signedBy')} company={c} rightLabel={t('rfq.requestedBy')} t={t} />
            <Footer text={c.footer} />
        </div>
    );
}
