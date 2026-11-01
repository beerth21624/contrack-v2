'use client';

// ─── /p/<id>/labour: the week's timesheet of the project (people × days) ───
import Link from 'next/link';
import { Alert } from 'antd';
import { useTranslations } from 'next-intl';
import { can } from '@/shared/contract';
import { ErpPage } from '../shared/ErpPage';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { TimesheetGrid } from './TimesheetGrid';

export function LabourPage({ projectId }: { projectId: string }) {
    const t = useTranslations('labour');
    const ws = useErpWorkspace();
    const canPay = can(ws.role, 'labour.read');
    return (
        <ErpPage
            title={t('title')}
            subtitle={t('subtitle')}
            extra={canPay ? <Link href="/workspace/pay-periods" className="text-[13px]">{t('periods.openAll')}</Link> : undefined}
        >
            <Alert type="info" showIcon title={t('flow')} />
            <TimesheetGrid projectId={projectId} workspaceId={ws.workspaceId} canRecord={can(ws.role, 'labour.record')} />
        </ErpPage>
    );
}
