'use client';

// ─── /invite/[token]: join a workspace from an invitation link ───
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Result } from 'antd';
import { CheckCircleOutlined, MailOutlined, TeamOutlined } from '@ant-design/icons';
import { acceptInvitationRequestSchema } from '@/shared/contract';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '../api/error-message';
import { isApiError } from '../api/errors';
import { useSession } from '../auth/session';
import { useAcceptInvitation } from '../query/hooks';
import { RequireSignIn } from '../ui/common';

export function AcceptInvitationPage({ token }: { token: string }) {
    const t = useTranslations('cloud.accept');
    const next = `/invite/${encodeURIComponent(token)}`;
    if (!acceptInvitationRequestSchema.safeParse({ token }).success) {
        return (
            <Result status="warning" title={t('invalidTitle')} subTitle={t('invalidSub')}
                extra={<Link href="/journey"><Button>{t('goBoq')}</Button></Link>} />
        );
    }
    return (
        <RequireSignIn next={next} title={t('signInTitle')}>
            <AcceptInvitation token={token} />
        </RequireSignIn>
    );
}

function AcceptInvitation({ token }: { token: string }) {
    const t = useTranslations('cloud.accept');
    const tRoles = useTranslations('roles');
    const tShared = useTranslations('cloud.shared');
    const toText = useErrorMessage();
    const router = useRouter();
    const user = useSession(s => s.user);
    const accept = useAcceptInvitation();

    if (accept.isSuccess) {
        return (
            <Result status="success" icon={<CheckCircleOutlined />} title={t('joined')}
                subTitle={tShared('yourRole', { role: tRoles(`${accept.data.role}.label`) })}
                extra={<Button type="primary" onClick={() => router.push('/projects')}>{t('goTeamProjects')}</Button>} />
        );
    }

    if (accept.isError) {
        const wrongEmail = isApiError(accept.error) && (accept.error.code === 'forbidden' || accept.error.code === 'not_found');
        return (
            <Result status="warning" icon={<MailOutlined />}
                title={wrongEmail ? t('wrongEmail') : t('failed')}
                subTitle={wrongEmail
                    ? t('wrongEmailSub', { email: user?.email ?? '' })
                    : toText(accept.error)}
                extra={[
                    <Button key="retry" onClick={() => accept.reset()}>{tShared('retry')}</Button>,
                    <Link key="projects" href="/projects"><Button type="link">{t('goProjects')}</Button></Link>,
                ]} />
        );
    }

    return (
        <Result icon={<TeamOutlined className="!text-orange-500" />} title={t('teamTitle')}
            subTitle={t('joinWith', { email: user?.email ?? '' })}
            extra={<Button type="primary" size="large" loading={accept.isPending} onClick={() => accept.mutate(token)}>{t('join')}</Button>} />
    );
}
