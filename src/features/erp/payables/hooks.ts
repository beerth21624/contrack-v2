'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
    ApproveSupplierBillRequest, CancelPaymentRunRequest, CreateBillFromOrderRequest, CreateBillFromPayPeriodRequest, CreateBillFromScClaimRequest,
    CreatePaymentRunRequest, CreateSupplierBillRequest, PatchPaymentRunRequest, PatchSupplierBillRequest, PayPaymentRunRequest, PaymentRunStatus,
    SupplierBillListQuery, VoidSupplierBillRequest,
} from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { payablesApi } from './api';

export const payablesKeys = {
    all: ['payables'] as const,
    due: (workspaceId: string, within: number) => ['payables', 'due', workspaceId, within] as const,
    bills: (workspaceId: string, q: string) => ['payables', 'bills', workspaceId, q] as const,
    bill: (billId: string) => ['payables', 'bill', billId] as const,
    runs: (workspaceId: string, statuses: string) => ['payables', 'runs', workspaceId, statuses] as const,
    run: (runId: string) => ['payables', 'run', runId] as const,
    payment: (paymentId: string) => ['payables', 'payment', paymentId] as const,
    certificate: (certificateId: string) => ['payables', 'certificate', certificateId] as const,
};

function useSignedIn(): boolean {
    return useSession(s => s.status === 'signed-in');
}

/** Everything the payables screens show can change with any action (bill ↔ run ↔ due list), plus pay periods / portal / approvals. */
function refreshAll(qc: QueryClient): void {
    void qc.invalidateQueries({ queryKey: payablesKeys.all });
    void qc.invalidateQueries({
        predicate: q => q.queryKey[0] === 'workspaces' && (q.queryKey[2] === 'approvals' || q.queryKey[2] === 'portal' || q.queryKey[2] === 'pay-periods'),
    });
    void qc.invalidateQueries({ queryKey: ['pay-periods'] });
}

export function usePayablesDue(workspaceId: string | undefined, within = 30) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: payablesKeys.due(workspaceId ?? '', within),
        queryFn: () => payablesApi.due(workspaceId ?? '', within),
        enabled: signedIn && workspaceId !== undefined,
        staleTime: 0,
    });
}

export function useSupplierBills(workspaceId: string | undefined, q: SupplierBillListQuery) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: payablesKeys.bills(workspaceId ?? '', JSON.stringify(q)),
        queryFn: () => payablesApi.listBills(workspaceId ?? '', q),
        enabled: signedIn && workspaceId !== undefined,
        staleTime: 0,
    });
}

export function useSupplierBill(billId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: payablesKeys.bill(billId ?? ''),
        queryFn: () => payablesApi.getBill(billId ?? ''),
        enabled: signedIn && billId !== undefined,
        staleTime: 0,
    });
}

export function usePaymentRuns(workspaceId: string | undefined, statuses: readonly PaymentRunStatus[]) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: payablesKeys.runs(workspaceId ?? '', statuses.join(',')),
        queryFn: () => payablesApi.listRuns(workspaceId ?? '', statuses),
        enabled: signedIn && workspaceId !== undefined,
        staleTime: 0,
    });
}

export function usePaymentRun(runId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: payablesKeys.run(runId ?? ''),
        queryFn: () => payablesApi.getRun(runId ?? ''),
        enabled: signedIn && runId !== undefined,
        staleTime: 0,
    });
}

export function useApPayment(paymentId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: payablesKeys.payment(paymentId ?? ''),
        queryFn: () => payablesApi.getPayment(paymentId ?? ''),
        enabled: signedIn && paymentId !== undefined,
        staleTime: 0,
    });
}

export function useWhtCertificate(certificateId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: payablesKeys.certificate(certificateId ?? ''),
        queryFn: () => payablesApi.getCertificate(certificateId ?? ''),
        enabled: signedIn && certificateId !== undefined,
        staleTime: 0,
    });
}

// ── bills ──

export function useCreateBill(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (body: CreateSupplierBillRequest) => payablesApi.createBill(workspaceId, body), onSuccess: () => refreshAll(qc) });
}

export function useBillFromOrder() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (v: { orderId: string; body: CreateBillFromOrderRequest }) => payablesApi.billFromOrder(v.orderId, v.body),
        onSuccess: () => refreshAll(qc),
    });
}

export function useBillFromScClaim(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (body: CreateBillFromScClaimRequest) => payablesApi.billFromScClaim(workspaceId, body), onSuccess: () => refreshAll(qc) });
}

export function useBillFromPayPeriod(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (body: CreateBillFromPayPeriodRequest) => payablesApi.billFromPayPeriod(workspaceId, body), onSuccess: () => refreshAll(qc) });
}

export function usePatchBill(billId: string) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (body: PatchSupplierBillRequest) => payablesApi.patchBill(billId, body), onSuccess: () => refreshAll(qc) });
}

export function useApproveBill(billId: string) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (body: ApproveSupplierBillRequest) => payablesApi.approveBill(billId, body), onSuccess: () => refreshAll(qc) });
}

export function useVoidBill(billId: string) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (body: VoidSupplierBillRequest) => payablesApi.voidBill(billId, body), onSuccess: () => refreshAll(qc) });
}

// ── payment runs ──

export function useCreateRun(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (body: CreatePaymentRunRequest) => payablesApi.createRun(workspaceId, body), onSuccess: () => refreshAll(qc) });
}

export function usePatchRun(runId: string) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (body: PatchPaymentRunRequest) => payablesApi.patchRun(runId, body), onSuccess: () => refreshAll(qc) });
}

export function useApproveRun(runId: string) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: () => payablesApi.approveRun(runId), onSuccess: () => refreshAll(qc) });
}

export function usePayRun(runId: string) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (body: PayPaymentRunRequest) => payablesApi.payRun(runId, body), onSuccess: () => refreshAll(qc) });
}

export function useCancelRun(runId: string) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: (body: CancelPaymentRunRequest) => payablesApi.cancelRun(runId, body), onSuccess: () => refreshAll(qc) });
}
