'use client';

// ─── /login and /register ───
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import type { LoginRequest, RegisterRequest } from '@/shared/contract';
import { api } from '../api/routes';
import { thaiErrorMessage } from '../api/errors';
import { RULES, safeNext } from './form-rules';
import { useSession } from './session';

const { Title, Text } = Typography;

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
    return (
        <div className="flex justify-center py-6 sm:py-12">
            <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-6 sm:p-8">
                <Title level={3} style={{ margin: 0 }}>{title}</Title>
                <Text type="secondary" className="block mt-1 mb-5 text-[13px]">{subtitle}</Text>
                {children}
            </div>
        </div>
    );
}

const GUEST_NOTE = 'ไม่เข้าสู่ระบบก็ใช้งานได้ — โครงการจะเก็บไว้ในเบราว์เซอร์นี้เหมือนเดิม และไม่หายเมื่อเข้าสู่ระบบ';

function AlreadySignedIn({ next }: { next: string }) {
    const user = useSession(s => s.user);
    return (
        <AuthCard title="เข้าสู่ระบบอยู่แล้ว" subtitle={user ? `${user.displayName} (${user.email})` : ''}>
            <Link href={next}><Button type="primary" block size="large">ไปต่อ</Button></Link>
        </AuthCard>
    );
}

export function LoginPage() {
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
            setError(thaiErrorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <AuthCard title="เข้าสู่ระบบ" subtitle="เก็บโครงการไว้บนคลาวด์ เปิดเครื่องไหนก็ทำต่อได้ และทำงานเป็นทีม">
            {error !== null && <Alert type="error" showIcon title={error} className="!mb-4" />}
            <Form<LoginRequest> layout="vertical" requiredMark={false} onFinish={(v) => { void onFinish(v); }} disabled={busy}>
                <Form.Item name="email" label="อีเมล" rules={RULES.email}>
                    <Input prefix={<MailOutlined />} autoComplete="email" inputMode="email" placeholder="somchai@gmail.com" />
                </Form.Item>
                <Form.Item name="password" label="รหัสผ่าน" rules={RULES.loginPassword}>
                    <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
                </Form.Item>
                <Button type="primary" htmlType="submit" block size="large" loading={busy}>เข้าสู่ระบบ</Button>
            </Form>
            <div className="mt-4 text-[13px] text-center">
                ยังไม่มีบัญชี? <Link href={`/register?next=${encodeURIComponent(next)}`}>สมัครใช้งานฟรี</Link>
            </div>
            <div className="mt-4 text-[12px] text-gray-500 text-center">{GUEST_NOTE}</div>
        </AuthCard>
    );
}

interface RegisterValues extends RegisterRequest { confirm: string }

export function RegisterPage() {
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
            setError(thaiErrorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <AuthCard title="สมัครใช้งาน" subtitle="ได้พื้นที่ทำงานส่วนตัวทันที เชิญทีมเข้ามาทำ BOQ ด้วยกันได้ภายหลัง">
            {error !== null && <Alert type="error" showIcon title={error} className="!mb-4" />}
            <Form<RegisterValues> layout="vertical" requiredMark={false} onFinish={(v) => { void onFinish(v); }} disabled={busy}>
                <Form.Item name="displayName" label="ชื่อที่ให้ทีมเห็น" rules={RULES.displayName}>
                    <Input prefix={<UserOutlined />} autoComplete="name" placeholder="เช่น สมชาย ใจดี" />
                </Form.Item>
                <Form.Item name="email" label="อีเมล" rules={RULES.email}>
                    <Input prefix={<MailOutlined />} autoComplete="email" inputMode="email" placeholder="somchai@gmail.com" />
                </Form.Item>
                <Form.Item name="password" label="รหัสผ่าน" rules={RULES.newPassword} hasFeedback>
                    <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
                </Form.Item>
                <Form.Item name="confirm" label="ยืนยันรหัสผ่าน" dependencies={['password']} hasFeedback
                    rules={[
                        { required: true, message: 'กรอกรหัสผ่านอีกครั้ง' },
                        ({ getFieldValue }) => ({
                            validator: (_r, value: unknown) => (value === getFieldValue('password')
                                ? Promise.resolve() : Promise.reject(new Error('รหัสผ่านทั้งสองช่องไม่ตรงกัน'))),
                        }),
                    ]}>
                    <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
                </Form.Item>
                <Button type="primary" htmlType="submit" block size="large" loading={busy}>สมัครและเข้าสู่ระบบ</Button>
            </Form>
            <div className="mt-4 text-[13px] text-center">
                มีบัญชีแล้ว? <Link href={`/login?next=${encodeURIComponent(next)}`}>เข้าสู่ระบบ</Link>
            </div>
            <div className="mt-4 text-[12px] text-gray-500 text-center">{GUEST_NOTE}</div>
        </AuthCard>
    );
}
