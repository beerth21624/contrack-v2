'use client';

import { Suspense } from 'react';
import { Spin } from 'antd';
import { RegisterPage } from '@/features/cloud/auth/AuthPages';

export default function RegisterRoute() {
    return (
        <Suspense fallback={<div className="flex justify-center p-20"><Spin size="large" /></div>}>
            <RegisterPage />
        </Suspense>
    );
}