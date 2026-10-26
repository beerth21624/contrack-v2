'use client';

import { Suspense } from 'react';
import { Spin } from 'antd';
import { VendorLoginPage } from '@/features/vendor/pages/VendorLoginPage';

export default function VendorLoginRoute() {
    return (
        <Suspense fallback={<div className="flex justify-center p-20"><Spin size="large" /></div>}>
            <VendorLoginPage />
        </Suspense>
    );
}
