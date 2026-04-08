'use client';

import { ProjectTimeline } from '@/components/ProjectTimeline';
import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';

export default function TimelinePage() {
    const stepSaves = useAppStore(state => state.stepSaves);
    const router = useRouter();

    return (
        <div className="w-full">
            <ProjectTimeline 
                onSelectStep={(id: number) => router.push(`/timeline/${id}`)} 
                stepSaves={stepSaves} 
            />
        </div>
    );
}
