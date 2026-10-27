'use client';

// ─── Small shared pieces of the cloud pages ───
import Link from 'next/link';
import { Button, Result, Spin } from 'antd';
import { LoginOutlined } from '@ant-design/icons';
import { useSession } from '../auth/session';

export const spinner = <div className="flex justify-center p-20"><Spin size="large" /></div>;

/** Renders children only for a signed-in user; a sign-in prompt for guests (guest mode keeps working). */
export function RequireSignIn({ children, next, title }: { children: React.ReactNode; next: string; title: string }) {
    const status = useSession(s => s.status);
    if (status === 'unknown') return spinner;
    if (status === 'guest') {
        return (
            <Result
                icon={<LoginOutlined className="!text-orange-400" />}
                title={title}
                subTitle="เข้าสู่ระบบเพื่อเก็บโครงการบนคลาวด์ และทำงานเป็นทีม — โครงการในเครื่องนี้ใช้ต่อได้เหมือนเดิม"
                extra={[
                    <Link key="login" href={`/login?next=${encodeURIComponent(next)}`}><Button type="primary">เข้าสู่ระบบ</Button></Link>,
                    <Link key="register" href={`/register?next=${encodeURIComponent(next)}`}><Button>สมัครใช้งาน</Button></Link>,
                    <Link key="local" href="/journey"><Button type="link">ใช้โครงการในเครื่องนี้ต่อ</Button></Link>,
                ]}
            />
        );
    }
    return <>{children}</>;
}

// Thai months with the Christian-era year, like the rest of the app (calendar, S-Curve, crew board): plain 'th-TH'
// prints the Buddhist year (69 for 2026).
const DATE_FORMAT = new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
    day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit',
});

/** "26 ต.ค. 26 11:17" ('' for an invalid date). */
export function formatDateTime(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : DATE_FORMAT.format(d);
}
