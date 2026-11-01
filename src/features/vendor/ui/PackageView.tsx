'use client';

// ─── What the crew reads about a job: buyer, place, dates, lines by section, terms, files, Q&A ───
import { useState } from 'react';
import { Alert, Button, Input, Tag } from 'antd';
import { useLocale, useTranslations } from 'next-intl';
import type { DeclineReason, DeclineRequest, GuestPackageDto, PackageLineDto } from '@/shared/contract';
import { DECLINE_REASONS } from '@/shared/contract';
import { tradeName } from '@/features/subcontracting/buyer/format';
import {
    declineReasonText, deadlineInfo, formatDateTime, formatDay, formatPct, formatQty, locationText, materialByText,
    penaltyText, pricingModeText, providerText, provisionLabel, scheduleText, supplyModeText,
} from '../format';
import { vText, type VT } from '../text';
import { useNow } from '../now';
import { Fact, FileList, Section, Sheet } from './common';

/** Lines grouped by BOQ section (หมวด), in package order. */
export function groupLines(lines: readonly PackageLineDto[], t: VT = vText()): { title: string; lines: PackageLineDto[] }[] {
    const out: { title: string; lines: PackageLineDto[] }[] = [];
    for (const line of lines) {
        const title = line.sectionTitle === '' ? t('package.otherItems') : line.sectionTitle;
        const last = out[out.length - 1];
        if (last?.title === title) last.lines.push(line);
        else out.push({ title, lines: [line] });
    }
    return out;
}

export function DeadlineText({ deadline }: { deadline: string }) {
    const t = useTranslations('vendor');
    const locale = useLocale();
    const now = useNow();
    const info = now === 0 ? null : deadlineInfo(deadline, now, t);
    return (
        <span>
            {formatDateTime(deadline, locale)}
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
    const t = useTranslations('vendor');
    const sc = useTranslations('subcontracting');
    const locale = useLocale();
    const where = locationText(pkg.location, t, locale);
    const when = scheduleText(pkg.schedule, t, locale);
    return (
        <Section>
            <div className="text-secondary text-gray-600">{pkg.buyerName}{pkg.projectName === '' ? '' : ` · ${pkg.projectName}`}</div>
            <h1 className="m-0 mt-1 text-card-title font-semibold text-gray-900">{pkg.title}</h1>
            <div className="mt-1 text-secondary text-gray-600">{tradeName(pkg.trade, sc)}</div>
            <div className="mt-3">
                {where !== '' && <Fact label={t('package.place')}>{where}</Fact>}
                {when !== '' && <Fact label={t('package.period')}>{when}</Fact>}
                <Fact label={t('package.hireMode')}>{supplyModeText(pkg.supplyMode, t)}</Fact>
                <Fact label={t('package.bidDeadline')}><DeadlineText deadline={pkg.bidDeadline} /></Fact>
            </div>
        </Section>
    );
}

function LineRow({ line, changed, showMaterial }: { line: PackageLineDto; changed: boolean; showMaterial: boolean }) {
    const t = useTranslations('vendor');
    const locale = useLocale();
    return (
        <div className={`py-2.5 border-b border-gray-100 last:border-b-0 ${changed ? 'border-l-4 !border-l-amber-400 pl-2 -ml-1' : ''}`}>
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-body text-gray-900">{line.desc}</span>
                <span className="shrink-0 text-body font-medium text-gray-900 whitespace-nowrap">
                    {formatQty(line.qtyPriced, locale)} <span className="text-gray-600 font-normal">{line.unit}</span>
                </span>
            </div>
            {(changed || showMaterial) && (
                <div className="mt-1 flex gap-2 flex-wrap">
                    {changed && <Tag color="warning" className="!m-0">{t('package.changed')}</Tag>}
                    {showMaterial && <span className="text-caption text-gray-600">{materialByText(line.materialBy, t)}</span>}
                </div>
            )}
        </div>
    );
}

export function PackageLines({ pkg }: { pkg: GuestPackageDto }) {
    const t = useTranslations('vendor');
    const changed = new Set(pkg.changedLineIdx);
    const groups = groupLines(pkg.lines, t);
    return (
        <div className="flex flex-col gap-3">
            {groups.map(g => (
                <Section key={g.title} title={t('package.section', { title: g.title })} extra={<span className="text-caption text-gray-500">{t('package.itemCount', { n: g.lines.length })}</span>}>
                    {g.lines.map(line => (
                        <LineRow key={line.idx} line={line} changed={changed.has(line.idx)} showMaterial={pkg.supplyMode === 'per_line'} />
                    ))}
                </Section>
            ))}
        </div>
    );
}

export function PackageTerms({ pkg }: { pkg: GuestPackageDto }) {
    const t = useTranslations('vendor');
    const locale = useLocale();
    const terms = pkg.terms;
    return (
        <Section title={t('package.terms')}>
            <Fact label={t('package.pricingMethod')}>{pricingModeText(pkg.pricingMode, t)}</Fact>
            <Fact label={t('package.retention')}>{terms.retentionPct > 0 ? t('package.retentionPerInstallment', { pct: formatPct(terms.retentionPct, locale) }) : t('package.noRetention')}</Fact>
            <Fact label={t('package.warranty')}>{terms.warrantyMonths > 0 ? t('package.warrantyMonths', { n: terms.warrantyMonths }) : t('package.noWarranty')}</Fact>
            <Fact label={t('package.penalty')}>{penaltyText(terms.penalty, t, locale)}</Fact>
            {(['water', 'power', 'lodging', 'scaffolding'] as const).map(k => (
                <Fact key={k} label={provisionLabel(k, t)}>{providerText(terms.provisions[k], t)}</Fact>
            ))}
            <Fact label={t('package.priceValidUntil')}>{formatDay(pkg.priceValidUntil, locale)}</Fact>
            {terms.safetyNote !== '' && <p className="mt-3 mb-0 text-secondary text-gray-700 whitespace-pre-line">{terms.safetyNote}</p>}
            {pkg.installments.length > 0 && (
                <div className="mt-4">
                    <div className="text-secondary font-medium text-gray-700 mb-1">{t('package.proposedInstallments')}</div>
                    {pkg.installments.map(i => (
                        <Fact key={i.no} label={t('package.installmentLabel', { no: i.no, pct: formatPct(i.pct, locale) })}>{i.condition}</Fact>
                    ))}
                </div>
            )}
        </Section>
    );
}

export function QuestionsList({ pkg, onAsk }: { pkg: GuestPackageDto; onAsk?: () => void }) {
    const t = useTranslations('vendor');
    return (
        <Section title={t('package.qa')} extra={onAsk === undefined ? undefined : <Button onClick={onAsk}>{t('package.askQuestion')}</Button>}>
            {pkg.questions.length === 0 ? (
                <div className="text-secondary text-gray-500">{t('package.noQuestions')}</div>
            ) : (
                <div className="flex flex-col gap-3">
                    {pkg.questions.map(q => (
                        <div key={q.id} className="border-b border-gray-100 last:border-b-0 pb-3 last:pb-0">
                            <div className="text-body text-gray-900">{t('package.questionPrefix')} {q.question}{q.mine && <span className="ml-1 text-caption text-gray-500">{t('package.askedByYou')}</span>}</div>
                            <div className={`mt-1 text-body ${q.answer === null ? 'text-gray-500' : 'text-gray-700'}`}>
                                {q.answer === null ? t('package.awaitingAnswer') : t('package.answer', { text: q.answer })}
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
    const t = useTranslations('vendor');
    if (pkg.version <= 1 || pkg.addendumNote === null) return null;
    const n = pkg.changedLineIdx.length;
    return (
        <Alert type="warning" showIcon
            title={t('package.addendumTitle', { version: pkg.version })}
            description={<>{pkg.addendumNote}{n > 0 && <div className="mt-1">{t('package.addendumChanged', { n })}</div>}</>} />
    );
}

/** Everything about the job, top to bottom (the guest page and the "รายละเอียดงาน" view of a signed-in crew). */
export function PackageDetails({ pkg, onAsk, showHeader = true }: { pkg: GuestPackageDto; onAsk?: () => void; showHeader?: boolean }) {
    const t = useTranslations('vendor');
    return (
        <div className="flex flex-col gap-3">
            {showHeader && <PackageHeader pkg={pkg} />}
            <AddendumBanner pkg={pkg} />
            {pkg.description !== '' && (
                <Section title={t('package.details')}><p className="m-0 text-body text-gray-800 whitespace-pre-line">{pkg.description}</p></Section>
            )}
            <PackageLines pkg={pkg} />
            <PackageTerms pkg={pkg} />
            {pkg.files.length > 0 && <Section title={t('package.files')}><FileList files={pkg.files} /></Section>}
            <QuestionsList pkg={pkg} onAsk={onAsk} />
        </div>
    );
}

// ── Sheets: ask a question, decline (content inside the sheet so it starts empty each time) ──

function AskForm({ onSubmit, busy }: { onSubmit: (question: string) => void; busy: boolean }) {
    const t = useTranslations('vendor');
    const [text, setText] = useState('');
    return (
        <div className="flex flex-col gap-3">
            <Input.TextArea value={text} onChange={e => setText(e.target.value)} autoSize={{ minRows: 3, maxRows: 8 }} maxLength={1000}
                placeholder={t('package.askPlaceholder')} />
            <div className="text-caption text-gray-500">{t('package.askHint')}</div>
            <Button type="primary" size="large" block disabled={text.trim() === ''} loading={busy} onClick={() => onSubmit(text.trim())}>{t('package.sendQuestion')}</Button>
        </div>
    );
}

export function AskQuestionSheet({ open, onClose, onSubmit, busy }: {
    open: boolean; onClose: () => void; onSubmit: (question: string) => void; busy: boolean;
}) {
    const t = useTranslations('vendor');
    return (
        <Sheet open={open} onClose={onClose} title={t('package.askClient')}>
            <AskForm onSubmit={onSubmit} busy={busy} />
        </Sheet>
    );
}

function DeclineForm({ onSubmit, busy }: { onSubmit: (body: DeclineRequest) => void; busy: boolean }) {
    const t = useTranslations('vendor');
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
                    placeholder={t('package.declineNote')} />
                <Button type="primary" size="large" block loading={busy} onClick={() => onSubmit({ reason: 'other', note: note.trim() })}>{t('package.notifyClient')}</Button>
                <Button type="text" block onClick={() => setOther(false)}>{t('package.back')}</Button>
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-2">
            {DECLINE_REASONS.map(r => (
                <Button key={r} size="large" block disabled={busy} onClick={() => pick(r)}>{declineReasonText(r, t)}</Button>
            ))}
            <div className="mt-1 text-caption text-gray-500 text-center">{t('package.declineHint')}</div>
        </div>
    );
}

export function DeclineSheet({ open, onClose, onSubmit, busy }: {
    open: boolean; onClose: () => void; onSubmit: (body: DeclineRequest) => void; busy: boolean;
}) {
    const t = useTranslations('vendor');
    return (
        <Sheet open={open} onClose={onClose} title={t('package.declineTitle')}>
            <DeclineForm onSubmit={onSubmit} busy={busy} />
        </Sheet>
    );
}

/** Calm state once the job is decided or closed for bids. null while bids are open. */
export function closedReason(pkg: GuestPackageDto, nowMs: number, t: VT = vText()): { title: string; tone: 'success' | 'default' } | null {
    if (pkg.outcome === 'won') return { title: t('package.closed.won'), tone: 'success' };
    if (pkg.outcome === 'lost') return { title: t('package.closed.lost'), tone: 'default' };
    if (pkg.outcome === 'cancelled' || pkg.packageStatus === 'cancelled') return { title: t('package.closed.cancelled'), tone: 'default' };
    if (pkg.invitationStatus === 'withdrawn') return { title: t('package.closed.withdrawn'), tone: 'default' };
    if (pkg.invitationStatus === 'declined') return { title: t('package.closed.declined'), tone: 'default' };
    if (pkg.packageStatus !== 'open') return { title: t('package.closed.reviewing'), tone: 'default' };
    if (nowMs !== 0 && deadlineInfo(pkg.bidDeadline, nowMs, t).passed) return { title: t('package.closed.closed'), tone: 'default' };
    return null;
}
