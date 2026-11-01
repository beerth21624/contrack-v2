'use client';

// ─── "What needs doing": the tasks the portal gathered for this role, one line each ───
import Link from 'next/link';
import { Tag } from 'antd';
import { useLocale, useTranslations } from 'next-intl';
import type { PortalTask } from '@/shared/contract';
import { DateText } from '../shared/DateText';
import { EmptyState } from '../shared/EmptyState';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';

type TaskTranslator = ReturnType<typeof useTranslations<'portal'>>;

function taskText(task: PortalTask, t: TaskTranslator, tEnums: ReturnType<typeof useTranslations<'enums'>>, locale: string): string {
    const p = task.params;
    const s = (k: string): string => String(p[k] ?? '');
    switch (task.kind) {
        case 'approval_pending': {
            const key = `approvalSubject.${s('subject')}` as Parameters<typeof tEnums>[0];
            return t('tasks.approval_pending', { title: s('title'), subject: tEnums.has(key) ? tEnums(key) : s('subject') });
        }
        case 'invoice_overdue':
            return t('tasks.invoice_overdue', { number: s('number'), customer: s('customer'), days: Number(p.daysOverdue ?? 0) });
        case 'milestone_claimable':
            return t('tasks.milestone_claimable', { contract: s('contract'), no: s('no'), label: locale === 'en' && s('labelEn') !== '' ? s('labelEn') : s('labelTh') });
        case 'quotation_expiring':
            return t('tasks.quotation_expiring', { number: s('number'), title: s('title') });
        case 'variation_awaiting_customer':
            return t('tasks.variation_awaiting_customer', { number: s('number'), title: s('title') });
        case 'purchase_request_to_order':
            return t('tasks.purchase_request_to_order', { number: s('number') });
        case 'purchase_order_to_receive':
            return t('tasks.purchase_order_to_receive', { number: s('number'), supplierName: s('supplierName') });
        case 'site_report_missing':
            return t('tasks.site_report_missing', { date: s('date') });
        case 'pay_period_ready':
            return t('tasks.pay_period_ready', { periodKey: s('periodKey') });
        case 'supplier_bill_due':
            return t('tasks.supplier_bill_due', { number: s('number'), supplierName: s('supplierName') });
        case 'warranty_claim_open':
            return t('tasks.warranty_claim_open', { number: s('number'), description: s('description') });
        default:
            return task.kind;
    }
}

export function TasksList({ tasks }: { tasks: readonly PortalTask[] }) {
    const t = useTranslations('portal');
    const tEnums = useTranslations('enums');
    const locale = useLocale();
    return (
        <SectionCard title={t('tasks.title')} extra={<Tag className="!m-0">{tasks.length}</Tag>}>
            {tasks.length === 0 ? (
                <EmptyState title={t('tasks.empty')} />
            ) : (
                <ul className="m-0 flex list-none flex-col divide-y divide-gray-100 p-0">
                    {tasks.map((task, i) => (
                        <li key={`${task.kind}:${task.href}:${i}`}>
                            <Link href={task.href} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-1 py-2.5 text-inherit no-underline hover:bg-gray-50">
                                <div className="min-w-0 flex-1">
                                    <div className="break-words text-gray-900">{taskText(task, t, tEnums, locale)}</div>
                                    {task.projectName !== null && <div className="truncate text-[12px] text-gray-500">{task.projectName}</div>}
                                </div>
                                {task.dueDate !== null && (
                                    <span className="text-[12px] text-gray-500">{t('tasks.due')} <DateText value={task.dueDate} /></span>
                                )}
                                {task.amount !== null && <MoneyText value={task.amount} className="text-gray-900" />}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}
