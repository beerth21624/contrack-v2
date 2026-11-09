'use client';

// ─── Review flags UI (dev mode): flag button + dialog on a BOQ line / step output, and the list on the BOQ page ───
// Renders nothing unless dev mode is active. A flag names its value by item no + description (BOQ) or step + output
// name; never a line key.
import { useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Input, Modal, Popconfirm, Tag, Tooltip } from 'antd';
import { FlagFilled, FlagOutlined } from '@ant-design/icons';
import type { BoqExplanation } from '@/domain/trace';
import type { ReviewFlag, ReviewFlagTarget } from '@/domain/review-flags';
import { REVIEW_FLAG_LIMITS } from '@/domain/review-flags';
import { useFormat } from '@/i18n/useFormat';
import { useMe } from '@/features/cloud/query/hooks';
import { useDevMode } from './useDevMode';
import { readFlagName, useReviewFlags, type ReviewFlagEntry } from './useReviewFlags';
import { stepHref, useTraceText, type TraceText } from './useTraceText';

/** What a flag points at, in words (item no + description [· cell], or step · output). */
export function flagTargetText(tx: TraceText, expl: BoqExplanation | undefined, target: ReviewFlagTarget): string {
    if (target.kind === 'output') return `${tx.stepName(target.calc)} · ${tx.outputName(target.calc, target.output)}`;
    const line = expl ? tx.refName(expl, target.line) : tx.t('explain.unknownLine');
    return target.field === undefined ? line : `${line} · ${tx.t(`explain.cell.${target.field}`)}`;
}

function StatusTag({ flag, tx }: { flag: ReviewFlag; tx: TraceText }) {
    return flag.status === 'open'
        ? <Tag color="red" className="!m-0">{tx.t('flag.statusOpen')}</Tag>
        : <Tag color="green" className="!m-0">{tx.t('flag.statusResolved')}</Tag>;
}

function FlagActions({ entry, tx, flags }: { entry: ReviewFlagEntry; tx: TraceText; flags: ReturnType<typeof useReviewFlags> }) {
    if (flags.readOnly) return null;
    const { id, flag } = entry;
    return (
        <span className="inline-flex gap-1">
            <Button size="small" onClick={() => flags.setStatus(id, flag.status === 'open' ? 'resolved' : 'open')}>
                {flag.status === 'open' ? tx.t('flag.resolve') : tx.t('flag.reopen')}
            </Button>
            <Popconfirm title={tx.t('flag.deleteConfirm')} okText={tx.t('flag.remove')} cancelText={tx.t('flag.cancel')}
                onConfirm={() => flags.remove(id)}>
                <Button size="small" danger>{tx.t('flag.remove')}</Button>
            </Popconfirm>
        </span>
    );
}

function FlagMeta({ flag, tx }: { flag: ReviewFlag; tx: TraceText }) {
    const fmt = useFormat();
    return (
        <span className="text-[11px] text-gray-500">
            {flag.by !== '' ? `${tx.t('flag.by', { name: flag.by })} · ` : ''}{tx.t('flag.at', { date: fmt.dateTime(flag.at) })}
        </span>
    );
}

/** Dialog: the flags already on a target, and a form to add one. */
function FlagDialog({ open, target, title, onClose }: { open: boolean; target: ReviewFlagTarget; title: string; onClose: () => void }) {
    const tx = useTraceText();
    const flags = useReviewFlags();
    const me = useMe();
    const [comment, setComment] = useState('');
    const [name, setName] = useState(() => readFlagName());
    const [error, setError] = useState(false);
    const existing = flags.forTarget(target);
    const shownName = name !== '' ? name : (me.data?.user.displayName ?? '');
    const save = () => {
        if (comment.trim() === '') { setError(true); return; }
        flags.add(target, comment, shownName);
        setComment('');
        setError(false);
        onClose();
    };
    return (
        <Modal open={open} onCancel={onClose} destroyOnHidden
            title={<div className="min-w-0"><div>{tx.t('flag.title')}</div><div className="text-[13px] font-normal text-gray-600 [overflow-wrap:anywhere]">{title}</div></div>}
            footer={flags.readOnly ? [<Button key="c" onClick={onClose}>{tx.t('explain.close')}</Button>] : [
                <Button key="c" onClick={onClose}>{tx.t('flag.cancel')}</Button>,
                <Button key="s" type="primary" danger onClick={save}>{tx.t('flag.submit')}</Button>,
            ]}>
            <div className="flex flex-col gap-3">
                <div className="text-[12px] text-gray-500">{flags.shared ? tx.t('flag.shared') : tx.t('flag.local')}</div>
                {existing.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <div className="text-[13px] font-semibold">{tx.t('flag.existing')}</div>
                        {existing.map(e => (
                            <div key={e.id} className="rounded border border-gray-200 px-2 py-1.5 flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-2"><StatusTag flag={e.flag} tx={tx} /><FlagActions entry={e} tx={tx} flags={flags} /></div>
                                <div className="text-[13px] whitespace-pre-wrap [overflow-wrap:anywhere]">{e.flag.comment}</div>
                                <FlagMeta flag={e.flag} tx={tx} />
                            </div>
                        ))}
                    </div>
                )}
                {flags.readOnly ? <div className="text-[12px] text-amber-700">{tx.t('flag.readOnly')}</div> : (
                    <>
                        <label className="flex flex-col gap-1 text-[13px]">
                            {tx.t('flag.name')}
                            <Input value={shownName} maxLength={REVIEW_FLAG_LIMITS.by} placeholder={tx.t('flag.namePlaceholder')}
                                onChange={e => setName(e.target.value)} />
                        </label>
                        <label className="flex flex-col gap-1 text-[13px]">
                            {tx.t('flag.comment')}
                            <Input.TextArea value={comment} rows={4} maxLength={REVIEW_FLAG_LIMITS.comment} status={error ? 'error' : undefined}
                                placeholder={tx.t('flag.commentPlaceholder')} onChange={e => { setComment(e.target.value); setError(false); }} />
                            {error && <span className="text-[12px] text-red-600">{tx.t('flag.commentRequired')}</span>}
                        </label>
                    </>
                )}
            </div>
        </Modal>
    );
}

/**
 * Flag button of a BOQ line / cell or a step output: red with a count while open flags exist. `anyField` counts the
 * flags of every cell of a BOQ line (the marker on the line).
 */
export function FlagButton({ target, title, anyField = false, label = false }: {
    target: ReviewFlagTarget; title: string; anyField?: boolean; label?: boolean;
}) {
    const { active } = useDevMode();
    const tx = useTraceText();
    const flags = useReviewFlags();
    const [open, setOpen] = useState(false);
    if (!active) return null;
    const openCount = flags.forTarget(target, anyField).filter(e => e.flag.status === 'open').length;
    const tip = openCount > 0 ? tx.t('flag.marker', { count: openCount }) : tx.t('flag.action');
    return (
        <>
            <Tooltip title={tip}>
                <Badge count={openCount} size="small" offset={[-2, 2]}>
                    <Button type="text" size="small" aria-label={tip} data-review-flag={openCount > 0 ? 'open' : 'none'}
                        className={label ? '' : '!h-5 !w-5 !min-w-0 !p-0'}
                        icon={openCount > 0 ? <FlagFilled className="text-red-600" /> : <FlagOutlined className="text-gray-400" />}
                        onClick={e => { e.stopPropagation(); setOpen(true); }}>
                        {label ? tx.t('flag.action') : null}
                    </Button>
                </Badge>
            </Tooltip>
            {open && <FlagDialog open={open} target={target} title={title} onClose={() => setOpen(false)} />}
        </>
    );
}

/** Every flag of the project (BOQ page, dev mode): what, comment, who / when, status, actions. */
export function ReviewFlagList({ expl, onLine }: { expl: BoqExplanation | undefined; onLine: (line: string) => void }) {
    const { active } = useDevMode();
    const tx = useTraceText();
    const flags = useReviewFlags();
    if (!active) return null;
    const openCount = flags.list.filter(e => e.flag.status === 'open').length;
    return (
        <section className="bg-white border-2 border-dashed border-red-200 rounded-card p-3 sm:p-4 shadow-card flex flex-col gap-2 min-w-0"
            aria-label={tx.t('flag.list')} data-review-flags>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-[14px] font-semibold text-gray-800">
                    <FlagFilled className="text-red-600 mr-1" />{tx.t('flag.list')}
                    {openCount > 0 && <span className="ml-2 text-[12px] font-normal text-red-700">{tx.t('flag.marker', { count: openCount })}</span>}
                </div>
                <span className="text-[12px] text-gray-500">{flags.shared ? tx.t('flag.shared') : tx.t('flag.local')}</span>
            </div>
            {flags.list.length === 0 ? <div className="text-[12px] text-gray-500">{tx.t('flag.empty')}</div> : (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[12px]">
                        <thead>
                            <tr className="[&>th]:border [&>th]:border-gray-200 [&>th]:bg-gray-50 [&>th]:px-2 [&>th]:py-1 [&>th]:text-left">
                                <th>{tx.t('flag.target')}</th><th>{tx.t('flag.comment')}</th><th>{tx.t('flag.status')}</th><th>{tx.t('flag.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {flags.list.map(e => {
                                const t = e.flag.target;
                                return (
                                    <tr key={e.id} className="[&>td]:border [&>td]:border-gray-200 [&>td]:px-2 [&>td]:py-1 [&>td]:align-top">
                                        <td className="min-w-[200px]">
                                            {t.kind === 'boq'
                                                ? <button type="button" className="text-blue-600 hover:underline bg-transparent border-0 p-0 cursor-pointer text-left"
                                                    onClick={() => onLine(t.line)}>{flagTargetText(tx, expl, t)}</button>
                                                : <Link href={stepHref(t.calc)} className="text-green-700 hover:underline">{flagTargetText(tx, expl, t)}</Link>}
                                        </td>
                                        <td className="min-w-[220px]">
                                            <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">{e.flag.comment}</div>
                                            <FlagMeta flag={e.flag} tx={tx} />
                                        </td>
                                        <td><StatusTag flag={e.flag} tx={tx} /></td>
                                        <td className="whitespace-nowrap"><FlagActions entry={e} tx={tx} flags={flags} /></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
