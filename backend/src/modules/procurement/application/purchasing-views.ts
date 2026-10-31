// ─── Purchase order / goods receipt records → DTOs ───
import { Injectable } from '@nestjs/common';
import {
    type GoodsReceiptDto, PURCHASE_ORDER_RECEIVABLE_STATUSES, type PurchaseOrderDto, type PurchaseOrderSummaryDto,
} from '@contrack/contract';
import type { ProjectGrant } from '../../../shared/application/module-access';
import { CostCodeLookup, FileService, type Supplier, SupplierLookup } from '../../../shared/application/ports';
import type { WorkspaceId } from '../../../shared/domain/ids';
import { can } from '../../../shared/domain/permissions';
import {
    type GoodsReceiptLineRecord, GoodsReceiptRepository, type GoodsReceiptRecord, type PurchaseOrderLineRecord, PurchaseOrderRepository,
    type PurchaseOrderRecord,
} from './ports/procurement.repository';
import { supplierName } from './purchasing.service';

const orderBase = (o: PurchaseOrderRecord, supplier: Supplier | undefined): Omit<PurchaseOrderSummaryDto, 'lineCount'> => ({
    id: o.id, projectId: o.projectId, supplierId: o.supplierId, supplierName: o.supplierSnapshot?.name ?? supplierName(supplier), rfqId: o.rfqId,
    number: o.number, status: o.status, orderDate: o.orderDate, deliveryDate: o.deliveryDate, deliveryAddress: o.deliveryAddress,
    language: o.language, vatRate: o.vatRate, subtotal: o.subtotal, discount: o.discount, vat: o.vat, total: o.total, whtPreset: o.whtPreset,
    paymentTermDays: o.paymentTermDays, terms: o.terms, budgetWarnings: structuredClone(o.budgetWarnings), overrideReason: o.overrideReason,
    issuedBy: o.issuedBy, issuedAt: o.issuedAt?.toISOString() ?? null, createdAt: o.createdAt.toISOString(), updatedAt: o.updatedAt.toISOString(),
});

export const canEditOrder = (grant: ProjectGrant, o: PurchaseOrderRecord): boolean =>
    o.status === 'draft' && can(grant.role, 'procurement.manage') && !grant.archived;

export const canReceiveOrder = (grant: Pick<ProjectGrant, 'role' | 'archived'>, o: PurchaseOrderRecord): boolean =>
    PURCHASE_ORDER_RECEIVABLE_STATUSES.includes(o.status) && can(grant.role, 'procurement.receive') && !grant.archived;

@Injectable()
export class PurchasingViews {
    constructor(
        private readonly orders: PurchaseOrderRepository,
        private readonly receipts: GoodsReceiptRepository,
        private readonly costCodes: CostCodeLookup,
        private readonly suppliers: SupplierLookup,
        private readonly files: FileService,
    ) {}

    private async supplierMap(workspaceId: WorkspaceId, ids: readonly string[]): Promise<Map<string, Supplier>> {
        const wanted = [...new Set(ids)];
        if (wanted.length === 0) return new Map();
        return new Map((await this.suppliers.findMany(workspaceId, wanted)).map(s => [s.id, s]));
    }

    async summaries(workspaceId: WorkspaceId, list: readonly PurchaseOrderRecord[]): Promise<PurchaseOrderSummaryDto[]> {
        const counts = await this.orders.lineCounts(workspaceId, list.map(o => o.id));
        const suppliers = await this.supplierMap(workspaceId, list.filter(o => o.supplierSnapshot === null).map(o => o.supplierId));
        return list.map(o => ({ ...orderBase(o, suppliers.get(o.supplierId)), lineCount: counts.get(o.id) ?? 0 }));
    }

    async order(o: PurchaseOrderRecord, grant: ProjectGrant): Promise<PurchaseOrderDto> {
        const ws = o.workspaceId;
        const lines = await this.orders.linesOf(ws, o.id);
        const codeIds = [...new Set(lines.flatMap(l => (l.costCodeId === null ? [] : [l.costCodeId])))];
        const codes = new Map((codeIds.length === 0 ? [] : await this.costCodes.findMany(ws, o.projectId, codeIds)).map(c => [c.id, c.code]));
        const supplier = o.supplierSnapshot === null ? await this.suppliers.find(ws, o.supplierId) : undefined;
        return {
            ...orderBase(o, supplier),
            supplierSnapshot: o.supplierSnapshot === null ? null : structuredClone(o.supplierSnapshot),
            lines: lines.map(l => ({
                id: l.id, costCodeId: l.costCodeId, costCode: l.costCodeId === null ? null : codes.get(l.costCodeId) ?? null,
                requestLineId: l.requestLineId, descTh: l.descTh, descEn: l.descEn, unit: l.unit, qty: l.qty, unitPrice: l.unitPrice,
                amount: l.amount, receivedQty: l.receivedQty, billedQty: l.billedQty, sort: l.sort,
            })),
            canEdit: canEditOrder(grant, o),
            canReceive: canReceiveOrder(grant, o),
            createdBy: o.createdBy,
        };
    }

    async receipt(r: GoodsReceiptRecord, orderLines?: readonly PurchaseOrderLineRecord[], lines?: readonly GoodsReceiptLineRecord[]): Promise<GoodsReceiptDto> {
        const ws = r.workspaceId;
        const own = lines ?? await this.receipts.linesOf(ws, r.id);
        const byLine = new Map((orderLines ?? await this.orders.linesOf(ws, r.orderId)).map(l => [l.id, l]));
        const fileIds = r.photos.map(p => p.fileId);
        const files = new Map((fileIds.length === 0 ? [] : await this.files.describe(fileIds)).map(f => [f.id, f]));
        return {
            id: r.id, projectId: r.projectId, orderId: r.orderId, number: r.number, status: r.status, receivedDate: r.receivedDate,
            receivedBy: r.receivedBy, deliveryNoteNo: r.deliveryNoteNo,
            photos: r.photos.map(p => ({ ...p, file: files.get(p.fileId) ?? null })),
            note: r.note,
            lines: own.map(l => {
                const ol = byLine.get(l.orderLineId);
                return {
                    id: l.id, orderLineId: l.orderLineId, descTh: ol?.descTh ?? '', descEn: ol?.descEn ?? '', unit: ol?.unit ?? '',
                    qtyReceived: l.qtyReceived, qtyRejected: l.qtyRejected, condition: l.condition, note: l.note,
                };
            }),
            amount: r.amount, confirmedAt: r.confirmedAt?.toISOString() ?? null,
            createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
        };
    }

    async receiptsOf(workspaceId: WorkspaceId, orderId: string): Promise<GoodsReceiptDto[]> {
        const list = await this.receipts.listByOrder(workspaceId, orderId);
        const orderLines = await this.orders.linesOf(workspaceId, orderId);
        const out: GoodsReceiptDto[] = [];
        for (const r of list) out.push(await this.receipt(r, orderLines));
        return out;
    }
}
