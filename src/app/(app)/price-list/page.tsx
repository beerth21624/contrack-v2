'use client';

import { PriceListTable } from '@/components/PriceListTable';
import { useAppStore } from '@/lib/store';

export default function PriceListPage() {
    const priceList = useAppStore(state => state.priceList);
    const handleUpdatePrice = useAppStore(state => state.handleUpdatePrice);
    return (
        <div className="w-full">
            <PriceListTable prices={priceList} onUpdate={handleUpdatePrice} />
        </div>
    );
}
