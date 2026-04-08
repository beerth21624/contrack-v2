'use client';

import { ProductivityConfigTable } from '@/components/ProductivityConfigTable';
import { useAppStore } from '@/lib/store';

export default function ProductivityPage() {
    const scheduleData = useAppStore(state => state.scheduleData);
    const handleUpdateSchedule = useAppStore(state => state.handleUpdateSchedule);
    return (
        <div className="w-full">
            <ProductivityConfigTable scheduleData={scheduleData} onUpdate={handleUpdateSchedule} />
        </div>
    );
}
