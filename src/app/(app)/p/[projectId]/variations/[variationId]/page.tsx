'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { VariationEditorPage } from '@/features/erp/variations/VariationEditorPage';

export default function ProjectVariationRoute() {
    const params = useParams<{ projectId: string; variationId: string }>();
    return (
        <ModuleGate module="variations" next={`/p/${encodeURIComponent(params.projectId)}/variations/${encodeURIComponent(params.variationId)}`}>
            <VariationEditorPage projectId={params.projectId} variationId={params.variationId} />
        </ModuleGate>
    );
}
