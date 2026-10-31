// ─── Global search source of numbering (WP-35): `issued_documents.number` → the document's page by `subject_type` ───
import { Injectable } from '@nestjs/common';
import type { ModuleId, SearchHit } from '@contrack/contract';
import { ModuleFlags, ProjectCatalog, type SearchContext } from '../../../shared/application/ports';
import { type Permission, can } from '../../../shared/domain/permissions';
import { type IssuedDocumentRecord, NumberingRepository } from './ports/numbering.repository';

interface SubjectRoute {
    module: ModuleId;
    permission: Permission;
    href: (d: IssuedDocumentRecord & { projectId: string }) => string;
}

/**
 * Subject types the web app has a page for. Documents of other subject types (modules 5–9 before their web WP) are
 * left out; each later module adds its subject here.
 */
const ROUTES: Readonly<Record<string, SubjectRoute>> = {
    project: { module: 'project-hub', permission: 'projects.read', href: d => `/p/${d.projectId}` },
    quotation: { module: 'quotations', permission: 'quotations.read', href: d => `/p/${d.projectId}/quotations/${d.subjectId}` },
    main_contract: { module: 'contracts', permission: 'contracts.read', href: d => `/p/${d.projectId}/contract` },
    ar_invoice: { module: 'billing', permission: 'billing.read', href: d => `/print/invoice/${d.subjectId}` },
    ar_receipt: { module: 'billing', permission: 'billing.read', href: d => `/print/receipt/${d.subjectId}` },
    variation: { module: 'variations', permission: 'variations.read', href: d => `/p/${d.projectId}/variations/${d.subjectId}` },
    purchase_request: { module: 'procurement', permission: 'procurement.read', href: d => `/p/${d.projectId}/procurement` },
    rfq: { module: 'procurement', permission: 'procurement.read', href: d => `/p/${d.projectId}/procurement/rfqs/${d.subjectId}` },
    purchase_order: { module: 'procurement', permission: 'procurement.read', href: d => `/p/${d.projectId}/procurement/orders/${d.subjectId}` },
};

@Injectable()
export class NumberingSearch {
    constructor(
        private readonly repo: NumberingRepository,
        private readonly flags: ModuleFlags,
        private readonly catalog: ProjectCatalog,
    ) {}

    async search(ctx: SearchContext): Promise<SearchHit[]> {
        const found = await this.repo.searchNumbers(ctx.workspaceId, ctx.q, ctx.limit * 3);
        if (found.length === 0) return [];
        const names = new Map((await this.catalog.list(ctx.workspaceId, { archived: false })).map(p => [p.id, p.name]));
        for (const p of await this.catalog.list(ctx.workspaceId, { archived: true })) names.set(p.id, p.name);
        const active = new Map<ModuleId, boolean>();
        const hits: SearchHit[] = [];
        for (const d of found) {
            if (hits.length >= ctx.limit) break;
            const route = ROUTES[d.subjectType];
            if (route === undefined || d.projectId === null || !can(ctx.role, route.permission)) continue;
            const projectName = names.get(d.projectId);
            if (projectName === undefined) continue;
            let on = active.get(route.module);
            if (on === undefined) {
                on = await this.flags.isEnabled(ctx.workspaceId, route.module);
                active.set(route.module, on);
            }
            if (!on) continue;
            hits.push({
                type: 'document',
                id: d.id,
                title: d.number,
                subtitle: projectName,
                href: route.href({ ...d, projectId: d.projectId }),
                docType: d.docType,
            });
        }
        return hits;
    }
}
