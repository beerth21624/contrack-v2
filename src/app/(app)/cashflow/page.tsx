'use client';

import { Spin } from 'antd';
import { useProjectStore } from '@/store/project-store';
import { CashFlowPage } from '@/features/planning/cashflow/CashFlowPage';

export default function CashFlowRoute() {
    const hasHydrated = useProjectStore(s => s.hasHydrated);
    if (!hasHydrated) return <div className="flex justify-center p-20"><Spin size="large" /></div>;
    return <CashFlowPage />;
}
