'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { RfqEditorPage } from '@/features/erp/procurement/RfqEditorPage';

export default function ProjectRfqRoute() {
    const params = useParams<{ projectId: string; rfqId: string }>();
    return (
        <ModuleGate module="procurement" next={`/p/${encodeURIComponent(params.projectId)}/procurement/rfqs/${encodeURIComponent(params.rfqId)}`}>
            <RfqEditorPage projectId={params.projectId} rfqId={params.rfqId} />
        </ModuleGate>
    );
}
