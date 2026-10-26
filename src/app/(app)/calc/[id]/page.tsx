'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Result, Spin } from 'antd';
import { CALCULATOR_PAGES } from '@/features/calculators/pages';
import { useProjectStore } from '@/store/project-store';

export default function CalculatorRoute() {
    const params = useParams<{ id: string }>();
    const hasHydrated = useProjectStore(s => s.hasHydrated);
    const Page = CALCULATOR_PAGES[params.id];

    if (!Page) return <Result status="404" title="ยังไม่มีเครื่องคำนวณนี้" subTitle={params.id} />;
    if (!hasHydrated) return <div className="flex justify-center p-20"><Spin size="large" /></div>;
    return (
        <Suspense fallback={<div className="flex justify-center p-20"><Spin size="large" /></div>}>
            <Page />
        </Suspense>
    );
}
