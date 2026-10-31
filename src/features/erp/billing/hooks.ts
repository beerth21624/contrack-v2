'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    CertifyArClaimRequest, CreateAdvanceInvoiceRequest, CreateArClaimRequest, CreateCreditNoteRequest, CreateReceiptRequest,
    CreateRetentionReleaseInvoiceRequest, InvoiceArClaimRequest, IssueInvoiceRequest, IssueTaxInvoiceRequest, PatchArClaimRequest,
    VoidInvoiceRequest, VoidReceiptRequest,
} from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { billingApi } from './api';

export const billingKeys = {
    all: ['billing'] as const,
    claims: (contractId: string) => ['billing', 'claims', contractId] as const,
    claim: (claimId: string) => ['billing', 'claim', claimId] as const,
    invoices: (projectId: string) => ['billing', 'invoices', projectId] as const,
    invoice: (invoiceId: string) => ['billing', 'invoice', invoiceId] as const,
    advance: (contractId: string) => ['billing', 'advance', contractId] as const,
    retention: (contractId: string) => ['billing', 'retention', contractId] as const,
    aging: (workspaceId: string) => ['billing', 'aging', workspaceId] as const,
    statement: (customerId: string, from: string, to: string) => ['billing', 'statement', customerId, from, to] as const,
};

function useSignedIn(): boolean {
    return useSession(s => s.status === 'signed-in');
}

export function useClaims(contractId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: billingKeys.claims(contractId ?? ''),
        queryFn: () => billingApi.claims(contractId ?? ''),
        enabled: signedIn && contractId !== undefined,
        staleTime: 0,
    });
}

export function useClaim(claimId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: billingKeys.claim(claimId ?? ''),
        queryFn: () => billingApi.claim(claimId ?? ''),
        enabled: signedIn && claimId !== undefined,
        staleTime: 0,
    });
}

export function useProjectInvoices(projectId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: billingKeys.invoices(projectId ?? ''),
        queryFn: () => billingApi.invoices(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
        staleTime: 0,
    });
}

export function useInvoice(invoiceId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: billingKeys.invoice(invoiceId ?? ''),
        queryFn: () => billingApi.invoice(invoiceId ?? ''),
        enabled: signedIn && invoiceId !== undefined,
        staleTime: 0,
    });
}

export function useContractAdvance(contractId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: billingKeys.advance(contractId ?? ''),
        queryFn: () => billingApi.advance(contractId ?? ''),
        enabled: signedIn && contractId !== undefined,
        staleTime: 0,
    });
}

export function useContractRetention(contractId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: billingKeys.retention(contractId ?? ''),
        queryFn: () => billingApi.retention(contractId ?? ''),
        enabled: signedIn && contractId !== undefined,
        staleTime: 0,
    });
}

export function useAging(workspaceId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: billingKeys.aging(workspaceId ?? ''),
        queryFn: () => billingApi.aging(workspaceId ?? ''),
        enabled: signedIn && workspaceId !== undefined,
        staleTime: 0,
    });
}

export function useCustomerStatement(customerId: string | undefined, from: string, to: string) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: billingKeys.statement(customerId ?? '', from, to),
        queryFn: () => billingApi.statement(customerId ?? '', from, to),
        enabled: signedIn && customerId !== undefined,
        staleTime: 0,
    });
}

/** Any billing change: every billing query, the contract (milestone statuses) and the hub roll-ups are stale. */
function useAfterBillingChange() {
    const qc = useQueryClient();
    return () => {
        void qc.invalidateQueries({ queryKey: billingKeys.all });
        void qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'projects' && (q.queryKey[2] === 'main-contract' || q.queryKey[2] === 'hub') });
        void qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'main-contracts' });
        void qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'workspaces' && q.queryKey[2] === 'hub' });
        void qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'workspaces' && q.queryKey[2] === 'approvals' });
    };
}

export function useCreateClaim(contractId: string) {
    const after = useAfterBillingChange();
    return useMutation({ mutationFn: (body: CreateArClaimRequest) => billingApi.createClaim(contractId, body), onSuccess: after });
}

export function usePatchClaim(claimId: string) {
    const after = useAfterBillingChange();
    return useMutation({ mutationFn: (body: PatchArClaimRequest) => billingApi.patchClaim(claimId, body), onSuccess: after });
}

export function useSubmitClaim(claimId: string) {
    const after = useAfterBillingChange();
    return useMutation({ mutationFn: () => billingApi.submitClaim(claimId), onSuccess: after });
}

export function useCertifyClaim(claimId: string) {
    const after = useAfterBillingChange();
    return useMutation({ mutationFn: (body: CertifyArClaimRequest) => billingApi.certifyClaim(claimId, body), onSuccess: after });
}

export function useInvoiceClaim(claimId: string) {
    const after = useAfterBillingChange();
    return useMutation({ mutationFn: (body: InvoiceArClaimRequest) => billingApi.invoiceClaim(claimId, body), onSuccess: after });
}

export function useCancelClaim(claimId: string) {
    const after = useAfterBillingChange();
    return useMutation({ mutationFn: () => billingApi.cancelClaim(claimId), onSuccess: after });
}

export function useCreateAdvanceInvoice(contractId: string) {
    const after = useAfterBillingChange();
    return useMutation({ mutationFn: (body: CreateAdvanceInvoiceRequest) => billingApi.advanceInvoice(contractId, body), onSuccess: after });
}

export function useCreateRetentionInvoice(contractId: string) {
    const after = useAfterBillingChange();
    return useMutation({ mutationFn: (body: CreateRetentionReleaseInvoiceRequest) => billingApi.retentionInvoice(contractId, body), onSuccess: after });
}

export function useIssueInvoice() {
    const after = useAfterBillingChange();
    return useMutation({ mutationFn: (v: { id: string; body: IssueInvoiceRequest }) => billingApi.issueInvoice(v.id, v.body), onSuccess: after });
}

export function useVoidInvoice() {
    const after = useAfterBillingChange();
    return useMutation({ mutationFn: (v: { id: string; body: VoidInvoiceRequest }) => billingApi.voidInvoice(v.id, v.body), onSuccess: after });
}

export function useRecordReceipt(workspaceId: string | undefined) {
    const after = useAfterBillingChange();
    return useMutation({
        mutationFn: (body: CreateReceiptRequest) => {
            if (workspaceId === undefined) return Promise.reject(new Error('workspace unknown'));
            return billingApi.createReceipt(workspaceId, body);
        },
        onSuccess: after,
    });
}

export function useIssueTaxInvoice() {
    const after = useAfterBillingChange();
    return useMutation({ mutationFn: (v: { id: string; body: IssueTaxInvoiceRequest }) => billingApi.taxInvoice(v.id, v.body), onSuccess: after });
}

export function useCreateCreditNote() {
    const after = useAfterBillingChange();
    return useMutation({ mutationFn: (v: { id: string; body: CreateCreditNoteRequest }) => billingApi.creditNote(v.id, v.body), onSuccess: after });
}

export function useVoidReceipt() {
    const after = useAfterBillingChange();
    return useMutation({ mutationFn: (v: { id: string; body: VoidReceiptRequest }) => billingApi.voidReceipt(v.id, v.body), onSuccess: after });
}
