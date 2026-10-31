'use client';

// ─── /c/[token]: one document for the customer, no sign-in (docs/erp/02-domain-model.md §1.8) ───
// Text follows the document's language once it is loaded (the UI locale before that).
import { createElement, useState } from 'react';
import { Alert, Button, ConfigProvider, Result, Spin, Typography } from 'antd';
import enUS from 'antd/locale/en_US';
import thTH from 'antd/locale/th_TH';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { CustomerLinkViewDto } from '@/shared/contract';
import { isApiError } from '@/features/cloud/api/errors';
import { formatDate, formatDateTime } from '@/i18n/format';
import { customerLinkKeys, publicLinksApi } from './api';
import { customerLinkRenderer } from './renderers';
import { RespondForm } from './RespondForm';
import { customerLinkTranslator } from './translator';

function LinkDocument({ token, view, onChange }: { token: string; view: CustomerLinkViewDto; onChange: (v: CustomerLinkViewDto) => void }) {
    const t = customerLinkTranslator(view.language);
    const Renderer = customerLinkRenderer(view.subjectType);
    const answered = view.response;
    return (
        <ConfigProvider locale={view.language === 'en' ? enUS : thTH}>
            <div lang={view.language} className="mx-auto max-w-3xl px-4 py-6 flex flex-col gap-4">
                <header className="flex flex-col gap-1">
                    <Typography.Text type="secondary">{t('from', { company: view.companyName })}</Typography.Text>
                    <Typography.Title level={3} className="!m-0">
                        {t(`subjects.${view.subjectType}`)} {view.title}
                    </Typography.Title>
                    <Typography.Text type="secondary" className="text-xs">
                        {t('expiresAt', { date: formatDate(view.expiresAt, view.language) })}
                    </Typography.Text>
                </header>

                <section className="rounded-lg bg-white p-4 shadow-sm">
                    {Renderer === undefined ? <Typography.Text type="secondary">{t('noRenderer')}</Typography.Text> : createElement(Renderer, { view, t })}
                </section>

                {answered !== null ? (
                    <Alert type={answered.action === 'accept' ? 'success' : answered.action === 'reject' ? 'error' : 'warning'} showIcon
                        title={t('answered', { action: t(`actions.${answered.action}`) })}
                        description={t('answeredBy', { name: answered.name, date: formatDateTime(answered.at, view.language) })} />
                ) : view.canRespond ? (
                    <section className="rounded-lg bg-white p-4 shadow-sm">
                        <Typography.Title level={5} className="!mt-0">{t('respond.title')}</Typography.Title>
                        <RespondForm token={token} view={view} t={t} onResponded={onChange} />
                    </section>
                ) : (
                    <Alert type="info" showIcon title={view.actions.length === 0 ? t('viewOnly') : t('notRespondable')} />
                )}
            </div>
        </ConfigProvider>
    );
}

export function PublicLinkPage({ token }: { token: string }) {
    const t = useTranslations('customerLinks');
    const q = useQuery({
        queryKey: customerLinkKeys.publicView(token),
        queryFn: () => publicLinksApi.view(token),
        retry: (failures, e) => failures < 2 && !(isApiError(e) && e.status > 0 && e.status < 500),
        refetchOnWindowFocus: false,
        staleTime: Infinity,
    });
    // The answer returns the fresh view; keep it without counting another view.
    const [answeredView, setAnsweredView] = useState<CustomerLinkViewDto | undefined>(undefined);
    const view = answeredView ?? q.data;

    if (view !== undefined) return <LinkDocument token={token} view={view} onChange={setAnsweredView} />;
    if (q.isPending) {
        return <div className="min-h-dvh flex items-center justify-center"><Spin tip={t('loading')}><div className="p-12" /></Spin></div>;
    }
    const e = q.error;
    if (isApiError(e) && e.status === 404) {
        return <Result status="404" title={t('notFoundTitle')} subTitle={t('notFoundHint')} />;
    }
    return (
        <Result status="warning" title={isApiError(e) && e.code === 'rate_limited' ? t('rateLimited') : t('loadFailed')}
            extra={<Button onClick={() => void q.refetch()}>{t('retry')}</Button>} />
    );
}
