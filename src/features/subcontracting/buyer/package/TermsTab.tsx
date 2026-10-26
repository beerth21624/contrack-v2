'use client';

// ─── เงื่อนไข: what the vendor agreed to price against (read only; edits after sending go through an addendum) ───
import type { BuyerPackageDto } from '@/shared/contract';
import { tradeLabel } from '@/domain/subcontracting/trades';
import {
    fmtDateTime, fmtDay, pct, PRICING_MODE_LABEL, PROVIDER_LABEL, PROVISION_LABEL, SOURCING_MODE_LABEL, SUPPLY_MODE_LABEL,
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
    const t = pkg.terms;
    const s = pkg.schedule;
    const where = [pkg.location.district, pkg.location.province].filter(x => x !== '').join(' ');
    const provisions = (Object.keys(PROVISION_LABEL) as (keyof typeof PROVISION_LABEL)[])
        .map(k => `${PROVISION_LABEL[k]}: ${PROVIDER_LABEL[t.provisions[k]]}`).join(' · ');
    return (
        <dl className="m-0">
            <Row label="ประเภทงาน">{tradeLabel(pkg.trade)}</Row>
            <Row label="รูปแบบจ้าง">{SUPPLY_MODE_LABEL[pkg.supplyMode]}</Row>
            <Row label="เสนอราคาแบบ">{PRICING_MODE_LABEL[pkg.pricingMode]}</Row>
            <Row label="วิธีจัดหา">{SOURCING_MODE_LABEL[pkg.sourcingMode]}</Row>
            <Row label="รายละเอียดถึงผู้รับ">{pkg.description === '' ? empty : <span className="whitespace-pre-line">{pkg.description}</span>}</Row>
            <Row label="กำหนดเวลา">
                {s.start === null && s.finish === null && s.days === null ? 'ยังไม่กำหนด' : (
                    <>
                        {s.start !== null ? fmtDay(s.start) : 'ยังไม่กำหนด'} – {s.finish !== null ? fmtDay(s.finish) : 'ยังไม่กำหนด'}
                        {s.days !== null && <span className="text-gray-500"> · ประมาณ {s.days} วัน</span>}
                    </>
                )}
            </Row>
            <Row label="งวดจ่าย">
                <ol className="m-0 pl-4">
                    {pkg.installments.map(i => <li key={i.no}><span className="tabular-nums">{pct(i.pct)}</span> · {i.condition}</li>)}
                </ol>
            </Row>
            <Row label="เงินประกันผลงาน">{pct(t.retentionPct)} ของแต่ละงวด</Row>
            <Row label="ระยะประกันผลงาน">{t.warrantyMonths > 0 ? `${String(t.warrantyMonths)} เดือน` : 'ไม่มี'}</Row>
            <Row label="ค่าปรับล่าช้า">{penaltyText(t.penalty)}</Row>
            <Row label="น้ำ ไฟ ที่พัก นั่งร้าน">{provisions}</Row>
            <Row label="ความปลอดภัย">{t.safetyNote === '' ? empty : <span className="whitespace-pre-line">{t.safetyNote}</span>}</Row>
            <Row label="คำถามถึงผู้รับ">
                {t.questions.length === 0 ? empty : <ol className="m-0 pl-4">{t.questions.map(q => <li key={q}>{q}</li>)}</ol>}
            </Row>
            <Row label="สถานที่">
                {where === '' ? empty : where}
                {pkg.location.address !== '' && <div className="text-secondary text-gray-500">{pkg.location.address}</div>}
            </Row>
            <Row label="ชื่อเจ้าของบ้าน/ที่อยู่ละเอียด">{pkg.hideOwnerIdentity ? 'ซ่อนจนกว่าจะตกลงจ้าง' : 'แสดงให้ผู้รับเห็น'}</Row>
            <Row label="ปิดรับราคา">{fmtDateTime(pkg.bidDeadline)}</Row>
            <Row label="ราคายืนถึง">{fmtDay(pkg.priceValidUntil)}</Row>
            {pkg.cancelReason !== null && <Row label="เหตุผลที่ยกเลิก">{pkg.cancelReason}</Row>}
        </dl>
    );
}
