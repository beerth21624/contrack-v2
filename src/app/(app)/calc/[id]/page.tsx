'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Result, Spin } from 'antd';
import { useTranslations } from 'next-intl';
import { CALCULATOR_PAGES } from '@/features/calculators/pages';
import { useProjectStore } from '@/store/project-store';
import { CalcTracePanel } from '@/features/dev-mode/CalcTracePanel';

export default function CalculatorRoute() {
    const t = useTranslations('shell');
    const params = useParams<{ id: string }>();
    const hasHydrated = useProjectStore(s => s.hasHydrated);
    const Page = CALCULATOR_PAGES[params.id];

    if (!Page) return <Result status="404" title={t('calcNotFound')} subTitle={params.id} />;
    if (!hasHydrated) return <div className="flex justify-center p-20"><Spin size="large" /></div>;
    return (
        <Suspense fallback={<div className="flex justify-center p-20"><Spin size="large" /></div>}>
            <div className="flex flex-col gap-4">
                <Page />
                <CalcTracePanel calcId={params.id} />
            </div>
        </Suspense>
    );
}
