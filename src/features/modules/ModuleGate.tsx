'use client';

// ─── Page guard of a business module: sign-in → module on for the workspace → the page ───
import Link from 'next/link';
import { Button, Result } from 'antd';
import { MODULE_LABEL, type ModuleId } from '@/shared/contract';
import { RequireSignIn, spinner } from '@/features/cloud/ui/common';
import { useCurrentWorkspace } from '@/features/cloud/query/hooks';
import { can } from '@/features/cloud/permissions';
import { useModuleEnabled } from './modules';

export function ModuleGate({ module, next, children }: { module: ModuleId; next: string; children: React.ReactNode }) {
    return (
        <RequireSignIn next={next} title={MODULE_LABEL[module]}>
            <Gate module={module}>{children}</Gate>
        </RequireSignIn>
    );
}

function Gate({ module, children }: { module: ModuleId; children: React.ReactNode }) {
    const { enabled, loading } = useModuleEnabled(module);
    const role = useCurrentWorkspace().workspace?.role;
    if (loading) return spinner;
    if (!enabled) {
        return (
            <Result
                status="info"
                title={`${MODULE_LABEL[module]} ปิดใช้งานอยู่`}
                subTitle="พื้นที่ทำงานนี้ใช้เฉพาะการประมาณราคา BOQ"
                extra={can(role, 'modules.manage')
                    ? <Link href="/workspace/modules"><Button type="primary">เปิดใช้งานในตั้งค่า</Button></Link>
                    : <Link href="/journey"><Button>กลับไปที่ BOQ</Button></Link>}
            />
        );
    }
    return <>{children}</>;
}
