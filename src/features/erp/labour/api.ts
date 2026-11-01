import {
    type ApproveTimesheetsRequest, type ApproveTimesheetsResultDto, type CreateWageAdvanceRequest, type PatchWageAdvanceRequest,
    type PayPayPeriodRequest, type PayPeriodDto, type PayPeriodListDto, type PutTimesheetDayRequest, type TimesheetDayDto,
    type WageAdvanceDto, type WageAdvanceListDto, type WageAdvanceListQuery, approveTimesheetsResultDtoSchema,
    createWageAdvanceRequestSchema, patchWageAdvanceRequestSchema, payPayPeriodRequestSchema, payPeriodDtoSchema, payPeriodListDtoSchema,
    putTimesheetDayRequestSchema, timesheetDayDtoSchema, wageAdvanceDtoSchema, wageAdvanceListDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { apiPath, projectPath, workspacePath } from '../shared/apiPaths';

const period = { schema: payPeriodDtoSchema };
const day = { schema: timesheetDayDtoSchema };

export const labourApi = {
    getDay: (projectId: string, date: string): Promise<TimesheetDayDto> =>
        apiClient.request('GET', projectPath(projectId, 'timesheets', date), day),
    putDay: (projectId: string, date: string, body: PutTimesheetDayRequest): Promise<TimesheetDayDto> =>
        apiClient.request('PUT', projectPath(projectId, 'timesheets', date), { body: putTimesheetDayRequestSchema.parse(body), ...day }),
    approve: (projectId: string, body: ApproveTimesheetsRequest): Promise<ApproveTimesheetsResultDto> =>
        apiClient.request('POST', projectPath(projectId, 'timesheets', 'approve'), { body, schema: approveTimesheetsResultDtoSchema }),
    listPeriods: (workspaceId: string, year?: number): Promise<PayPeriodListDto> =>
        apiClient.request('GET', `${workspacePath(workspaceId, 'pay-periods')}${year === undefined ? '' : `?year=${String(year)}`}`, { schema: payPeriodListDtoSchema }),
    getPeriod: (periodId: string): Promise<PayPeriodDto> => apiClient.request('GET', apiPath('pay-periods', periodId), period),
    build: (workspaceId: string, periodKey: string): Promise<PayPeriodDto> =>
        apiClient.request('POST', workspacePath(workspaceId, 'pay-periods', periodKey, 'build'), { body: {}, ...period }),
    approvePeriod: (workspaceId: string, periodKey: string): Promise<PayPeriodDto> =>
        apiClient.request('POST', workspacePath(workspaceId, 'pay-periods', periodKey, 'approve'), { body: {}, ...period }),
    pay: (workspaceId: string, periodKey: string, body: PayPayPeriodRequest): Promise<PayPeriodDto> =>
        apiClient.request('POST', workspacePath(workspaceId, 'pay-periods', periodKey, 'pay'), { body: payPayPeriodRequestSchema.parse(body), ...period }),
    listAdvances: (workspaceId: string, query: WageAdvanceListQuery = {}): Promise<WageAdvanceListDto> => {
        const q = new URLSearchParams();
        if (query.personId !== undefined) q.set('personId', query.personId);
        if (query.status !== undefined) q.set('status', query.status);
        const qs = q.toString();
        return apiClient.request('GET', `${workspacePath(workspaceId, 'wage-advances')}${qs === '' ? '' : `?${qs}`}`, { schema: wageAdvanceListDtoSchema });
    },
    createAdvance: (workspaceId: string, body: CreateWageAdvanceRequest): Promise<WageAdvanceDto> =>
        apiClient.request('POST', workspacePath(workspaceId, 'wage-advances'), { body: createWageAdvanceRequestSchema.parse(body), schema: wageAdvanceDtoSchema }),
    patchAdvance: (advanceId: string, body: PatchWageAdvanceRequest): Promise<WageAdvanceDto> =>
        apiClient.request('PATCH', apiPath('wage-advances', advanceId), { body: patchWageAdvanceRequestSchema.parse(body), schema: wageAdvanceDtoSchema }),
};
