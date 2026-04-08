'use client';

import { ManDayTable } from '@/components/ManDayTable';
import { useAppStore } from '@/lib/store';

export default function ManDayPage() {
    const stepSaves = useAppStore(state => state.stepSaves);
    const scheduleData = useAppStore(state => state.scheduleData);
    return (
        <div className="w-full">
            <ManDayTable stepSaves={stepSaves} scheduleData={scheduleData} />
        </div>
    );
}
