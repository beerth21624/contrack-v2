'use client';

import { ScheduleTimeline } from '@/components/ScheduleTimeline';
import { useAppStore } from '@/lib/store';

export default function SchedulePage() {
    const stepSaves = useAppStore(state => state.stepSaves);
    const scheduleData = useAppStore(state => state.scheduleData);
    return (
        <div className="w-full">
            <ScheduleTimeline stepSaves={stepSaves} scheduleData={scheduleData} />
        </div>
    );
}
