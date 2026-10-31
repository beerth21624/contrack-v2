'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    AwardRfqRequest, CreateGoodsReceiptRequest, CreatePurchaseOrderRequest, CreatePurchaseRequestRequest, CreateRfqRequest, IssuePurchaseOrderRequest,
    PatchPurchaseOrderRequest, PatchPurchaseRequestRequest, PatchRfqRequest, PurchaseOrderDto, PurchaseOrderStatus, PurchaseRequestDto, PutRfqQuoteRequest, PutRfqSuppliersRequest, RfqDto, SubmitPurchaseRequestRequest,
} from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { procurementApi } from './api';

export const procurementKeys = {
    requests: (projectId: string) => ['projects', projectId, 'purchase-requests'] as const,
    request: (requestId: string) => ['purchase-requests', requestId] as const,
    rfqs: (projectId: string) => ['projects', projectId, 'rfqs'] as const,
    rfq: (rfqId: string) => ['rfqs', rfqId] as const,
    compare: (rfqId: string) => ['rfqs', rfqId, 'compare'] as const,
    orders: (projectId: string) => ['projects', projectId, 'purchase-orders'] as const,
    order: (orderId: string) => ['purchase-orders', orderId] as const,
    receipts: (orderId: string) => ['purchase-orders', orderId, 'receipts'] as const,
    workspaceOrders: (workspaceId: string, statuses: string) => ['workspaces', workspaceId, 'purchase-orders', statuses] as const,
    priceHistory: (supplierId: string, q: string) => ['suppliers', supplierId, 'price-history', q] as const,
};

function useSignedIn(): boolean {
    return useSession(s => s.status === 'signed-in');
}

export function usePurchaseRequests(projectId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: procurementKeys.requests(projectId ?? ''),
        queryFn: () => procurementApi.listRequests(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
        staleTime: 0,
    });
}

export function usePurchaseRequest(requestId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: procurementKeys.request(requestId ?? ''),
        queryFn: () => procurementApi.getRequest(requestId ?? ''),
        enabled: signedIn && requestId !== undefined,
        staleTime: 0,
    });
}

/** The full PRs (with lines) for a list of ids, e.g. the approved ones an RFQ can draw lines from. */
export function usePurchaseRequestDetails(requestIds: readonly string[]) {
    const signedIn = useSignedIn();
    return useQueries({
        queries: requestIds.map(id => ({
            queryKey: procurementKeys.request(id),
            queryFn: () => procurementApi.getRequest(id),
            enabled: signedIn,
            staleTime: 0,
        })),
    });
}

export function usePurchaseOrders(projectId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: procurementKeys.orders(projectId ?? ''),
        queryFn: () => procurementApi.listOrders(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
        staleTime: 0,
    });
}

/** Cache bookkeeping after a PR changed: the PR, the list, and (submit / cancel) the approvals inbox + portal tasks. */
export function useAfterRequestChange() {
    const qc = useQueryClient();
    return (r: PurchaseRequestDto, structural = false) => {
        qc.setQueryData(procurementKeys.request(r.id), r);
        void qc.invalidateQueries({ queryKey: procurementKeys.requests(r.projectId) });
        if (structural) {
            void qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'workspaces' && (q.queryKey[2] === 'approvals' || q.queryKey[2] === 'portal') });
        }
    };
}

export function useCreatePurchaseRequest(projectId: string) {
    const after = useAfterRequestChange();
    return useMutation({ mutationFn: (body: CreatePurchaseRequestRequest) => procurementApi.createRequest(projectId, body), onSuccess: r => after(r) });
}

export function usePatchPurchaseRequest(requestId: string) {
    const after = useAfterRequestChange();
    return useMutation({ mutationFn: (body: PatchPurchaseRequestRequest) => procurementApi.patchRequest(requestId, body), onSuccess: r => after(r) });
}

export function useSubmitPurchaseRequest(requestId: string) {
    const after = useAfterRequestChange();
    return useMutation({ mutationFn: (body: SubmitPurchaseRequestRequest) => procurementApi.submitRequest(requestId, body), onSuccess: r => after(r, true) });
}

export function useCancelPurchaseRequest(requestId: string) {
    const after = useAfterRequestChange();
    return useMutation({ mutationFn: () => procurementApi.cancelRequest(requestId), onSuccess: r => after(r, true) });
}

export function useRfqs(projectId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: procurementKeys.rfqs(projectId ?? ''),
        queryFn: () => procurementApi.listRfqs(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
        staleTime: 0,
    });
}

export function useRfq(rfqId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: procurementKeys.rfq(rfqId ?? ''),
        queryFn: () => procurementApi.getRfq(rfqId ?? ''),
        enabled: signedIn && rfqId !== undefined,
        staleTime: 0,
    });
}

/** Quotes compared (only worth asking once a supplier has quoted). */
export function useRfqCompare(rfqId: string | undefined, enabled: boolean, version: string) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: [...procurementKeys.compare(rfqId ?? ''), version],
        queryFn: () => procurementApi.compare(rfqId ?? ''),
        enabled: signedIn && enabled && rfqId !== undefined,
        staleTime: 0,
    });
}

function useAfterRfqChange() {
    const qc = useQueryClient();
    return (r: RfqDto) => {
        qc.setQueryData(procurementKeys.rfq(r.id), r);
        void qc.invalidateQueries({ queryKey: procurementKeys.compare(r.id) });
        void qc.invalidateQueries({ queryKey: procurementKeys.rfqs(r.projectId) });
    };
}

export function useCreateRfq(projectId: string) {
    const after = useAfterRfqChange();
    return useMutation({ mutationFn: (body: CreateRfqRequest) => procurementApi.createRfq(projectId, body), onSuccess: after });
}

export function usePatchRfq(rfqId: string) {
    const after = useAfterRfqChange();
    return useMutation({ mutationFn: (body: PatchRfqRequest) => procurementApi.patchRfq(rfqId, body), onSuccess: after });
}

export function usePutRfqSuppliers(rfqId: string) {
    const after = useAfterRfqChange();
    return useMutation({ mutationFn: (body: PutRfqSuppliersRequest) => procurementApi.putSuppliers(rfqId, body), onSuccess: after });
}

export function useSendRfq(rfqId: string) {
    const after = useAfterRfqChange();
    return useMutation({ mutationFn: () => procurementApi.sendRfq(rfqId), onSuccess: after });
}

export function useCancelRfq(rfqId: string) {
    const after = useAfterRfqChange();
    return useMutation({ mutationFn: () => procurementApi.cancelRfq(rfqId), onSuccess: after });
}

export function usePutRfqQuote(rfqId: string) {
    const after = useAfterRfqChange();
    return useMutation({
        mutationFn: (v: { supplierId: string; body: PutRfqQuoteRequest }) => procurementApi.putQuote(rfqId, v.supplierId, v.body),
        onSuccess: after,
    });
}

/** Award: the RFQ becomes `awarded` and a PO draft exists; reload the RFQ, its lists, the POs and the PRs. */
export function useAwardRfq(rfqId: string, projectId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: AwardRfqRequest) => procurementApi.award(rfqId, body),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: procurementKeys.rfq(rfqId) });
            void qc.invalidateQueries({ queryKey: procurementKeys.rfqs(projectId) });
            void qc.invalidateQueries({ queryKey: procurementKeys.orders(projectId) });
            void qc.invalidateQueries({ queryKey: procurementKeys.requests(projectId) });
        },
    });
}

export function useWorkspacePurchaseOrders(workspaceId: string | undefined, statuses: readonly PurchaseOrderStatus[]) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: procurementKeys.workspaceOrders(workspaceId ?? '', statuses.join(',')),
        queryFn: () => procurementApi.listWorkspaceOrders(workspaceId ?? '', statuses),
        enabled: signedIn && workspaceId !== undefined,
        staleTime: 0,
    });
}

export function usePurchaseOrder(orderId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: procurementKeys.order(orderId ?? ''),
        queryFn: () => procurementApi.getOrder(orderId ?? ''),
        enabled: signedIn && orderId !== undefined,
        staleTime: 0,
    });
}

export function useGoodsReceipts(orderId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: procurementKeys.receipts(orderId ?? ''),
        queryFn: () => procurementApi.listReceipts(orderId ?? ''),
        enabled: signedIn && orderId !== undefined,
        staleTime: 0,
    });
}

export function useSupplierPriceHistory(supplierId: string | undefined, q: string) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: procurementKeys.priceHistory(supplierId ?? '', q),
        queryFn: () => procurementApi.priceHistory(supplierId ?? '', q),
        enabled: signedIn && supplierId !== undefined,
        staleTime: 15_000,
    });
}

/** Cache bookkeeping after a PO changed (issue / cancel / close also move PRs, RFQs, approvals, portal tasks and the hub). */
export function useAfterOrderChange() {
    const qc = useQueryClient();
    return (o: PurchaseOrderDto, structural = false) => {
        qc.setQueryData(procurementKeys.order(o.id), o);
        void qc.invalidateQueries({ queryKey: procurementKeys.orders(o.projectId) });
        void qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'workspaces' && q.queryKey[2] === 'purchase-orders' });
        if (structural) {
            void qc.invalidateQueries({ queryKey: procurementKeys.requests(o.projectId) });
            void qc.invalidateQueries({ queryKey: procurementKeys.rfqs(o.projectId) });
            void qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'workspaces' && (q.queryKey[2] === 'approvals' || q.queryKey[2] === 'portal') });
            void qc.invalidateQueries({ queryKey: ['projects', o.projectId] });
        }
    };
}

export function useCreatePurchaseOrder(projectId: string) {
    const after = useAfterOrderChange();
    return useMutation({ mutationFn: (body: CreatePurchaseOrderRequest) => procurementApi.createOrder(projectId, body), onSuccess: o => after(o) });
}

export function usePatchPurchaseOrder(orderId: string) {
    const after = useAfterOrderChange();
    return useMutation({ mutationFn: (body: PatchPurchaseOrderRequest) => procurementApi.patchOrder(orderId, body), onSuccess: o => after(o) });
}

export function useIssuePurchaseOrder(orderId: string) {
    const after = useAfterOrderChange();
    return useMutation({ mutationFn: (body: IssuePurchaseOrderRequest) => procurementApi.issueOrder(orderId, body), onSuccess: o => after(o, true) });
}

export function useCancelPurchaseOrder(orderId: string) {
    const after = useAfterOrderChange();
    return useMutation({ mutationFn: () => procurementApi.cancelOrder(orderId), onSuccess: o => after(o, true) });
}

export function useClosePurchaseOrder(orderId: string) {
    const after = useAfterOrderChange();
    return useMutation({ mutationFn: () => procurementApi.closeOrder(orderId), onSuccess: o => after(o, true) });
}

/** Records one delivery: a draft receipt, then confirm (the cost moves from committed to actual); refreshes the PO and its cost. */
export function useReceiveGoods(orderId: string, projectId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (body: CreateGoodsReceiptRequest) => {
            const draft = await procurementApi.createReceipt(orderId, body);
            try {
                return await procurementApi.confirmReceipt(draft.id);
            } catch (e) {
                // Do not leave a draft behind: the form is submitted again after the fix.
                await procurementApi.cancelReceipt(draft.id).catch(() => undefined);
                throw e;
            }
        },
        onSettled: () => {
            void qc.invalidateQueries({ queryKey: procurementKeys.order(orderId) });
            void qc.invalidateQueries({ queryKey: procurementKeys.receipts(orderId) });
            void qc.invalidateQueries({ queryKey: procurementKeys.orders(projectId) });
            void qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'workspaces' && (q.queryKey[2] === 'purchase-orders' || q.queryKey[2] === 'portal') });
            void qc.invalidateQueries({ queryKey: ['projects', projectId] });
        },
    });
}

export function useCancelGoodsReceipt(orderId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (receiptId: string) => procurementApi.cancelReceipt(receiptId),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: procurementKeys.receipts(orderId) }); },
    });
}
