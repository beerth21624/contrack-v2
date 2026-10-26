'use client';

// ─── /invite/[token]: join a workspace from an invitation link ───
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Result } from 'antd';
import { CheckCircleOutlined, MailOutlined, TeamOutlined } from '@ant-design/icons';
import { acceptInvitationRequestSchema } from '@/shared/contract';
import { isApiError, thaiErrorMessage } from '../api/errors';
import { useSession } from '../auth/session';
import { ROLE_LABEL } from '../permissions';
import { useAcceptInvitation } from '../query/hooks';
import { RequireSignIn } from '../ui/common';

export function AcceptInvitationPage({ token }: { token: string }) {
    const next = `/invite/${encodeURIComponent(token)}`;
    if (!acceptInvitationRequestSchema.safeParse({ token }).success) {
        return (
            <Result status="warning" title="ลิงก์เชิญไม่ถูกต้อง" subTitle="ตรวจว่าคัดลอกลิงก์มาครบ หรือขอลิงก์ใหม่จากผู้เชิญ"
                extra={<Link href="/journey"><Button>ไปหน้าจัดทำ BOQ</Button></Link>} />
        );
    }
    return (
        <RequireSignIn next={next} title="คุณได้รับเชิญให้ทำ BOQ ร่วมกัน">
            <AcceptInvitation token={token} />
        </RequireSignIn>
    );
}

function AcceptInvitation({ token }: { token: string }) {
    const router = useRouter();
    const user = useSession(s => s.user);
    const accept = useAcceptInvitation();

    if (accept.isSuccess) {
        return (
            <Result status="success" icon={<CheckCircleOutlined />} title="เข้าร่วมแล้ว"
                subTitle={`บทบาทของคุณ: ${ROLE_LABEL[accept.data.role]}`}
                extra={<Button type="primary" onClick={() => router.push('/projects')}>ไปที่โครงการของทีม</Button>} />
        );
    }

    if (accept.isError) {
        const wrongEmail = isApiError(accept.error) && (accept.error.code === 'forbidden' || accept.error.code === 'not_found');
        return (
            <Result status="warning" icon={<MailOutlined />}
                title={wrongEmail ? 'ลิงก์นี้เชิญอีเมลอื่น' : 'เข้าร่วมไม่สำเร็จ'}
                subTitle={wrongEmail
                    ? `คุณเข้าสู่ระบบด้วย ${user?.email ?? ''} — ออกจากระบบแล้วเข้าใหม่ด้วยอีเมลที่ได้รับเชิญ`
                    : thaiErrorMessage(accept.error)}
                extra={[
                    <Button key="retry" onClick={() => accept.reset()}>ลองใหม่</Button>,
                    <Link key="projects" href="/projects"><Button type="link">ไปที่โครงการ</Button></Link>,
                ]} />
        );
    }

    return (
        <Result icon={<TeamOutlined className="!text-orange-500" />} title="คุณได้รับเชิญเข้าพื้นที่ทำงานของทีม"
            subTitle={`เข้าร่วมด้วยบัญชี ${user?.email ?? ''}`}
            extra={<Button type="primary" size="large" loading={accept.isPending} onClick={() => accept.mutate(token)}>เข้าร่วมทีม</Button>} />
    );
}
