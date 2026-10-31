'use client';

import { useMemo } from 'react';
import type { MainContractDto } from '@/shared/contract';
import { useCompanyProfile } from '../company/hooks';
import { useCustomer } from '../customers/hooks';
import { useHubProject } from '../hub/hooks';
import {
    type PrintCompany, type PrintCustomer, companyFromProfile, companyFromSnapshot, customerFromDto, customerFromSnapshot,
} from '../quotations/print-model';
import { type ContractPrintModel, buildContractPrintModel } from './print-model';

/** The printable model of a contract: snapshots when signed, the live company / customer before (null while loading). */
export function useContractPrintModel(c: MainContractDto | undefined): { model: ContractPrintModel | null; error: unknown } {
    const hub = useHubProject(c?.projectId);
    const company = useCompanyProfile(hub.data?.project.workspaceId);
    const customer = useCustomer(c?.customerSnapshot === null ? c.customerId : undefined);
    const model = useMemo(() => {
        if (c === undefined || hub.data === undefined) return null;
        // Images are the company's current files (a snapshot keeps only their ids).
        const images = {
            logoUrl: company.data?.logo?.url ?? null,
            stampUrl: company.data?.stamp?.url ?? null,
            signatureUrl: company.data?.signature?.url ?? null,
        };
        let co: PrintCompany | null = null;
        if (c.companySnapshot !== null) co = companyFromSnapshot(c.companySnapshot, images);
        else if (company.data !== undefined) co = companyFromProfile(company.data, c.language);
        if (co === null) return null;
        let cu: PrintCustomer | null = null;
        if (c.customerSnapshot !== null) cu = customerFromSnapshot(c.customerSnapshot);
        else if (customer.data !== undefined) cu = customerFromDto(customer.data, c.language);
        return buildContractPrintModel({
            contract: c, company: co, customer: cu, projectName: hub.data.project.name, siteAddress: hub.data.hub.siteAddress,
        });
    }, [c, hub.data, company.data, customer.data]);
    const error: unknown = hub.isError ? hub.error : company.isError ? company.error : null;
    return { model, error };
}
