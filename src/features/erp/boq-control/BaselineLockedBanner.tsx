'use client';

// ─── Shown above every page while the open cloud project's BOQ is locked by a baseline (WP-19) ───
import Link from 'next/link';
import { Alert } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useModuleEnabled } from '@/features/modules/modules';
import { isBaselineLocked, useProjectStore } from '@/store/project-store';

export function BaselineLockedBanner() {
    const t = useTranslations('boqControl.banner');
    const locked = useProjectStore(s => isBaselineLocked(s.binding));
    const projectId = useProjectStore(s => (s.binding.kind === 'cloud' ? s.binding.projectId : undefined));
    const hub = useModuleEnabled('project-hub');
    if (!locked || projectId === undefined) return null;
    return (
        <Alert type="warning" showIcon icon={<LockOutlined />} className="!mb-4"
            title={t('title')}
            description={(
                <span>
                    {t('description')}
                    {hub.enabled && (
                        <>
                            {' '}
                            <Link href={`/p/${encodeURIComponent(projectId)}/versions`} className="whitespace-nowrap">{t('openHistory')}</Link>
                        </>
                    )}
                </span>
            )} />
    );
}
