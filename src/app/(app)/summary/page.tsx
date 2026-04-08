'use client';

import { BOQSummaryTable } from '@/components/BOQSummaryTable';
import { useAppStore } from '@/lib/store';

export default function SummaryPage() {
    const stepSaves = useAppStore(state => state.stepSaves);
    const priceList = useAppStore(state => state.priceList);
    return <BOQSummaryTable stepSaves={stepSaves} priceList={priceList} />;
}
