'use client';

// ─── /login and /register ───
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import type { LoginRequest, RegisterRequest } from '@/shared/contract';
import { api } from '../api/routes';
import { useErrorMessage } from '../api/error-message';
import { safeNext } from './form-rules';
import { useRules } from './use-rules';
import { useSession } from './session';

const { Title, Text } = Typography;

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
    return (
        <div className="flex justify-center py-6 sm:py-12">
            <div className="w-full max-w-md bg-white border border-gray-200 rounded-card shadow-card p-6 sm:p-8">
                <Title level={3} style={{ margin: 0 }}>{title}</Title>
                <Text type="secondary" className="block mt-1 mb-5 text-[13px]">{subtitle}</Text>
                {children}
            </div>
        </div>
    );
}

function AlreadySignedIn({ next }: { next: string }) {
    const t = useTranslations('auth');
    const user = useSession(s => s.user);
    return (
        <AuthCard title={t('alreadyTitle')} subtitle={user ? `${user.displayName} (${user.email})` : ''}>
            <Link href={next}><Button type="primary" block size="large">{t('continue')}</Button></Link>
        </AuthCard>
    );
}

export function LoginPage() {
    const t = useTranslations('auth');
    const RULES = useRules();
    const toText = useErrorMessage();
    const router = useRouter();
    const params = useSearchParams();
    const next = safeNext(params.get('next'));
    const status = useSession(s => s.status);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (status === 'signed-in') return <AlreadySignedIn next={next} />;

    const onFinish = async (values: LoginRequest) => {
        setBusy(true);
        setError(null);
        try {
            await api.auth.login({ email: values.email.trim().toLowerCase(), password: values.password });
            router.push(next);
        } catch (e) {
            setError(toText(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <AuthCard title={t('login.title')} subtitle={t('login.subtitle')}>
            {error !== null && <Alert type="error" showIcon title={error} className="!mb-4" />}
            <Form<LoginRequest> layout="vertical" requiredMark={false} onFinish={(v) => { void onFinish(v); }} disabled={busy}>
                <Form.Item name="email" label={t('email')} rules={RULES.email}>
                    <Input prefix={<MailOutlined />} autoComplete="email" inputMode="email" placeholder="somchai@gmail.com" />
                </Form.Item>
                <Form.Item name="password" label={t('password')} rules={RULES.loginPassword}>
                    <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
                </Form.Item>
                <Button type="primary" htmlType="submit" block size="large" loading={busy}>{t('login.submit')}</Button>
            </Form>
            <div className="mt-4 text-[13px] text-center">
                {t('login.noAccount')} <Link href={`/register?next=${encodeURIComponent(next)}`}>{t('login.registerLink')}</Link>
            </div>
            <div className="mt-4 text-[12px] text-gray-500 text-center">{t('guestNote')}</div>
        </AuthCard>
    );
}

interface RegisterValues extends RegisterRequest { confirm: string }

export function RegisterPage() {
    const t = useTranslations('auth');
    const RULES = useRules();
    const toText = useErrorMessage();
    const router = useRouter();
    const params = useSearchParams();
    const next = safeNext(params.get('next'));
    const status = useSession(s => s.status);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (status === 'signed-in') return <AlreadySignedIn next={next} />;

    const onFinish = async (values: RegisterValues) => {
        setBusy(true);
        setError(null);
        try {
            await api.auth.register({
                email: values.email.trim().toLowerCase(), password: values.password, displayName: values.displayName.trim(),
            });
            router.push(next);
        } catch (e) {
            setError(toText(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <AuthCard title={t('register.title')} subtitle={t('register.subtitle')}>
            {error !== null && <Alert type="error" showIcon title={error} className="!mb-4" />}
            <Form<RegisterValues> layout="vertical" requiredMark={false} onFinish={(v) => { void onFinish(v); }} disabled={busy}>
                <Form.Item name="displayName" label={t('register.displayName')} rules={RULES.displayName}>
                    <Input prefix={<UserOutlined />} autoComplete="name" placeholder={t('register.displayNamePlaceholder')} />
                </Form.Item>
                <Form.Item name="email" label={t('email')} rules={RULES.email}>
                    <Input prefix={<MailOutlined />} autoComplete="email" inputMode="email" placeholder="somchai@gmail.com" />
                </Form.Item>
                <Form.Item name="password" label={t('password')} rules={RULES.newPassword} hasFeedback>
                    <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
                </Form.Item>
                <Form.Item name="confirm" label={t('register.confirm')} dependencies={['password']} hasFeedback
                    rules={[
                        { required: true, message: t('register.confirmRequired') },
                        ({ getFieldValue }) => ({
                            validator: (_r, value: unknown) => (value === getFieldValue('password')
                                ? Promise.resolve() : Promise.reject(new Error(t('register.mismatch')))),
                        }),
                    ]}>
                    <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
                </Form.Item>
                <Button type="primary" htmlType="submit" block size="large" loading={busy}>{t('register.submit')}</Button>
            </Form>
            <div className="mt-4 text-[13px] text-center">
                {t('register.hasAccount')} <Link href={`/login?next=${encodeURIComponent(next)}`}>{t('register.loginLink')}</Link>
            </div>
            <div className="mt-4 text-[12px] text-gray-500 text-center">{t('guestNote')}</div>
        </AuthCard>
    );
}
