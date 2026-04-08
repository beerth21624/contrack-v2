'use client';

import { Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { getStepDef } from '@/lib/step-registry';
import { Spin, App } from 'antd';
import type { StepId, StepInputMap, StepResult } from '@/types';

function DynamicStep({ stepId, onBack, onSave }: {
    stepId: StepId;
    onBack: () => void;
    onSave: <S extends StepId>(id: S, inp: StepInputMap[S], res: StepResult) => void;
}) {
    const def = getStepDef(stepId);
    const stepSaves = useAppStore(state => state.stepSaves);
    const savedData = stepSaves[stepId]?.inp;
    
    const StepForm = def.Component;
    
    return (
        <Suspense fallback={<Spin size="large" style={{ display: 'flex', justifyContent: 'center', padding: 80 }} />}>
            <StepForm
                initialData={savedData}
                onBack={onBack}
                onSave={(inp: StepInputMap[typeof stepId], res: StepResult) => onSave(stepId, inp, res)}
            />
        </Suspense>
    );
}

export default function StepPage() {
    const params = useParams();
    const router = useRouter();
    const saveStep = useAppStore(state => state.saveStep);
    const { message } = App.useApp();
    
    if (!params.stepId) return null;
    const stepId = parseInt(params.stepId as string, 10);
    if (isNaN(stepId)) return <div>Invalid step ID</div>;

    const handleSave = <S extends StepId>(id: S, inp: StepInputMap[S], res: StepResult) => {
        saveStep(id, inp, res);
        message.success(`บันทึกข้อมูลขั้นตอนที่ ${id} เรียบร้อยแล้ว`);
        router.push('/timeline');
    };

    return (
        <DynamicStep
            stepId={stepId as StepId}
            onBack={() => router.push('/timeline')}
            onSave={handleSave}
        />
    );
}
