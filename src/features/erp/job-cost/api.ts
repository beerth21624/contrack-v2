import {
    type CashFlowDto, type CashSettingsDto, type CostLedgerDto, type JobCostReportDto, type PutCashSettingsRequest,
    type PutJobCostForecastRequest, cashFlowDtoSchema, cashSettingsDtoSchema, costLedgerDtoSchema, jobCostReportDtoSchema,
    putCashSettingsRequestSchema, putJobCostForecastRequestSchema, type UnitRatesDto, unitRatesDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { projectPath, workspacePath } from '../shared/apiPaths';

const report = { schema: jobCostReportDtoSchema };
const cash = { schema: cashFlowDtoSchema };
const settings = { schema: cashSettingsDtoSchema };

export const jobCostApi = {
    report: (projectId: string): Promise<JobCostReportDto> =>
        apiClient.request('GET', projectPath(projectId, 'job-cost'), report),
    ledger: (projectId: string, costCodeId?: string): Promise<CostLedgerDto> => {
        const qs = costCodeId === undefined ? '' : `?costCodeId=${encodeURIComponent(costCodeId)}`;
        return apiClient.request('GET', `${projectPath(projectId, 'job-cost', 'ledger')}${qs}`, { schema: costLedgerDtoSchema });
    },
    putForecast: (projectId: string, costCodeId: string, body: PutJobCostForecastRequest): Promise<JobCostReportDto> =>
        apiClient.request('PUT', projectPath(projectId, 'job-cost', 'forecasts', costCodeId), { body: putJobCostForecastRequestSchema.parse(body), ...report }),
    projectCash: (projectId: string, weeks: number, pastWeeks: number): Promise<CashFlowDto> =>
        apiClient.request('GET', `${projectPath(projectId, 'cash-flow')}?weeks=${String(weeks)}&pastWeeks=${String(pastWeeks)}`, cash),
    companyCash: (workspaceId: string, weeks: number, pastWeeks: number): Promise<CashFlowDto> =>
        apiClient.request('GET', `${workspacePath(workspaceId, 'cash-flow')}?weeks=${String(weeks)}&pastWeeks=${String(pastWeeks)}`, cash),
    getSettings: (workspaceId: string): Promise<CashSettingsDto> =>
        apiClient.request('GET', workspacePath(workspaceId, 'cash-settings'), settings),
    /** Every line key with a history (the BOQ page filters its rows; D-362). */
    unitRates: (workspaceId: string): Promise<UnitRatesDto> =>
        apiClient.request('GET', workspacePath(workspaceId, 'unit-rates'), { schema: unitRatesDtoSchema }),
    putSettings: (workspaceId: string, body: PutCashSettingsRequest): Promise<CashSettingsDto> =>
        apiClient.request('PUT', workspacePath(workspaceId, 'cash-settings'), { body: putCashSettingsRequestSchema.parse(body), ...settings }),
};
