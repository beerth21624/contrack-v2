// ─── Test fixtures of the vendor screens (valid against the contract schemas) ───
import type { BidDto, GuestPackageDto, PackageLineDto } from '@/shared/contract';

export const UUID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export function line(idx: number, patch: Partial<PackageLineDto> = {}): PackageLineDto {
    return {
        idx, section: 17, sectionTitle: 'งานผนัง', desc: `รายการ ${String(idx)}`, unit: 'ตร.ม.',
        qtyNet: 10, qtyGross: 11, qtyPriced: 10, qtyMaterial: 11, labourBasis: 'net', materialBy: 'buyer', ...patch,
    };
}

export function pkg(patch: Partial<GuestPackageDto> = {}): GuestPackageDto {
    return {
        invitationId: UUID(1), invitationStatus: 'viewed', packageStatus: 'open', buyerName: 'บริษัท ก่อสร้างดี', projectName: '',
        title: 'ก่ออิฐฉาบปูน บ้านคุณสมศรี', trade: 'masonry', description: '',
        location: { district: 'เมือง', province: 'ขอนแก่น', address: '' },
        schedule: { start: '2026-11-01', finish: '2026-11-30', days: 30 },
        supplyMode: 'labour_only', pricingMode: 'unit',
        terms: {
            retentionPct: 0.05, warrantyMonths: 12, penalty: { kind: 'none' },
            provisions: { water: 'buyer', power: 'buyer', lodging: 'none', scaffolding: 'vendor' },
            safetyNote: '', questions: ['มีโฟร์แมนไหม'],
        },
        installments: [{ no: 1, pct: 0.4, condition: 'ก่อเสร็จ' }, { no: 2, pct: 0.6, condition: 'ฉาบเสร็จ' }],
        bidDeadline: '2026-10-30T10:00:00.000Z', priceValidUntil: '2026-12-31', version: 1,
        lines: [line(0), line(1, { materialBy: 'vendor', qtyMaterial: 12 }), line(2, { sectionTitle: 'งานฉาบ' })],
        addendumNote: null, changedLineIdx: [], files: [], questions: [], linkedToVendor: false,
        invitedPhoneMasked: '08x-xxx-5678', invitedDisplayName: 'ทีมช่างสมศักดิ์', outcome: 'pending',
        ...patch,
    };
}

export function bid(patch: Partial<BidDto> = {}): BidDto {
    return {
        id: UUID(9), invitationId: UUID(1), packageId: UUID(2), packageVersion: 1, version: 1, status: 'draft', mode: 'unit',
        lines: [
            { idx: 0, unitPrice: 100, matUnitPrice: null, excluded: false, reason: '', total: 1000 },
            { idx: 1, unitPrice: 50, matUnitPrice: 20, excluded: false, reason: '', total: 740 },
            { idx: 2, unitPrice: null, matUnitPrice: null, excluded: true, reason: 'ผู้ว่าจ้างทำเอง', total: 0 },
        ],
        lumpTotal: null, adjustment: -40, adjustmentNote: '', inclusions: '', total: 1700, days: 20, earliestStart: '2026-11-02',
        crewSkilled: 3, crewLabourers: 2, validUntil: '2026-12-15', installmentsProposal: null, answers: ['มี'], note: 'หมายเหตุ',
        photos: [], enteredByBuyer: false, outdated: false, submittedAt: null, updatedAt: '2026-10-26T10:00:00.000Z',
        ...patch,
    };
}
