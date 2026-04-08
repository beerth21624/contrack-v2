'use client';

import { CashFlowTable } from '@/components/CashFlowTable';
import { useAppStore } from '@/lib/store';

export default function CashFlowPage() {
    const stepSaves = useAppStore(state => state.stepSaves);
    const scheduleData = useAppStore(state => state.scheduleData);
    const priceList = useAppStore(state => state.priceList);
    return (
        <div className="w-full">
            <CashFlowTable stepSaves={stepSaves} scheduleData={scheduleData} priceList={priceList} />
        </div>
    );
}
