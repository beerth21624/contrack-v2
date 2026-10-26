'use client';

// ─── What the crew reads about a job: buyer, place, dates, lines by section, terms, files, Q&A ───
import { useState } from 'react';
import { Alert, Button, Input, Tag } from 'antd';
import type { DeclineReason, DeclineRequest, GuestPackageDto, PackageLineDto } from '@/shared/contract';
import { DECLINE_REASONS } from '@/shared/contract';
import { tradeLabel } from '@/domain/subcontracting/trades';
import {
    DECLINE_REASON_TEXT, PRICING_MODE_TEXT, PROVIDER_TEXT, PROVISION_LABEL, SUPPLY_MODE_TEXT, deadlineInfo,
    formatDateTime, formatDay, formatPct, formatQty, locationText, materialByText, penaltyText, scheduleText,
} from '../format';
import { useNow } from '../now';
import { Fact, FileList, Section, Sheet } from './common';

/** Lines grouped by BOQ section (หมวด), in package order. */
export function groupLines(lines: readonly PackageLineDto[]): { title: string; lines: PackageLineDto[] }[] {
    const out: { title: string; lines: PackageLineDto[] }[] = [];
    for (const line of lines) {
        const title = line.sectionTitle === '' ? 'รายการอื่น' : line.sectionTitle;
        const last = out[out.length - 1];
        if (last?.title === title) last.lines.push(line);
        else out.push({ title, lines: [line] });
    }
    return out;
}

export function DeadlineText({ deadline }: { deadline: string }) {
    const now = useNow();
    const info = now === 0 ? null : deadlineInfo(deadline, now);
    return (
        <span>
            {formatDateTime(deadline)}
            {info !== null && (
                <span className={`ml-2 font-medium ${info.passed ? 'text-gray-500' : info.soon ? 'text-amber-600' : 'text-gray-700'}`}>
                    · {info.left}
                </span>
            )}
        </span>
    );
}

/** Title block: buyer, job, place, dates, deadline. */
export function PackageHeader({ pkg }: { pkg: GuestPackageDto }) {
    const where = locationText(pkg.location);
    const when = scheduleText(pkg.schedule);
    return (
        <Section>
            <div className="text-secondary text-gray-600">{pkg.buyerName}{pkg.projectName === '' ? '' : ` · ${pkg.projectName}`}</div>
            <h1 className="m-0 mt-1 text-card-title font-semibold text-gray-900">{pkg.title}</h1>
            <div className="mt-1 text-secondary text-gray-600">{tradeLabel(pkg.trade)}</div>
            <div className="mt-3">
                {where !== '' && <Fact label="สถานที่">{where}</Fact>}
                {when !== '' && <Fact label="ช่วงเวลา">{when}</Fact>}
                <Fact label="รูปแบบจ้าง">{SUPPLY_MODE_TEXT[pkg.supplyMode]}</Fact>
                <Fact label="ปิดรับราคา"><DeadlineText deadline={pkg.bidDeadline} /></Fact>
            </div>
        </Section>
    );
}

function LineRow({ line, changed, showMaterial }: { line: PackageLineDto; changed: boolean; showMaterial: boolean }) {
    return (
        <div className={`py-2.5 border-b border-gray-100 last:border-b-0 ${changed ? 'border-l-4 !border-l-amber-400 pl-2 -ml-1' : ''}`}>
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-body text-gray-900">{line.desc}</span>
                <span className="shrink-0 text-body font-medium text-gray-900 whitespace-nowrap">
                    {formatQty(line.qtyPriced)} <span className="text-gray-600 font-normal">{line.unit}</span>
                </span>
            </div>
            {(changed || showMaterial) && (
                <div className="mt-1 flex gap-2 flex-wrap">
                    {changed && <Tag color="warning" className="!m-0">แก้ไข</Tag>}
                    {showMaterial && <span className="text-caption text-gray-600">{materialByText(line.materialBy)}</span>}
                </div>
            )}
        </div>
    );
}

export function PackageLines({ pkg }: { pkg: GuestPackageDto }) {
    const changed = new Set(pkg.changedLineIdx);
    const groups = groupLines(pkg.lines);
    return (
        <div className="flex flex-col gap-3">
            {groups.map(g => (
                <Section key={g.title} title={`หมวด ${g.title}`} extra={<span className="text-caption text-gray-500">{g.lines.length} รายการ</span>}>
                    {g.lines.map(line => (
                        <LineRow key={line.idx} line={line} changed={changed.has(line.idx)} showMaterial={pkg.supplyMode === 'per_line'} />
                    ))}
                </Section>
            ))}
        </div>
    );
}

export function PackageTerms({ pkg }: { pkg: GuestPackageDto }) {
    const t = pkg.terms;
    return (
        <Section title="เงื่อนไข">
            <Fact label="วิธีเสนอราคา">{PRICING_MODE_TEXT[pkg.pricingMode]}</Fact>
            <Fact label="หักเงินประกันผลงาน">{t.retentionPct > 0 ? `${formatPct(t.retentionPct)} ของแต่ละงวด` : 'ไม่หัก'}</Fact>
            <Fact label="รับประกันผลงาน">{t.warrantyMonths > 0 ? `${String(t.warrantyMonths)} เดือน` : 'ไม่มี'}</Fact>
            <Fact label="ค่าปรับ">{penaltyText(t.penalty)}</Fact>
            {(Object.keys(PROVISION_LABEL) as (keyof typeof PROVISION_LABEL)[]).map(k => (
                <Fact key={k} label={PROVISION_LABEL[k]}>{PROVIDER_TEXT[t.provisions[k]]}</Fact>
            ))}
            <Fact label="ราคายืนถึง">{formatDay(pkg.priceValidUntil)}</Fact>
            {t.safetyNote !== '' && <p className="mt-3 mb-0 text-secondary text-gray-700 whitespace-pre-line">{t.safetyNote}</p>}
            {pkg.installments.length > 0 && (
                <div className="mt-4">
                    <div className="text-secondary font-medium text-gray-700 mb-1">งวดจ่ายเงินที่ผู้ว่าจ้างเสนอ</div>
                    {pkg.installments.map(i => (
                        <Fact key={i.no} label={`งวด ${String(i.no)} · ${formatPct(i.pct)}`}>{i.condition}</Fact>
                    ))}
                </div>
            )}
        </Section>
    );
}

export function QuestionsList({ pkg, onAsk }: { pkg: GuestPackageDto; onAsk?: () => void }) {
    return (
        <Section title="คำถาม-คำตอบ" extra={onAsk === undefined ? undefined : <Button onClick={onAsk}>ถามคำถาม</Button>}>
            {pkg.questions.length === 0 ? (
                <div className="text-secondary text-gray-500">ยังไม่มีคำถาม สงสัยอะไรถามผู้ว่าจ้างได้ ทุกทีมจะเห็นคำตอบ (ไม่เห็นชื่อคนถาม)</div>
            ) : (
                <div className="flex flex-col gap-3">
                    {pkg.questions.map(q => (
                        <div key={q.id} className="border-b border-gray-100 last:border-b-0 pb-3 last:pb-0">
                            <div className="text-body text-gray-900">ถาม: {q.question}{q.mine && <span className="ml-1 text-caption text-gray-500">(คุณถาม)</span>}</div>
                            <div className={`mt-1 text-body ${q.answer === null ? 'text-gray-500' : 'text-gray-700'}`}>
                                {q.answer === null ? 'รอผู้ว่าจ้างตอบ' : `ตอบ: ${q.answer}`}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Section>
    );
}

/** Banner of an addendum: what changed, lines marked "แก้ไข" below. */
export function AddendumBanner({ pkg }: { pkg: GuestPackageDto }) {
    if (pkg.version <= 1 || pkg.addendumNote === null) return null;
    const n = pkg.changedLineIdx.length;
    return (
        <Alert type="warning" showIcon
            title={`ผู้ว่าจ้างแก้ไขงานนี้ (ฉบับที่ ${String(pkg.version)})`}
            description={<>{pkg.addendumNote}{n > 0 && <div className="mt-1">รายการที่เปลี่ยน {n} รายการ มีป้าย &quot;แก้ไข&quot;</div>}</>} />
    );
}

/** Everything about the job, top to bottom (the guest page and the "รายละเอียดงาน" view of a signed-in crew). */
export function PackageDetails({ pkg, onAsk, showHeader = true }: { pkg: GuestPackageDto; onAsk?: () => void; showHeader?: boolean }) {
    return (
        <div className="flex flex-col gap-3">
            {showHeader && <PackageHeader pkg={pkg} />}
            <AddendumBanner pkg={pkg} />
            {pkg.description !== '' && (
                <Section title="รายละเอียด"><p className="m-0 text-body text-gray-800 whitespace-pre-line">{pkg.description}</p></Section>
            )}
            <PackageLines pkg={pkg} />
            <PackageTerms pkg={pkg} />
            {pkg.files.length > 0 && <Section title="แบบและไฟล์แนบ"><FileList files={pkg.files} /></Section>}
            <QuestionsList pkg={pkg} onAsk={onAsk} />
        </div>
    );
}

// ── Sheets: ask a question, decline (content inside the sheet so it starts empty each time) ──

function AskForm({ onSubmit, busy }: { onSubmit: (question: string) => void; busy: boolean }) {
    const [text, setText] = useState('');
    return (
        <div className="flex flex-col gap-3">
            <Input.TextArea value={text} onChange={e => setText(e.target.value)} autoSize={{ minRows: 3, maxRows: 8 }} maxLength={1000}
                placeholder="เช่น หน้างานมีไฟฟ้าใช้แล้วหรือยัง" />
            <div className="text-caption text-gray-500">ทุกทีมที่ได้รับเชิญจะเห็นคำถามและคำตอบ แต่ไม่เห็นว่าใครถาม</div>
            <Button type="primary" size="large" block disabled={text.trim() === ''} loading={busy} onClick={() => onSubmit(text.trim())}>ส่งคำถาม</Button>
        </div>
    );
}

export function AskQuestionSheet({ open, onClose, onSubmit, busy }: {
    open: boolean; onClose: () => void; onSubmit: (question: string) => void; busy: boolean;
}) {
    return (
        <Sheet open={open} onClose={onClose} title="ถามผู้ว่าจ้าง">
            <AskForm onSubmit={onSubmit} busy={busy} />
        </Sheet>
    );
}

function DeclineForm({ onSubmit, busy }: { onSubmit: (body: DeclineRequest) => void; busy: boolean }) {
    const [other, setOther] = useState(false);
    const [note, setNote] = useState('');
    const pick = (reason: DeclineReason) => {
        if (reason === 'other') { setOther(true); return; }
        onSubmit({ reason, note: '' });
    };
    if (other) {
        return (
            <div className="flex flex-col gap-3">
                <Input.TextArea value={note} onChange={e => setNote(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} maxLength={500}
                    placeholder="บอกผู้ว่าจ้างสั้น ๆ (ไม่บังคับ)" />
                <Button type="primary" size="large" block loading={busy} onClick={() => onSubmit({ reason: 'other', note: note.trim() })}>แจ้งผู้ว่าจ้าง</Button>
                <Button type="text" block onClick={() => setOther(false)}>กลับ</Button>
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-2">
            {DECLINE_REASONS.map(r => (
                <Button key={r} size="large" block disabled={busy} onClick={() => pick(r)}>{DECLINE_REASON_TEXT[r]}</Button>
            ))}
            <div className="mt-1 text-caption text-gray-500 text-center">แตะเหตุผลเดียว ระบบแจ้งผู้ว่าจ้างให้ทันที</div>
        </div>
    );
}

export function DeclineSheet({ open, onClose, onSubmit, busy }: {
    open: boolean; onClose: () => void; onSubmit: (body: DeclineRequest) => void; busy: boolean;
}) {
    return (
        <Sheet open={open} onClose={onClose} title="ไม่รับงานนี้ เพราะ…">
            <DeclineForm onSubmit={onSubmit} busy={busy} />
        </Sheet>
    );
}

/** Calm state once the job is decided or closed for bids. null while bids are open. */
export function closedReason(pkg: GuestPackageDto, nowMs: number): { title: string; tone: 'success' | 'default' } | null {
    if (pkg.outcome === 'won') return { title: 'คุณได้งานนี้ ผู้ว่าจ้างจะส่งสัญญาให้ยอมรับ', tone: 'success' };
    if (pkg.outcome === 'lost') return { title: 'ผู้ว่าจ้างเลือกทีมอื่น ขอบคุณที่เสนอราคา', tone: 'default' };
    if (pkg.outcome === 'cancelled' || pkg.packageStatus === 'cancelled') return { title: 'ผู้ว่าจ้างยกเลิกงานนี้', tone: 'default' };
    if (pkg.invitationStatus === 'withdrawn') return { title: 'ผู้ว่าจ้างถอนคำเชิญนี้แล้ว', tone: 'default' };
    if (pkg.invitationStatus === 'declined') return { title: 'คุณแจ้งไม่รับงานนี้แล้ว', tone: 'default' };
    if (pkg.packageStatus !== 'open') return { title: 'ปิดรับราคาแล้ว รอผู้ว่าจ้างตัดสินใจ', tone: 'default' };
    if (nowMs !== 0 && deadlineInfo(pkg.bidDeadline, nowMs).passed) return { title: 'ปิดรับราคาแล้ว', tone: 'default' };
    return null;
}
