'use client';

import { Suspense } from 'react';
import { Spin } from 'antd';
import { LoginPage } from '@/features/cloud/auth/AuthPages';

export default function LoginRoute() {
    return (
        <Suspense fallback={<div className="flex justify-center p-20"><Spin size="large" /></div>}>
            <LoginPage />
        </Suspense>
    );
}