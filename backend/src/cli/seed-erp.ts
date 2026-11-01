// ─── ERP sample data for the showcase (part of `npm run db:seed:showcase`; needs `project-hub` on the server) ───
// Goes through the HTTP API like the web app: switches the ERP modules on (30-day trials), fills the company profile,
// three customers (individual / juristic / government) and one sample house taken through the whole money chain:
// baseline → accepted quotation → contract → two claims (one paid) → variation → PR / PO / goods receipt → five daily
// reports → timesheets + pay period → supplier bill + payment run → handover. Idempotent: the sample project is found
// by name and, once it exists, nothing is created again ("erp: already seeded"). Prints "erp: skipped" when the server
// does not offer `project-hub`.
import type { Call } from './seed-workforce';

export const ERP_PROJECT_NAME = 'บ้านพักอาศัย ERP ตัวอย่าง – คุณมานะ ตั้งใจ';

export interface ErpSeedContext {
    call: Call;
    /** Tokens of the demo accounts (the owner approves everything: approval policies allow self approval). */
    tokens: { owner: string; estimator: string; admin: string };
    workspaceId: string;
    /** YYYY-MM-DD, the day the plan is relative to. */
    today: string;
}

/** The ERP modules in dependency order (the legacy ones need nothing). */
const ERP_MODULES = [
    'project-hub', 'portal', 'boq-control', 'quotations', 'contracts', 'billing', 'variations',
    'procurement', 'site-diary', 'labour', 'job-cost', 'payables', 'handover',
] as const;
type ErpModule = (typeof ERP_MODULES)[number];

interface WorkspaceModule { module: string; available: boolean; enabled: boolean; active: boolean }
interface Row { id: string }

function addDays(iso: string, days: number): string {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/** A 13-digit tax id with a valid check digit. */
export function taxId(first12: string): string {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (13 - i);
    return `${first12}${String((11 - (sum % 11)) % 10)}`;
}

async function switchOn(ctx: ErpSeedContext): Promise<Set<ErpModule>> {
    const { call, tokens, workspaceId } = ctx;
    const list = async () => call<WorkspaceModule[]>('GET', `/workspaces/${workspaceId}/modules`, undefined, tokens.owner);
    let state = await list();
    for (const id of ERP_MODULES) {
        const m = state.find(s => s.module === id);
        if (m === undefined || !m.available || m.active) continue;
        if (!m.enabled) {
            try {
                await call('POST', `/workspaces/${workspaceId}/modules/${id}/trial`, undefined, tokens.owner);
            } catch {
                try {
                    await call('PUT', `/workspaces/${workspaceId}/modules/${id}`, { enabled: true }, tokens.owner);
                } catch (e) {
                    console.warn(`erp: cannot switch on ${id} (${e instanceof Error ? e.message : String(e)})`);
                }
            }
        }
        state = await list();
    }
    return new Set(ERP_MODULES.filter(id => state.find(s => s.module === id)?.active === true));
}

export async function seedErp(ctx: ErpSeedContext): Promise<void> {
    const { call, tokens, workspaceId, today } = ctx;
    const owner = tokens.owner;
    const offered = await call<{ modules: string[] }>('GET', '/platform/modules');
    if (!offered.modules.includes('project-hub')) {
        console.log('erp: skipped (the server does not offer project-hub; add the ERP modules to MODULES_ENABLED)');
        return;
    }
    const on = await switchOn(ctx);
    const has = (m: ErpModule): boolean => on.has(m);
    if (!has('project-hub')) {
        console.log('erp: skipped (project-hub could not be switched on for the company)');
        return;
    }
    console.log(`erp: modules on: ${[...on].join(', ')}`);

    // ── Company profile (the whole profile is sent: start from what is stored) ──
    const stored = await call<Record<string, unknown>>('GET', `/workspaces/${workspaceId}/company`, undefined, owner);
    const imageId = (f: unknown): string | null => (f as { id: string } | null)?.id ?? null;
    const { logo, stamp, signature, workspaceName: _w, isDefault: _d, effectiveProjectType: _e, updatedBy: _u, updatedAt: _a, ...profile } = stored;
    await call('PUT', `/workspaces/${workspaceId}/company`, {
        ...profile,
        logoFileId: imageId(logo),
        stampFileId: imageId(stamp),
        signatureFileId: imageId(signature),
        legalNameTh: 'บริษัท ตัวอย่างก่อสร้าง จำกัด',
        legalNameEn: 'Example Construction Co., Ltd.',
        taxId: taxId('010555100123'),
        branchCode: '00000',
        branchNameTh: 'สำนักงานใหญ่',
        branchNameEn: 'Head office',
        addressTh: '99/9 ถ.พุทธมณฑลสาย 2 แขวงศาลาธรรมสพน์ เขตทวีวัฒนา กรุงเทพมหานคร 10170',
        addressEn: '99/9 Phutthamonthon Sai 2 Rd., Thawi Watthana, Bangkok 10170',
        phone: '02-123-4567',
        email: 'info@example-construction.test',
        website: 'www.example-construction.test',
        vatRegistered: true,
        vatRate: 0.07,
        businessProfiles: ['residential', 'government'],
        defaultProjectType: 'residential_new',
        defaultDocLanguage: 'th',
        documentYearStyle: 'be',
        bankAccounts: [{ bankCode: 'KBANK', bankName: 'ธนาคารกสิกรไทย', accountName: 'บริษัท ตัวอย่างก่อสร้าง จำกัด', accountNo: '123-4-56789-0', branch: 'ศาลายา' }],
        promptpayId: '0105551001230',
        brandColor: '#1F4E79',
        documentFooterTh: 'ขอบคุณที่ไว้วางใจ',
        documentFooterEn: 'Thank you for your trust',
    }, owner);

    // ── Customers (matched by Thai name) ──
    const existing = await call<{ id: string; nameTh: string }[]>('GET', `/workspaces/${workspaceId}/customers`, undefined, owner);
    const customer = async (body: Record<string, unknown>): Promise<string> => {
        const found = existing.find(c => c.nameTh === body.nameTh);
        if (found !== undefined) return found.id;
        return (await call<Row>('POST', `/workspaces/${workspaceId}/customers`, body, owner)).id;
    };
    const person = await customer({ kind: 'individual', nameTh: 'คุณมานะ ตั้งใจ', nameEn: 'Mr. Mana Tangjai', addressTh: '12/3 ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี', contactName: 'คุณมานะ', phone: '081-555-0101', email: 'mana@example.test', lineId: 'mana.t', paymentTermDays: 7 });
    await customer({ kind: 'juristic', nameTh: 'บริษัท รุ่งเรืองพัฒนา จำกัด', nameEn: 'Rungruang Development Co., Ltd.', taxId: taxId('010555200456'), branchCode: '00000', addressTh: '88 ถ.สุขุมวิท กรุงเทพมหานคร 10110', contactName: 'คุณวิชัย', phone: '02-555-0202', email: 'ap@rungruang.test', paymentTermDays: 30 });
    await customer({ kind: 'government', nameTh: 'เทศบาลตำบลศาลายา', nameEn: 'Salaya Subdistrict Municipality', taxId: taxId('099400012345'), branchCode: '00000', addressTh: 'ต.ศาลายา อ.พุทธมณฑล จ.นครปฐม 73170', contactName: 'กองคลัง', phone: '02-555-0303', paymentTermDays: 45 });

    // ── The sample house ──
    const rows = await call<{ id: string; name: string }[]>('GET', `/workspaces/${workspaceId}/projects?archived=false`, undefined, owner);
    if (rows.some(r => r.name === ERP_PROJECT_NAME)) {
        console.log('erp: already seeded');
        return;
    }
    const created = await call<{ project: Row }>('POST', `/workspaces/${workspaceId}/projects`, { name: ERP_PROJECT_NAME, start: 'sample' }, owner);
    const projectId = created.project.id;
    await call('PATCH', `/projects/${projectId}/hub`, {
        customerId: person, projectType: 'residential_new', siteAddress: '12/3 ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี',
        plannedStart: addDays(today, -40), plannedFinish: addDays(today, 90), description: 'บ้านพักอาศัย 1 ชั้น ตัวอย่างสำหรับเดโม ERP',
    }, owner);
    await call('POST', `/projects/${projectId}/hub/code`, undefined, owner);

    const chain = await moneyChain(ctx, on, projectId);
    if (has('procurement')) chain.orderId = await procurement(ctx, projectId, chain.costCodes ?? []);
    const days = [-6, -5, -4, -3, -2].map(n => addDays(today, n));
    if (has('site-diary')) await siteDiary(ctx, projectId, chain.costCodes ?? [], days);
    if (has('labour')) await labour(ctx, projectId, chain.costCodes ?? [], days);
    if (has('payables')) await payables(ctx, projectId, chain.orderId);
    console.log(`erp: seeded "${ERP_PROJECT_NAME}" (${projectId})`);
}

interface Chain { contractId?: string; costCodes?: CostCode[]; orderId?: string }
interface Claim { id: string; lines: { costCodeId: string }[] }
interface Invoice { id: string; payable: number; customerId: string }
interface CostCode { id: string; code: string; sectionNo: number; baselineQty: number; baselineMatUnit: number | null; unit: string; descTh: string }
interface WithLines { id: string; lines: { id: string; costCodeId?: string | null; orderLineId?: string }[] }

async function moneyChain(ctx: ErpSeedContext, on: Set<ErpModule>, projectId: string): Promise<Chain> {
    const { call, tokens, today } = ctx;
    const owner = tokens.owner;
    const has = (m: ErpModule): boolean => on.has(m);
    const chain: Chain = {};

    if (has('quotations')) {
        const q = await call<{ id: string; quotationId: string }>('POST', `/projects/${projectId}/quotations`, { title: 'ใบเสนอราคา บ้านพักอาศัย 1 ชั้น' }, owner);
        const issued = await call<{ id: string; status: string }>('POST', `/quotation-versions/${q.id}/issue`, {}, owner);
        console.log(`erp: quotation ${issued.status}`);
        await call('POST', `/quotation-versions/${q.id}/record-response`, { action: 'accept', acceptedByName: 'คุณมานะ ตั้งใจ', note: 'ตกลงตามใบเสนอราคา' }, owner);
        if (has('contracts')) {
            const c = await call<{ id: string }>('POST', `/projects/${projectId}/main-contract`, { quotationId: q.quotationId, billingMode: 'progress' }, owner);
            const draft = await call<{ terms: Record<string, unknown> }>('GET', `/main-contracts/${c.id}`, undefined, owner);
            await call('PATCH', `/main-contracts/${c.id}`, {
                terms: { ...draft.terms, advancePct: 0.1, retentionPct: 0.05, warrantyMonths: 12 },
                startDate: addDays(today, -40), finishDate: addDays(today, 90),
            }, owner);
            await call('POST', `/main-contracts/${c.id}/sign`, { signDate: addDays(today, -42), startDate: addDays(today, -40) }, owner);
            chain.contractId = c.id;
            if (has('billing')) await claims(ctx, c.id);
            if (has('variations')) await variation(ctx, projectId);
            chain.costCodes = await call<CostCode[]>('GET', `/projects/${projectId}/cost-codes`, undefined, owner);
        }
    }
    return chain;
}

/** Two progress claims: the first (30%) certified, invoiced and paid; the second (55%) invoiced and still open. */
async function claims(ctx: ErpSeedContext, contractId: string): Promise<void> {
    const { call, tokens, today } = ctx;
    const owner = tokens.owner;
    const advance = await call<Invoice>('POST', `/main-contracts/${contractId}/advance-invoice`, {}, owner);
    const issuedAdvance = await call<Invoice>('POST', `/invoices/${advance.id}/issue`, {}, owner);
    await call('POST', `/workspaces/${ctx.workspaceId}/receipts`, {
        method: 'transfer', receiptDate: addDays(today, -35), bankRef: 'KBANK 0001',
        allocations: [{ invoiceId: issuedAdvance.id, cash: issuedAdvance.payable, wht: 0 }],
    }, owner);
    const run = async (cum: number, from: string, to: string, pay: boolean): Promise<void> => {
        const claim = await call<Claim>('POST', `/main-contracts/${contractId}/claims`, { periodFrom: from, periodTo: to }, owner);
        await call('PATCH', `/claims/${claim.id}`, { lines: claim.lines.map(l => ({ costCodeId: l.costCodeId, cumProgress: cum })) }, owner);
        await call('POST', `/claims/${claim.id}/submit`, undefined, owner);
        await call('POST', `/claims/${claim.id}/certify`, { certifiedByName: 'คุณมานะ ตั้งใจ', certifiedAt: to }, owner);
        const inv = await call<Invoice>('POST', `/claims/${claim.id}/invoice`, { issueDate: to }, owner);
        if (pay) {
            await call('POST', `/workspaces/${ctx.workspaceId}/receipts`, {
                method: 'transfer', receiptDate: addDays(to, 7), bankRef: 'KBANK 0002',
                allocations: [{ invoiceId: inv.id, cash: inv.payable, wht: 0 }],
            }, owner);
        }
    };
    await run(0.3, addDays(today, -40), addDays(today, -20), true);
    await run(0.55, addDays(today, -19), addDays(today, -2), false);
    console.log('erp: advance + 2 claims (1 paid)');
}

/** One change order: extra work with evidence, submitted and accepted. */
async function variation(ctx: ErpSeedContext, projectId: string): Promise<void> {
    const { call, tokens, today } = ctx;
    const owner = tokens.owner;
    const vo = await call<{ id: string }>('POST', `/projects/${projectId}/variations`, {
        title: 'เพิ่มประตูบานเลื่อนหน้าบ้าน', reason: 'owner_request', requestedByName: 'คุณมานะ ตั้งใจ', requestedDate: addDays(today, -10), scheduleImpactDays: 3,
    }, owner);
    await call('PUT', `/variations/${vo.id}/lines`, {
        lines: [{ sectionNo: 6, descTh: 'ประตูบานเลื่อนอลูมิเนียม 2.4 x 2.1 ม.', descEn: 'Aluminium sliding door 2.4 x 2.1 m', unit: 'ชุด', qtyDelta: 1, costMatUnit: 18000, costLabUnit: 2500 }],
    }, owner);
    await call('POST', `/variations/${vo.id}/evidence`, { kind: 'note', note: 'เจ้าของบ้านขอเพิ่มทางออกสวนหลังบ้าน ตกลงทางไลน์ ' + addDays(today, -10) }, owner);
    await call('POST', `/variations/${vo.id}/submit`, undefined, owner);
    await call('POST', `/variations/${vo.id}/record-response`, { action: 'accept', name: 'คุณมานะ ตั้งใจ', note: 'อนุมัติงานเพิ่ม' }, owner);
    console.log('erp: variation accepted');
}

/** Two suppliers; a site purchase request → RFQ with two quotes → award → PO issued → goods received. */
async function procurement(ctx: ErpSeedContext, projectId: string, codes: CostCode[]): Promise<string | undefined> {
    const { call, tokens, today, workspaceId } = ctx;
    const owner = tokens.owner;
    const picks = codes.filter(c => (c.baselineMatUnit ?? 0) > 0 && c.baselineQty > 0).slice(0, 2);
    if (picks.length === 0) return undefined;
    const supplier = async (n: string, nameTh: string, nameEn: string, taxFirst12: string, trades: string[]): Promise<string> =>
        (await call<Row>('POST', `/workspaces/${workspaceId}/suppliers`, {
            kind: 'material', nameTh, nameEn, taxId: taxId(taxFirst12), branchCode: '00000', contactName: `ฝ่ายขาย ${n}`, phone: '02-777-0000',
            email: `sales@${n}.test`, creditTermDays: 30, defaultWhtPreset: 'none', trades,
        }, owner)).id;
    const a = await supplier('tpi-mart', 'ห้างหุ้นส่วนจำกัด ทีพีไอ วัสดุก่อสร้าง', 'TPI Building Materials Ltd. Part.', '010355100111', []);
    const b = await supplier('siam-steel', 'บริษัท สยามสตีล เทรดดิ้ง จำกัด', 'Siam Steel Trading Co., Ltd.', '010555300222', []);
    const pr = await call<WithLines>('POST', `/projects/${projectId}/purchase-requests`, {
        source: 'site', requiredDate: addDays(today, 5), note: 'วัสดุงวดโครงสร้าง ขอซื้อตามหน้างาน',
        lines: picks.map(c => ({ costCodeId: c.id, qty: Math.max(1, Math.round(c.baselineQty * 0.1 * 100) / 100), estUnitPrice: c.baselineMatUnit ?? 0 })),
    }, owner);
    const submitted = await call<WithLines & { status: string }>('POST', `/purchase-requests/${pr.id}/submit`, { overrideReason: 'ตัวอย่างข้อมูลสำหรับเดโม' }, owner);
    const rfq = await call<WithLines>('POST', `/projects/${projectId}/rfqs`, {
        title: 'ขอราคาวัสดุงวดโครงสร้าง', dueDate: addDays(today, 3), requestLineIds: submitted.lines.map(l => l.id), supplierIds: [a, b],
    }, owner);
    await call('POST', `/rfqs/${rfq.id}/send`, undefined, owner);
    for (const [supplierId, factor] of [[a, 1.0], [b, 0.96]] as const) {
        await call('PUT', `/rfqs/${rfq.id}/quotes/${supplierId}`, {
            quoteRef: `QT-${supplierId.slice(0, 4)}`, quoteDate: addDays(today, -3), validUntil: addDays(today, 14), deliveryDays: 3, paymentTermDays: 30,
            lines: rfq.lines.map((l, i) => ({ rfqLineId: l.id, unitPrice: Math.round((picks[i]?.baselineMatUnit ?? 1) * factor * 100) / 100 })),
        }, owner);
    }
    const award = await call<{ orderId: string }>('POST', `/rfqs/${rfq.id}/award`, { supplierId: b }, owner);
    await call('POST', `/purchase-orders/${award.orderId}/issue`, { overrideReason: 'ตัวอย่างข้อมูลสำหรับเดโม' }, owner);
    const full = await call<{ id: string; status: string; lines: { id: string; qty: number }[] }>('GET', `/purchase-orders/${award.orderId}`, undefined, owner);
    if (full.status === 'issued') {
        const gr = await call<{ id: string }>('POST', `/purchase-orders/${award.orderId}/receipts`, {
            receivedDate: addDays(today, -1), deliveryNoteNo: 'DN-0001',
            lines: full.lines.map(l => ({ orderLineId: l.id, qtyReceived: l.qty })),
        }, owner);
        await call('POST', `/goods-receipts/${gr.id}/confirm`, undefined, owner);
    }
    console.log('erp: PR → RFQ → PO → goods receipt');
    return award.orderId;
}

const FIVE_DAY_SUMMARY = [
    'ผูกเหล็กเสาและคาน เตรียมแบบหล่อ', 'เทคอนกรีตเสาชั้นล่าง ฝนตกช่วงบ่าย', 'ถอดแบบเสา ก่ออิฐผนังด้านหน้า', 'ก่ออิฐผนังต่อเนื่อง วางท่อร้อยสาย', 'ก่ออิฐผนังด้านหลัง ตรวจงานร่วมกับเจ้าของ',
];

/** Five daily reports (submitted) with weather, manpower, progress per cost code and one open issue. */
async function siteDiary(ctx: ErpSeedContext, projectId: string, codes: CostCode[], days: string[]): Promise<void> {
    const { call, tokens } = ctx;
    const owner = tokens.owner;
    const picks = codes.filter(c => c.baselineQty > 0).slice(0, 3);
    for (const [i, date] of days.entries()) {
        await call('PUT', `/projects/${projectId}/site-diary/${date}`, {
            weatherMorning: 'sunny', weatherAfternoon: i === 1 ? 'rain' : 'cloudy', rainHours: i === 1 ? 2.5 : 0,
            summary: FIVE_DAY_SUMMARY[i] ?? '',
            manpower: [
                { crewName: 'ทีมโครงสร้างช่างสมชาย', trade: 'structure', skilledCount: 2, labourerCount: 4, hours: 8, costCodeId: picks[0]?.id ?? null },
                { crewName: 'ทีมก่อฉาบช่างแดง', trade: 'masonry', skilledCount: 2, labourerCount: 2, hours: 8 },
            ],
            workItems: picks.map((c, k) => ({ costCodeId: c.id, progressAfter: Math.min(0.9, 0.1 * (i + 1) * (k === 0 ? 1.4 : 1)), note: i === 4 ? 'ตามแผน' : '' })),
            issues: i === 1 ? [{ kind: 'weather', severity: 'medium', description: 'ฝนตกช่วงบ่าย หยุดเทคอนกรีต 2 ชั่วโมง' }] : [],
        }, owner);
        await call('POST', `/projects/${projectId}/site-diary/${date}/submit`, undefined, owner);
    }
    console.log('erp: 5 daily reports');
}

interface Person { id: string; dailyWage: number | null }

function payPeriodKey(date: string): string {
    return `${date.slice(0, 7)}-${Number(date.slice(8, 10)) <= 15 ? 'A' : 'B'}`;
}

/** Timesheets for the days of one half-month, approved; the period built, approved and paid; one wage advance. */
async function labour(ctx: ErpSeedContext, projectId: string, codes: CostCode[], days: string[]): Promise<void> {
    const { call, tokens, workspaceId } = ctx;
    const owner = tokens.owner;
    let people: Person[] = [];
    try {
        people = (await call<Person[]>('GET', `/workspaces/${workspaceId}/people`, undefined, owner)).filter(p => p.dailyWage !== null && p.dailyWage > 0).slice(0, 4);
    } catch {
        people = [];
    }
    if (people.length === 0) {
        for (const [name, role, wage] of [['สมชาย บุญมา', 'foreman', 1100], ['บุญมี ทองดี', 'skilled', 800], ['สมปอง แก้วใส', 'labourer', 500]] as const) {
            try {
                people.push(await call<Person>('POST', `/workspaces/${workspaceId}/people`, { name, role, employment: 'daily', trades: ['structure'], dailyWage: wage }, owner));
            } catch {
                break;
            }
        }
    }
    if (people.length === 0) {
        console.log('erp: labour skipped (no people with a daily wage; switch on workforce)');
        return;
    }
    const key = payPeriodKey(days[days.length - 1] ?? ctx.today);
    const worked = days.filter(d => payPeriodKey(d) === key);
    const costCodeId = codes.find(c => c.baselineQty > 0)?.id ?? null;
    for (const date of worked) {
        await call('PUT', `/projects/${projectId}/timesheets/${date}`, {
            entries: people.map(p => ({ personId: p.id, days: 1, otHours: 0, costCodeId })),
        }, owner);
    }
    await call('POST', `/projects/${projectId}/timesheets/approve`, { from: worked[0], to: worked[worked.length - 1] }, owner);
    const first = people[0];
    if (first !== undefined) {
        await call('POST', `/workspaces/${workspaceId}/wage-advances`, {
            personId: first.id, advanceDate: worked[0], amount: 500, reason: 'เบิกล่วงหน้าค่าแรง', paymentMethod: 'cash',
        }, owner);
    }
    await call('POST', `/workspaces/${workspaceId}/pay-periods/${key}/build`, undefined, owner);
    await call('POST', `/workspaces/${workspaceId}/pay-periods/${key}/approve`, undefined, owner);
    await call('POST', `/workspaces/${workspaceId}/pay-periods/${key}/pay`, { paymentMethod: 'transfer' }, owner);
    console.log(`erp: timesheets ${String(worked.length)} days + pay period ${key} paid`);
}

/** A bill from the purchase order and a service bill with 3% withholding, both approved and paid in one payment run. */
async function payables(ctx: ErpSeedContext, projectId: string, orderId: string | undefined): Promise<void> {
    const { call, tokens, today, workspaceId } = ctx;
    const owner = tokens.owner;
    const billIds: string[] = [];
    if (orderId !== undefined) {
        const bill = await call<Row>('POST', `/purchase-orders/${orderId}/bill`, {
            billDate: addDays(today, -1), supplierInvoiceNo: 'INV-68-0412', supplierInvoiceDate: addDays(today, -1),
            taxInvoiceNo: 'TX-68-0412', taxInvoiceDate: addDays(today, -1),
        }, owner);
        await call('POST', `/supplier-bills/${bill.id}/approve`, { note: 'ตรงกับใบรับของ' }, owner);
        billIds.push(bill.id);
    }
    const electrician = (await call<Row>('POST', `/workspaces/${workspaceId}/suppliers`, {
        kind: 'subcontractor', nameTh: 'ห้างหุ้นส่วนจำกัด พงษ์ไฟฟ้า เซอร์วิส', nameEn: 'Pong Electrical Service Ltd. Part.', taxId: taxId('010355400333'),
        branchCode: '00000', isJuristic: true, vatRegistered: false, contactName: 'ช่างพงษ์', phone: '081-772-3403', creditTermDays: 15, defaultWhtPreset: 'service', trades: [],
    }, owner)).id;
    const service = await call<Row>('POST', `/workspaces/${workspaceId}/supplier-bills`, {
        kind: 'service', supplierId: electrician, projectId, billDate: addDays(today, -1), supplierInvoiceNo: 'PS-0087',
        lines: [{ category: 'subcontract', desc: 'งานเดินท่อร้อยสายไฟฟ้า งวดที่ 1', unit: 'งาน', qty: 1, unitPrice: 24000 }],
    }, owner);
    await call('POST', `/supplier-bills/${service.id}/approve`, {}, owner);
    billIds.push(service.id);
    const run = await call<Row>('POST', `/workspaces/${workspaceId}/payment-runs`, { billIds, payDate: today, method: 'transfer', note: 'รอบจ่ายประจำสัปดาห์' }, owner);
    await call('POST', `/payment-runs/${run.id}/approve`, undefined, owner);
    await call('POST', `/payment-runs/${run.id}/pay`, { payDate: today, bankRef: 'KBANK-PV-0001' }, owner);
    console.log(`erp: ${String(billIds.length)} supplier bills + payment run paid`);
}
