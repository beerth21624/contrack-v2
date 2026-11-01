'use client';

import { Alert } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { isRoleReadOnly, useProjectStore } from '@/store/project-store';

/** Shown above every page while a viewer has a cloud project open: edits are ignored. */
export function ReadOnlyBanner() {
    const t = useTranslations('shell');
    const readOnly = useProjectStore(s => isRoleReadOnly(s.binding));
    if (!readOnly) return null;
    return (
        <Alert type="info" showIcon icon={<EyeOutlined />} className="!mb-4"
            title={t('readOnlyTitle')}
            description={t('readOnlyDescription')} />
    );
}
