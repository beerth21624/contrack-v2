'use client';

// ─── เงื่อนไข: what the vendor agreed to price against (read only; edits after sending go through an addendum) ───
import { useTranslations } from 'next-intl';
import type { BuyerPackageDto } from '@/shared/contract';
import {
    fmtDateTime, fmtDay, pct, pricingModeLabel, PROVISIONS, providerLabel, provisionLabel, sourcingModeLabel, supplyModeLabel, tradeName,
} from '../format';
import { penaltyText } from './helpers';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-x-4 gap-y-0.5 py-2 border-t border-gray-100 first:border-t-0">
            <dt className="text-secondary text-gray-600">{label}</dt>
            <dd className="m-0 text-gray-900 min-w-0 break-words">{children}</dd>
        </div>
    );
}

const empty = <span className="text-gray-400">–</span>;

export function TermsTab({ pkg }: { pkg: BuyerPackageDto }) {
    const tx = useTranslations('subcontracting');
    const t = pkg.terms;
    const s = pkg.schedule;
    const where = [pkg.location.district, pkg.location.province].filter(x => x !== '').join(' ');
    const provisions = PROVISIONS
        .map(k => `${provisionLabel(k, tx)}: ${providerLabel(t.provisions[k], tx)}`).join(' · ');
    return (
        <dl className="m-0">
            <Row label={tx('buyer.termsTab.trade')}>{tradeName(pkg.trade)}</Row>
            <Row label={tx('buyer.termsTab.contractType')}>{supplyModeLabel(pkg.supplyMode)}</Row>
            <Row label={tx('buyer.termsTab.quoteBasis')}>{pricingModeLabel(pkg.pricingMode)}</Row>
            <Row label={tx('buyer.termsTab.sourcingMethod')}>{sourcingModeLabel(pkg.sourcingMode)}</Row>
            <Row label={tx('buyer.termsTab.descriptionForRecipients')}>{pkg.description === '' ? empty : <span className="whitespace-pre-line">{pkg.description}</span>}</Row>
            <Row label={tx('buyer.termsTab.schedule')}>
                {s.start === null && s.finish === null && s.days === null ? tx('buyer.termsTab.notSet') : (
                    <>
                        {s.start !== null ? fmtDay(s.start) : tx('buyer.termsTab.notSet')} – {s.finish !== null ? fmtDay(s.finish) : tx('buyer.termsTab.notSet')}
                        {s.days !== null && <span className="text-gray-500"> {tx('buyer.termsTab.about')} {s.days} {tx('buyer.termsTab.days')}</span>}
                    </>
                )}
            </Row>
            <Row label={tx('buyer.termsTab.paymentStages')}>
                <ol className="m-0 pl-4">
                    {pkg.installments.map(i => <li key={i.no}><span className="tabular-nums">{pct(i.pct)}</span> · {i.condition}</li>)}
                </ol>
            </Row>
            <Row label={tx('buyer.termsTab.retention')}>{pct(t.retentionPct)} {tx('buyer.termsTab.ofEachStage')}</Row>
            <Row label={tx('buyer.termsTab.warrantyPeriod')}>{t.warrantyMonths > 0 ? tx('buyer.termsTab.months', { warrantyMonths: t.warrantyMonths }) : tx('buyer.termsTab.none')}</Row>
            <Row label={tx('buyer.termsTab.latePenalty')}>{penaltyText(t.penalty)}</Row>
            <Row label={tx('buyer.termsTab.waterPowerLodgingScaffolding')}>{provisions}</Row>
            <Row label={tx('buyer.termsTab.safety')}>{t.safetyNote === '' ? empty : <span className="whitespace-pre-line">{t.safetyNote}</span>}</Row>
            <Row label={tx('buyer.termsTab.questionsForRecipients')}>
                {t.questions.length === 0 ? empty : <ol className="m-0 pl-4">{t.questions.map(q => <li key={q}>{q}</li>)}</ol>}
            </Row>
            <Row label={tx('buyer.termsTab.location')}>
                {where === '' ? empty : where}
                {pkg.location.address !== '' && <div className="text-secondary text-gray-500">{pkg.location.address}</div>}
            </Row>
            <Row label={tx('buyer.termsTab.ownerNameFullAddress')}>{pkg.hideOwnerIdentity ? tx('buyer.termsTab.hiddenUntilTheWorkIs') : tx('buyer.termsTab.shownToRecipients')}</Row>
            <Row label={tx('buyer.termsTab.bidsClose')}>{fmtDateTime(pkg.bidDeadline)}</Row>
            <Row label={tx('buyer.termsTab.priceValidUntil')}>{fmtDay(pkg.priceValidUntil)}</Row>
            {pkg.cancelReason !== null && <Row label={tx('buyer.termsTab.reasonForCancelling')}>{pkg.cancelReason}</Row>}
        </dl>
    );
}
