'use client';

// ─── What the invited crew will see (no estimate anywhere: the buyer checks nothing leaks before sending) ───
import { useTranslations } from 'next-intl';
import { Button, Modal } from 'antd';
import type { CreatePackageRequest } from '@/shared/contract';
import { CUSTOM_SECTION_TITLE } from '@/domain/subcontracting/snapshot';
import {
    pricingModeLabel, PROVISIONS, providerLabel, provisionLabel, supplyModeLabel, fmtDateTime, fmtDay, num, pct, qty,
} from '../format';
import { scText, type ScT } from '../text';
import type { WizardRow } from './state';

interface PreviewLine {
    key: string;
    group: string;
    desc: string;
    unit: string;
    qtyNet: number;
    qtyGross: number | null;
}

/** Lines in the order the vendor sees them (BOQ rows, then typed lines), without any estimate. */
export function previewLines(request: Pick<CreatePackageRequest, 'lineKeys' | 'customLines'>, rows: readonly WizardRow[], t: ScT = scText()): PreviewLine[] {
    const byKey = new Map(rows.map(r => [r.row.key, r]));
    const out: PreviewLine[] = [];
    for (const k of request.lineKeys) {
        const r = byKey.get(k);
        if (r === undefined) continue;
        out.push({ key: k, group: t('buyer.preview.sectionLabel', { section: r.section, sectionTitle: r.sectionTitle }), desc: r.row.desc, unit: r.row.unit, qtyNet: r.row.qty, qtyGross: r.row.grossQty });
    }
    request.customLines.forEach((c, i) => {
        out.push({ key: `c${String(i)}`, group: CUSTOM_SECTION_TITLE, desc: c.desc, unit: c.unit, qtyNet: c.qty, qtyGross: null });
    });
    return out;
}

const orDash = (s: string) => (s === '' ? '–' : s);

function penaltyText(p: CreatePackageRequest['terms']['penalty'], t: ScT): string {
    if (p.kind === 'none') return t('buyer.preview.penaltyNone');
    if (p.kind === 'per_day') return t('buyer.preview.penaltyPerDay', { amount: num(p.amount, 2) });
    return t('buyer.preview.penaltyPctPerDay', { rate: pct(p.rate) });
}

export function PreviewModal({ open, onClose, request, buyerName, projectName, rows }: {
    open: boolean;
    onClose: () => void;
    request: CreatePackageRequest;
    buyerName: string;
    projectName: string;
    rows: readonly WizardRow[];
}) {
    const t = useTranslations('subcontracting');
    const lines = previewLines(request, rows);
    const loc = request.location;
    const place = [loc.district, loc.province].filter(s => s !== '').join(' ');
    const s = request.schedule;

    return (
        <Modal open={open} onCancel={onClose} width={720} destroyOnHidden title={t('buyer.preview.whatRecipientsSee')}
            footer={<Button onClick={onClose}>{t('buyer.preview.close')}</Button>}>
            <div className="text-caption text-gray-500 mb-3">{t('buyer.preview.previewOnlyRecipientsDoNot')}</div>
            <div className="border border-gray-200 rounded-card p-4 flex flex-col gap-4 bg-page">
                <div>
                    <div className="text-secondary text-gray-500">{buyerName} {t('buyer.preview.invitesYouToBid')}</div>
                    <div className="text-card-title font-semibold text-gray-900">{request.title}</div>
                    {!request.hideOwnerIdentity && projectName !== '' && <div className="text-gray-600">{projectName}</div>}
                    <div className="text-secondary text-gray-600 mt-1">
                        {request.hideOwnerIdentity ? (place === '' ? t('buyer.preview.locationIsSharedAfterThe') : place) : orDash([loc.address, place].filter(x => x !== '').join(' '))}
                    </div>
                </div>
                {request.description !== '' && <p className="m-0 whitespace-pre-wrap">{request.description}</p>}

                <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 m-0">
                    <dt className="text-gray-500">{t('buyer.preview.bidsClose')}</dt><dd className="m-0">{fmtDateTime(request.bidDeadline)}</dd>
                    <dt className="text-gray-500">{t('buyer.preview.priceValidUntil')}</dt><dd className="m-0">{fmtDay(request.priceValidUntil)}</dd>
                    <dt className="text-gray-500">{t('buyer.preview.workPeriod')}</dt>
                    <dd className="m-0">
                        {s.start === null && s.finish === null ? t('buyer.preview.notSet') : `${orDash(fmtDay(s.start))} – ${orDash(fmtDay(s.finish))}`}
                        {s.days !== null ? t('buyer.preview.days', { days: s.days }) : ''}
                    </dd>
                    <dt className="text-gray-500">{t('buyer.preview.contractType')}</dt><dd className="m-0">{supplyModeLabel(request.supplyMode)}</dd>
                    <dt className="text-gray-500">{t('buyer.preview.quoteBasis')}</dt><dd className="m-0">{pricingModeLabel(request.pricingMode)}</dd>
                </dl>

                <div>
                    <div className="font-medium text-gray-900 mb-1">{t('buyer.preview.workItems')}</div>
                    <table className="w-full border-collapse">
                        <tbody>
                            {lines.flatMap((l, i) => {
                                const head = i === 0 || lines[i - 1]?.group !== l.group ? (
                                    <tr key={`g-${l.key}`}><td colSpan={3} className="pt-2 pb-1 text-secondary font-medium text-gray-600">{l.group}</td></tr>
                                ) : null;
                                const row = (
                                    <tr key={l.key} className="border-b border-gray-100">
                                        <td className="py-1.5 pr-3">{l.desc}</td>
                                        <td className="py-1.5 text-right tabular-nums whitespace-nowrap">
                                            {qty(l.qtyNet)}
                                            {l.qtyGross !== null && <div className="text-caption text-gray-500">{t('buyer.preview.includingAllowance')} {qty(l.qtyGross)}</div>}
                                        </td>
                                        <td className="py-1.5 pl-2 w-16 text-gray-600">{l.unit}</td>
                                    </tr>
                                );
                                return head === null ? [row] : [head, row];
                            })}
                        </tbody>
                    </table>
                </div>

                <div>
                    <div className="font-medium text-gray-900 mb-1">{t('buyer.preview.terms')}</div>
                    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 m-0">
                        <dt className="text-gray-500">{t('buyer.preview.retention')}</dt><dd className="m-0">{pct(request.terms.retentionPct)}</dd>
                        <dt className="text-gray-500">{t('buyer.preview.warrantyPeriod')}</dt><dd className="m-0">{request.terms.warrantyMonths} {t('buyer.preview.months')}</dd>
                        <dt className="text-gray-500">{t('buyer.preview.latePenalty')}</dt><dd className="m-0">{penaltyText(request.terms.penalty, t)}</dd>
                        {PROVISIONS.map(k => [
                            <dt key={`t${k}`} className="text-gray-500">{provisionLabel(k, t)}</dt>,
                            <dd key={`d${k}`} className="m-0">{providerLabel(request.terms.provisions[k], t)}</dd>,
                        ])}
                    </dl>
                    {request.terms.safetyNote !== '' && <p className="mt-2 mb-0 whitespace-pre-wrap">{request.terms.safetyNote}</p>}
                </div>

                <div>
                    <div className="font-medium text-gray-900 mb-1">{t('buyer.preview.paymentStages')}</div>
                    <ol className="m-0 pl-5">
                        {request.installments.map(i => <li key={i.no}>{pct(i.pct)} · {i.condition}</li>)}
                    </ol>
                </div>

                {request.terms.questions.length > 0 && (
                    <div>
                        <div className="font-medium text-gray-900 mb-1">{t('buyer.preview.questionsToAnswer')}</div>
                        <ol className="m-0 pl-5">{request.terms.questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
                    </div>
                )}
            </div>
        </Modal>
    );
}
