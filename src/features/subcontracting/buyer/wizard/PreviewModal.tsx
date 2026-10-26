'use client';

// ─── What the invited crew will see (no estimate anywhere: the buyer checks nothing leaks before sending) ───
import { Button, Modal } from 'antd';
import type { CreatePackageRequest } from '@/shared/contract';
import { CUSTOM_SECTION_TITLE } from '@/domain/subcontracting/snapshot';
import {
    PRICING_MODE_LABEL, PROVIDER_LABEL, PROVISION_LABEL, SUPPLY_MODE_LABEL, fmtDateTime, fmtDay, pct, qty,
} from '../format';
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
export function previewLines(request: Pick<CreatePackageRequest, 'lineKeys' | 'customLines'>, rows: readonly WizardRow[]): PreviewLine[] {
    const byKey = new Map(rows.map(r => [r.row.key, r]));
    const out: PreviewLine[] = [];
    for (const k of request.lineKeys) {
        const r = byKey.get(k);
        if (r === undefined) continue;
        out.push({ key: k, group: `หมวด ${String(r.section)} ${r.sectionTitle}`, desc: r.row.desc, unit: r.row.unit, qtyNet: r.row.qty, qtyGross: r.row.grossQty });
    }
    request.customLines.forEach((c, i) => {
        out.push({ key: `c${String(i)}`, group: CUSTOM_SECTION_TITLE, desc: c.desc, unit: c.unit, qtyNet: c.qty, qtyGross: null });
    });
    return out;
}

const orDash = (s: string) => (s === '' ? '–' : s);

function penaltyText(p: CreatePackageRequest['terms']['penalty']): string {
    if (p.kind === 'none') return 'ไม่มี';
    if (p.kind === 'per_day') return `${p.amount.toLocaleString('th-TH')} บาท/วัน`;
    return `${pct(p.rate)} ของมูลค่า/วัน`;
}

export function PreviewModal({ open, onClose, request, buyerName, projectName, rows }: {
    open: boolean;
    onClose: () => void;
    request: CreatePackageRequest;
    buyerName: string;
    projectName: string;
    rows: readonly WizardRow[];
}) {
    const lines = previewLines(request, rows);
    const loc = request.location;
    const place = [loc.district, loc.province].filter(s => s !== '').join(' ');
    const s = request.schedule;

    return (
        <Modal open={open} onCancel={onClose} width={720} destroyOnHidden title="หน้าที่ผู้รับเห็น"
            footer={<Button onClick={onClose}>ปิด</Button>}>
            <div className="text-caption text-gray-500 mb-3">ตัวอย่างเท่านั้น ผู้รับไม่เห็นราคาประเมินของเรา</div>
            <div className="border border-gray-200 rounded-card p-4 flex flex-col gap-4 bg-page">
                <div>
                    <div className="text-secondary text-gray-500">{buyerName} ขอเชิญเสนอราคา</div>
                    <div className="text-card-title font-semibold text-gray-900">{request.title}</div>
                    {!request.hideOwnerIdentity && projectName !== '' && <div className="text-gray-600">{projectName}</div>}
                    <div className="text-secondary text-gray-600 mt-1">
                        {request.hideOwnerIdentity ? (place === '' ? 'สถานที่แจ้งหลังตกลงจ้าง' : place) : orDash([loc.address, place].filter(x => x !== '').join(' '))}
                    </div>
                </div>
                {request.description !== '' && <p className="m-0 whitespace-pre-wrap">{request.description}</p>}

                <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 m-0">
                    <dt className="text-gray-500">ปิดรับราคา</dt><dd className="m-0">{fmtDateTime(request.bidDeadline)}</dd>
                    <dt className="text-gray-500">ราคายืนถึง</dt><dd className="m-0">{fmtDay(request.priceValidUntil)}</dd>
                    <dt className="text-gray-500">ช่วงทำงาน</dt>
                    <dd className="m-0">
                        {s.start === null && s.finish === null ? 'ยังไม่กำหนด' : `${orDash(fmtDay(s.start))} – ${orDash(fmtDay(s.finish))}`}
                        {s.days !== null ? ` (${String(s.days)} วัน)` : ''}
                    </dd>
                    <dt className="text-gray-500">รูปแบบจ้าง</dt><dd className="m-0">{SUPPLY_MODE_LABEL[request.supplyMode]}</dd>
                    <dt className="text-gray-500">เสนอราคาแบบ</dt><dd className="m-0">{PRICING_MODE_LABEL[request.pricingMode]}</dd>
                </dl>

                <div>
                    <div className="font-medium text-gray-900 mb-1">รายการงาน</div>
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
                                            {l.qtyGross !== null && <div className="text-caption text-gray-500">รวมเผื่อ {qty(l.qtyGross)}</div>}
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
                    <div className="font-medium text-gray-900 mb-1">เงื่อนไข</div>
                    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 m-0">
                        <dt className="text-gray-500">เงินประกันผลงาน</dt><dd className="m-0">{pct(request.terms.retentionPct)}</dd>
                        <dt className="text-gray-500">ระยะประกันผลงาน</dt><dd className="m-0">{request.terms.warrantyMonths} เดือน</dd>
                        <dt className="text-gray-500">ค่าปรับล่าช้า</dt><dd className="m-0">{penaltyText(request.terms.penalty)}</dd>
                        {(['water', 'power', 'lodging', 'scaffolding'] as const).map(k => [
                            <dt key={`t${k}`} className="text-gray-500">{PROVISION_LABEL[k]}</dt>,
                            <dd key={`d${k}`} className="m-0">{PROVIDER_LABEL[request.terms.provisions[k]]}</dd>,
                        ])}
                    </dl>
                    {request.terms.safetyNote !== '' && <p className="mt-2 mb-0 whitespace-pre-wrap">{request.terms.safetyNote}</p>}
                </div>

                <div>
                    <div className="font-medium text-gray-900 mb-1">งวดจ่าย</div>
                    <ol className="m-0 pl-5">
                        {request.installments.map(i => <li key={i.no}>{pct(i.pct)} · {i.condition}</li>)}
                    </ol>
                </div>

                {request.terms.questions.length > 0 && (
                    <div>
                        <div className="font-medium text-gray-900 mb-1">คำถามที่ต้องตอบ</div>
                        <ol className="m-0 pl-5">{request.terms.questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
                    </div>
                )}
            </div>
        </Modal>
    );
}
