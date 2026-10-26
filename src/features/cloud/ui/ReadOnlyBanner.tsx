'use client';

import { Alert } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { isReadOnly, useProjectStore } from '@/store/project-store';

/** Shown above every page while a viewer has a cloud project open: edits are ignored. */
export function ReadOnlyBanner() {
    const readOnly = useProjectStore(s => isReadOnly(s.binding));
    if (!readOnly) return null;
    return (
        <Alert type="info" showIcon icon={<EyeOutlined />} className="!mb-4"
            title="ดูอย่างเดียว"
            description="คุณมีสิทธิ์ดูโครงการนี้ แก้ตัวเลขไม่ได้ (ส่งออก Excel / พิมพ์ได้ตามปกติ) ขอสิทธิ์แก้จากเจ้าของหรือผู้ดูแล" />
    );
}
