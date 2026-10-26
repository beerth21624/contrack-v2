import { describe, expect, it } from 'vitest';
import type { ClaimDto, SubcontractLineDto, SubcontractingSettingsDto, WorkspaceRetentionRow } from '@/shared/contract';
import {
    claimOfInstallment, contractActions, contractMay, fmtDate, fmtMoney, fmtPct, installmentProgress, isBuyerMove,
    isModuleDisabled, isOverdue, openFixesBefore, previewApproveAmounts, round2, scCan, settingsFromForm, settingsToForm,
    sortRetentionRows, variationAmount,
} from '../logic';
import { ApiError } from '@/features/cloud/api/errors';
import { reportFileName, reportRows, reportSheetValues } from '../report-sheet';
import { uploadProblem } from '../upload';

const SETTINGS: SubcontractingSettingsDto = {
    defaultRetentionPct: 0.05, defaultWarrantyMonths: 12, defaultWhtPct: 0.03, estimatorCanAward: false,
    estimatorCanApproveClaims: false, viewerSeesPrices: false, levelingThreshold: 0.2, fixesBlockNextClaim: true,
    contractTemplateHtml: '',
};

function claim(p: Partial<ClaimDto> & Pick<ClaimDto, 'id' | 'installmentNo'>): ClaimDto {
    return {
        subcontractId: 's', condition: '', status: 'requested', requestedBy: 'vendor', requestedAt: '2026-10-01T00:00:00.000Z',
        note: '', photos: [], inspection: null,
        amounts: { gross: 0, adjustments: [], retention: 0, wht: 0, vat: 0, net: 0 },
        approvedAt: null, paidAt: null, paidAmount: null, paidChannel: null, paidRef: null, rejectedReason: null,
        ...p,
    };
}

const line = (p: Partial<SubcontractLineDto>): SubcontractLineDto => ({ idx: 1, desc: '', unit: '', qty: 1, unitPrice: null, matUnitPrice: null, total: 0, ...p });

describe('numbers', () => {
    it('rounds to satang half away from zero', () => {
        expect(round2(1.005)).toBe(1.01);
        expect(round2(-1.005)).toBe(-1.01);
        expect(round2(2.675)).toBe(2.68);
        expect(round2(Number.NaN)).toBe(0);
    });
    it('formats money, percent and dates in Thai', () => {
        expect(fmtMoney(125000)).toBe('125,000.00');
        expect(fmtPct(0.05)).toBe('5%');
        expect(fmtPct(0.025)).toBe('2.5%');
        expect(fmtDate('2026-10-30')).toContain('ต.ค.');
        expect(fmtDate(null)).toBe('');
        expect(fmtDate('nope')).toBe('');
    });
});

describe('scCan (settings widen three rights)', () => {
    it('keeps the plain matrix', () => {
        expect(scCan('owner', 'sc.claims.approve', undefined)).toBe(true);
        expect(scCan('estimator', 'sc.claims.approve', undefined)).toBe(false);
        expect(scCan('estimator', 'sc.claims.inspect', SETTINGS)).toBe(true);
        expect(scCan(undefined, 'sc.read', SETTINGS)).toBe(false);
    });
    it('widens estimator award / approve and viewer prices only when switched on', () => {
        const on = { ...SETTINGS, estimatorCanAward: true, estimatorCanApproveClaims: true, viewerSeesPrices: true };
        expect(scCan('estimator', 'sc.award', on)).toBe(true);
        expect(scCan('estimator', 'sc.claims.approve', on)).toBe(true);
        expect(scCan('viewer', 'sc.readPrices', on)).toBe(true);
        expect(scCan('viewer', 'sc.award', on)).toBe(false);
        expect(scCan('estimator', 'sc.payments.record', on)).toBe(false);
        expect(scCan('estimator', 'sc.award', SETTINGS)).toBe(false);
    });
});

describe('contract state', () => {
    const inst = (state: 'not_started' | 'paid') => ({ state });
    it('progress = paid / all', () => {
        expect(installmentProgress([inst('paid'), inst('not_started'), inst('paid'), inst('not_started')])).toEqual({ paid: 2, total: 4, pct: 50 });
        expect(installmentProgress([])).toEqual({ paid: 0, total: 0, pct: 0 });
    });
    it('end-of-life actions by state', () => {
        const base = { installments: [{ state: 'paid' as const }], retention: { withheld: 10, released: 0, forfeited: 0, balance: 10, schedule: [] }, myRating: { submitted: false } };
        expect(contractActions({ ...base, status: 'pending_acceptance', installments: [] })).toMatchObject({ cancel: true, terminate: false, complete: false });
        expect(contractActions({ ...base, status: 'active' })).toMatchObject({ terminate: true, complete: true, close: false, rate: false });
        expect(contractActions({ ...base, status: 'active', installments: [{ state: 'not_started' }] }).complete).toBe(false);
        expect(contractActions({ ...base, status: 'completed' })).toMatchObject({ close: false, rate: true });
        expect(contractActions({ ...base, status: 'completed', retention: { ...base.retention, balance: 0 } }).close).toBe(true);
        expect(contractActions({ ...base, status: 'closed', myRating: { submitted: true } }).rate).toBe(false);
    });
    it('buyer moves', () => {
        expect(isBuyerMove('buyer_pay')).toBe(true);
        expect(isBuyerMove('vendor_accept')).toBe(false);
        expect(isBuyerMove('none')).toBe(false);
    });
});

describe('claims of installments', () => {
    const list = [
        claim({ id: 'a', installmentNo: 1, status: 'rejected', requestedAt: '2026-10-02T00:00:00.000Z' }),
        claim({ id: 'b', installmentNo: 1, status: 'requested', requestedAt: '2026-10-01T00:00:00.000Z' }),
        claim({
            id: 'c', installmentNo: 2, status: 'paid',
            inspection: { result: 'pass_with_fixes', checklist: [], fixes: [{ text: 'x', done: false }, { text: 'y', done: true }], note: '', byName: '', at: '2026-10-03T00:00:00.000Z' },
        }),
    ];
    it('finds the claim by id, else the latest non-rejected', () => {
        expect(claimOfInstallment(list, { no: 1, claimId: null })?.id).toBe('b');
        expect(claimOfInstallment(list, { no: 1, claimId: 'a' })?.id).toBe('a');
        expect(claimOfInstallment(list, { no: 3, claimId: null })).toBeUndefined();
    });
    it('counts open fixes of earlier installments', () => {
        expect(openFixesBefore(list, 3)).toBe(1);
        expect(openFixesBefore(list, 2)).toBe(0);
    });
});

describe('approve preview (domain claimAmounts on the current installment amount)', () => {
    type Inst = Parameters<typeof previewApproveAmounts>[0]['installments'][number];
    const inst = (no: number, amount: number): Inst => ({ no, pct: 0.5, condition: '', amount, claimId: null, state: 'requested' });
    const labourOnly = {
        installments: [inst(1, 50_000), inst(2, 100_000)],
        terms: { retentionPct: 0.05, whtPct: 0.03, vat: true },
        lines: [line({ qty: 10, unitPrice: 15_000, total: 150_000 })],
    };
    it('net = gross + adjustments − retention − wht + vat; blank / zero rows left out', () => {
        const a = previewApproveAmounts(labourOnly, claim({ id: 'c', installmentNo: 2 }), [
            { label: 'ค่าปรับล่าช้า', amount: -2_000 }, { label: '', amount: 500 }, { label: 'ศูนย์', amount: 0 },
        ]);
        expect(a.gross).toBe(100_000);
        expect(a.adjustments).toEqual([{ label: 'ค่าปรับล่าช้า', amount: -2_000 }]);
        expect(a.retention).toBe(5_000);
        expect(a.wht).toBe(2_940);
        expect(a.vat).toBe(6_860);
        expect(a.net).toBe(100_000 - 2_000 - 5_000 - 2_940 + 6_860);
    });
    it('uses the installment amount the server has now (variations move the last one), not the stored claim gross', () => {
        const stale = claim({ id: 'c', installmentNo: 2, amounts: { gross: 90_000, adjustments: [], retention: 0, wht: 0, vat: 0, net: 0 } });
        expect(previewApproveAmounts(labourOnly, stale, []).gross).toBe(100_000);
        expect(previewApproveAmounts({ ...labourOnly, installments: [] }, stale, []).gross).toBe(90_000);
    });
    it('WHT only on the labour share when the crew supplies material', () => {
        const withMaterial = {
            installments: [inst(1, 10_000)],
            terms: { retentionPct: 0, whtPct: 0.03, vat: false },
            lines: [line({ qty: 10, unitPrice: 100, matUnitPrice: 50, total: 1_500 }), line({ qty: 1, total: 500 })],
        };
        // labour = 1 000 + 500 of 2 000 → 75 %
        expect(previewApproveAmounts(withMaterial, claim({ id: 'c', installmentNo: 1 }), []).wht).toBe(225);
    });
});

describe('module off', () => {
    it('only a 404 module_disabled counts as "module off"', () => {
        expect(isModuleDisabled(new ApiError(404, 'module_disabled', 'off'))).toBe(true);
        expect(isModuleDisabled(new ApiError(404, 'not_found', 'gone'))).toBe(false);
        expect(isModuleDisabled(new Error('x'))).toBe(false);
    });
    it('a read-only contract keeps the read rights and hides every action', () => {
        const all = () => true;
        expect(contractMay(all, true)('sc.claims.approve')).toBe(true);
        expect(contractMay(all, false)('sc.claims.approve')).toBe(false);
        expect(contractMay(all, false)('sc.award')).toBe(false);
        expect(contractMay(all, false)('sc.readPrices')).toBe(true);
        expect(contractMay(() => false, false)('sc.read')).toBe(false);
    });
});

describe('variations, retention, settings, report, upload', () => {
    it('variation amount with removed work', () => {
        expect(variationAmount([{ qty: 10, unitPrice: 150 }, { qty: -2, unitPrice: 300 }])).toBe(900);
    });
    it('sorts retention by due date, no date last, drops zero balances', () => {
        const row = (contractNo: string, nextDueAt: string | null, balance = 100): WorkspaceRetentionRow => ({
            subcontractId: contractNo, contractNo, projectName: '', vendorName: '', balance, nextDueAt, status: 'completed',
        });
        const sorted = sortRetentionRows([row('C', null), row('B', '2026-12-01'), row('A', '2026-11-01'), row('Z', '2026-01-01', 0)]);
        expect(sorted.map(r => r.contractNo)).toEqual(['A', 'B', 'C']);
        expect(isOverdue('2026-10-01', '2026-10-26')).toBe(true);
        expect(isOverdue(null, '2026-10-26')).toBe(false);
    });
    it('settings form round-trips percentages', () => {
        const form = settingsToForm({ ...SETTINGS, defaultRetentionPct: 0.055, levelingThreshold: 0.25 });
        expect(form.retentionPct).toBe(5.5);
        expect(form.levelingPct).toBe(25);
        expect(settingsFromForm(form)).toEqual({ ...SETTINGS, defaultRetentionPct: 0.055, levelingThreshold: 0.25 });
    });
    it('report rows end with the total', () => {
        const rows = reportRows({
            rows: [{ trade: 'structure', estimate: 100, contracted: 120, paid: 60, diff: 20 }, { trade: 'painting', estimate: 0, contracted: 0, paid: 0, diff: 0 }],
            totals: { estimate: 100, contracted: 120, paid: 60, diff: 20 },
        });
        expect(rows).toHaveLength(3);
        expect(rows[0]).toMatchObject({ key: 'structure', diffPct: 0.2, paidPct: 0.5 });
        expect(rows[1]).toMatchObject({ diffPct: null, paidPct: null });
        expect(rows[2]?.key).toBe('total');
        expect(reportSheetValues(rows)[0]).toEqual([rows[0]?.label, 100, 120, 60, 20, 0.2, 0.5]);
        expect(reportFileName('บ้าน/คุณ:ก')).toBe('รายงานจ้างช่วง_บ้าน คุณ ก.xlsx');
    });
    it('upload checks size and type', () => {
        expect(uploadProblem({ size: 1000, type: 'image/jpeg' })).toBeNull();
        expect(uploadProblem({ size: 1000, type: 'text/plain' })).not.toBeNull();
        expect(uploadProblem({ size: 50 * 1024 * 1024, type: 'image/png' })).not.toBeNull();
    });
});
