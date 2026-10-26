import { type PriceItem, type StepResult } from '@/types';
import { CONCRETE_GRADE_COST, type ConcreteGrade } from '@/data/price-list';

export interface SectionRow {
    key: string;
    code: string;
    name: string;
    nameEn?: string;
    qty: number | null;
    uom: string;
    uomEn?: string;
    matUnit: number | null;
    matTotal: number | null;
    labUnit: number | null;
    labTotal: number | null;
    total: number | null;
}

export interface Section {
    stepNo: number;
    title: string;
    titleEn: string;
    hasData: boolean;
    rows: SectionRow[];
    sectionTotal: number;
}

export interface CategoryGroup {
    id: string;
    name: string;
    nameEn: string;
    stepNos: number[];
}

export const BOQ_CATEGORIES: CategoryGroup[] = [
    { id: 'C1', name: 'หมวดเตรียมการและงานดิน', nameEn: 'Preliminaries & Earthwork', stepNos: [0, 1, 2, 3, 4] },
    { id: 'C2', name: 'หมวดงานโครงสร้างใต้ดิน', nameEn: 'Substructure', stepNos: [5, 6, 7, 8] },
    { id: 'C3', name: 'หมวดงานโครงสร้างส่วนบน (พื้น คาน บันได)', nameEn: 'Superstructure', stepNos: [9, 10, 11, 12, 13, 14] },
    { id: 'C4', name: 'หมวดงานโครงสร้างและมุงหลังคา', nameEn: 'Roofing', stepNos: [15, 16] },
    { id: 'C5', name: 'หมวดงานสถาปัตยกรรม (ผนัง ฝ้า สี)', nameEn: 'Architectural & Finishes', stepNos: [17, 18, 19, 20, 21, 22, 23, 24, 25, 31, 32] },
    { id: 'C6', name: 'หมวดงานระบบ M&E', nameEn: 'MEP Works', stepNos: [26, 27, 28, 30] },
    { id: 'C7', name: 'หมวดงานเบ็ดเตล็ดและส่งมอบ', nameEn: 'Misc & Handover', stepNos: [29, 33, 34] },
];

import { PRICE_LIST_I18N } from '@/data/price-list-i18n';

export function makeRow(
    priceList: PriceItem[],
    code: string,
    qty: number,
    key: string,
): SectionRow | null {
    const p = priceList.find(x => x.code === code);
    const safeQty = isNaN(qty) ? 0 : qty;
    
    if (!p || safeQty <= 0) return null;
    
    const mat = safeQty * p.costMaterial;
    const lab = safeQty * p.costLabor;
    const i18n = PRICE_LIST_I18N[p.code];
    return {
        key, code: p.code, name: p.name, nameEn: i18n?.nameEn, qty: safeQty, uom: p.uom, uomEn: i18n?.uomEn,
        matUnit: p.costMaterial, matTotal: mat,
        labUnit: p.costLabor, labTotal: lab,
        total: mat + lab,
    };
}

/**
 * Like makeRow but overrides the material cost using the selected concrete grade.
 * Falls back to the price list default if grade is undefined.
 */
export function makeRowGrade(
    priceList: PriceItem[],
    code: string,
    qty: number,
    key: string,
    grade?: ConcreteGrade,
): SectionRow | null {
    const p = priceList.find(x => x.code === code);
    const safeQty = isNaN(qty) ? 0 : qty;
    if (!p || safeQty <= 0) return null;
    
    const matUnit = grade ? CONCRETE_GRADE_COST[grade] : p.costMaterial;
    const mat = safeQty * matUnit;
    const lab = safeQty * p.costLabor;
    const i18n = PRICE_LIST_I18N[p.code];
    return {
        key, code: p.code, name: p.name, nameEn: i18n?.nameEn, qty: safeQty, uom: p.uom, uomEn: i18n?.uomEn,
        matUnit, matTotal: mat,
        labUnit: p.costLabor, labTotal: lab,
        total: mat + lab,
    };
}

/**
 * Helper to dynamically map concrete quantities.
 * If the SKU is 'CON-MANUAL', it explodes into 4 constituent raw materials (Cement, Sand, Stone, Mix Labor).
 * Normal SKUs return the standard single row.
 */
function explodeConcreteRows(
    priceList: PriceItem[],
    qtyObj: { sku?: string; qty?: number } | undefined,
    defaultSku: string,
    baseWbs: string
): (SectionRow | null)[] {
    if (!qtyObj || (qtyObj.qty ?? 0) <= 0) return [];
    
    const sku = qtyObj.sku ?? defaultSku;
    const vol = qtyObj.qty ?? 0;
    
    if (sku === 'CON-MANUAL') {
        // Manual mix 1:2:4 ratio per 1 cubic meter
        return [
            makeRow(priceList, 'CON-MIX-CEMENT', vol * 7,    `${baseWbs}.1`),
            makeRow(priceList, 'CON-MIX-SAND',   vol * 0.55, `${baseWbs}.2`),
            makeRow(priceList, 'CON-MIX-STONE',  vol * 1.05, `${baseWbs}.3`),
            makeRow(priceList, 'LAB-MIX-CONC',   vol,        `${baseWbs}.4`),
        ];
    }
    
    return [makeRow(priceList, sku, vol, baseWbs)];
}

export function buildBOQSections(
    stepSaves: Record<number, { inp?: unknown; res: StepResult } | undefined>,
    priceList: PriceItem[]
): Section[] {
const build = (
            stepNo: number, title: string, titleEn: string,
            getRows: () => (SectionRow | null)[],
        ): Section => {
            const rows = getRows().filter((r): r is SectionRow => r !== null);
            return { stepNo, title, titleEn, hasData: rows.length > 0, rows, sectionTotal: rows.reduce((s, r) => s + (r.total ?? 0), 0) };
        };

        return [
            build(0, 'งานสำรวจที่ดิน / หมุดหลัก', 'Land Survey & Benchmark', () => {
                const q = stepSaves[0]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'SRV-CREW',   q.survey_man_days?.qty ?? 0,    '0.1'),
                    makeRow(priceList, 'SRV-EQUIP',  q.equipment_rental?.qty ?? 0,   '0.2'),
                    makeRow(priceList, 'SRV-BM',     q.benchmark_points?.qty ?? 0,   '0.3'),
                    makeRow(priceList, 'SRV-MARKER', q.boundary_markers?.qty ?? 0,   '0.4'),
                    makeRow(priceList, 'SRV-TOPO',   q.topo_area?.qty ?? 0,          '0.5'),
                    makeRow(priceList, 'SRV-PHOTO',  q.photo_doc?.qty ?? 0,          '0.6'),
                ] : [];
            }),
            build(1, 'งานถมดิน', 'Earthwork & Compaction', () => {
                const q = stepSaves[1]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'SITE-CLEAR',      q.site_clearance?.qty ?? 0,         '1.0.1'),
                    makeRow(priceList, 'SITE-DEMO',       q.demolition_debris?.qty ?? 0,      '1.0.2'),
                    makeRow(priceList, 'FILL-SITE',       q.volume_general?.qty ?? 0,         '1.1.1'),
                    makeRow(priceList, 'FILL-SELECTED',   q.volume_selected?.qty ?? 0,        '1.1.2'),
                    makeRow(priceList, 'FILL-SOFT',       q.volume_soft?.qty ?? 0,            '1.1.3'),
                    makeRow(priceList, 'FILL-SAND-FILL',  q.volume_sand?.qty ?? 0,            '1.1.4'),
                    makeRow(priceList, 'FILL-ROCK',       q.volume_rock?.qty ?? 0,            '1.1.5'),
                    makeRow(priceList, 'FILL-TRUCK',      q.truck_trips?.qty ?? 0,            '1.2'),
                    makeRow(priceList, 'FILL-BACKHOE',    q.backhoe_hours?.qty ?? 0,          '1.3'),
                    makeRow(priceList, 'FILL-ROLLER',     q.roller_hours?.qty ?? 0,           '1.4'),
                    makeRow(priceList, 'FILL-FDT',        q.soil_test_points?.qty ?? 0,       '1.5'),
                ] : [];
            }),
            build(2, 'งานน้ำ–ไฟชั่วคราว', 'Temporary Utilities', () => {
                const q = stepSaves[2]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'UTIL-CABLE',   q.cable_length?.qty ?? 0,       '2.1'),
                    makeRow(priceList, 'UTIL-CONDUIT', q.conduit_length?.qty ?? 0,     '2.2'),
                    makeRow(priceList, 'UTIL-PIPE',    q.water_pipe_length?.qty ?? 0,  '2.3'),
                    makeRow(priceList, 'UTIL-FITTING', q.fittings?.qty ?? 0,           '2.4'),
                    makeRow(priceList, 'UTIL-VALVE',   q.valves?.qty ?? 0,             '2.5'),
                    makeRow(priceList, 'UTIL-DB',      q.db_required?.qty ?? 0,        '2.6'),
                    makeRow(priceList, 'UTIL-GROUND',  q.ground_rod?.qty ?? 0,         '2.7'),
                    makeRow(priceList, 'UTIL-TANK',    q.water_tank?.qty ?? 0,         '2.8'),
                    makeRow(priceList, 'UTIL-METER',     q.temp_meter?.qty ?? 0,         '2.9.1'),
                    makeRow(priceList, 'UTIL-METER-E15', q.meter_e15?.qty ?? 0,          '2.9.2'),
                    makeRow(priceList, 'UTIL-METER-E30', q.meter_e30?.qty ?? 0,          '2.9.3'),
                    makeRow(priceList, 'UTIL-METER-E3P', q.meter_e3p?.qty ?? 0,          '2.9.4'),
                    makeRow(priceList, 'UTIL-METER-W15', q.meter_w15?.qty ?? 0,          '2.9.5'),
                    makeRow(priceList, 'UTIL-METER-W20', q.meter_w20?.qty ?? 0,          '2.9.6'),
                    makeRow(priceList, 'UTIL-PERMIT',  q.permit?.qty ?? 0,             '2.10'),
                ] : [];
            }),
            build(3, 'เตรียมพื้นที่หน้างาน', 'Site Preparation', () => {
                const q = stepSaves[3]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'SITE-FENCE-ZINC', q.fence_zinc?.qty ?? 0,              '3.1.1'),
                    makeRow(priceList, 'SITE-FENCE-MESH', q.fence_mesh?.qty ?? 0,              '3.1.2'),
                    makeRow(priceList, 'SITE-FENCE-BLK',  q.fence_block?.qty ?? 0,             '3.1.3'),
                    makeRow(priceList, 'SITE-GATE',    q.gate?.qty ?? 0,                     '3.2'),
                    makeRow(priceList, 'SITE-CAMP',    q.camp_area?.qty ?? 0,                '3.3'),
                    makeRow(priceList, 'SITE-DRAIN',   q.temporary_drain_length?.qty ?? 0,   '3.4'),
                    makeRow(priceList, 'SITE-TOILET',  q.toilet_rental?.qty ?? 0,            '3.5'),
                    makeRow(priceList, 'SITE-ROAD',    q.access_gravel?.qty ?? 0,            '3.6'),
                    makeRow(priceList, 'SITE-SIGN',    q.site_sign?.qty ?? 0,                '3.7'),
                    makeRow(priceList, 'SITE-SAFETY',  q.safety_signs?.qty ?? 0,             '3.8'),
                    makeRow(priceList, 'SITE-MOBIL',   q.mobilization?.qty ?? 0,             '3.9'),
                    makeRow(priceList, 'SITE-DEMOB',   q.demobilization?.qty ?? 0,           '3.10'),
                ] : [];
            }),
            build(4, 'งานวางผัง', 'Site Layout', () => {
                const q = stepSaves[4]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'LAYOUT-STR',    q.string_length?.qty ?? 0,       '4.1'),
                    makeRow(priceList, 'LAYOUT-BOARD',  q.total_board?.qty ?? 0,         '4.2'),
                    makeRow(priceList, 'LAYOUT-STK',    q.stake_required?.qty ?? 0,      '4.3'),
                    makeRow(priceList, 'LAYOUT-NAIL',   q.nail_count?.qty ?? 0,          '4.4'),
                    makeRow(priceList, 'LAYOUT-MARKER', q.concrete_markers?.qty ?? 0,    '4.5'),
                    makeRow(priceList, 'LAYOUT-SPRAY',  q.spray_paint?.qty ?? 0,         '4.6'),
                    makeRow(priceList, 'LAYOUT-CREW',   q.survey_man_days?.qty ?? 0,     '4.7'),
                ] : [];
            }),
            build(5, 'งานเสาเข็ม', 'Piling Works', () => {
                const q = stepSaves[5]?.res.quantities;
                return q ? [
                    // ── I-Shape Square Piles (by meter) ──
                    makeRow(priceList, 'PILE-I15',       q.pile_i15?.qty ?? 0,                 '5.1.1'),
                    makeRow(priceList, 'PILE-I18',       q.pile_i18?.qty ?? 0,                 '5.1.2'),
                    makeRow(priceList, 'PILE-I20',       q.pile_i20?.qty ?? 0,                 '5.1.3'),
                    makeRow(priceList, 'PILE-I22',       q.pile_i22?.qty ?? 0,                 '5.1.4'),
                    makeRow(priceList, 'PILE-I26',       q.pile_i26?.qty ?? 0,                 '5.1.5'),
                    makeRow(priceList, 'PILE-I30',       q.pile_i30?.qty ?? 0,                 '5.1.6'),
                    makeRow(priceList, 'PILE-I35',       q.pile_i35?.qty ?? 0,                 '5.1.7'),
                    makeRow(priceList, 'PILE-I40',       q.pile_i40?.qty ?? 0,                 '5.1.8'),
                    makeRow(priceList, 'PILE-I45',       q.pile_i45?.qty ?? 0,                 '5.1.9'),
                    makeRow(priceList, 'PILE-I525',      q.pile_i525?.qty ?? 0,                '5.1.10'),
                    // ── Spun Piles (by piece) ──
                    makeRow(priceList, 'PILE-SP25',      q.pile_sp25?.qty ?? 0,                '5.2.1'),
                    makeRow(priceList, 'PILE-SP30',      q.pile_sp30?.qty ?? 0,                '5.2.2'),
                    makeRow(priceList, 'PILE-SP35',      q.pile_sp35?.qty ?? 0,                '5.2.3'),
                    makeRow(priceList, 'PILE-SP40',      q.pile_sp40?.qty ?? 0,                '5.2.4'),
                    makeRow(priceList, 'PILE-SP45',      q.pile_sp45?.qty ?? 0,                '5.2.5'),
                    makeRow(priceList, 'PILE-SP50',      q.pile_sp50?.qty ?? 0,                '5.2.6'),
                    makeRow(priceList, 'PILE-SP60',      q.pile_sp60?.qty ?? 0,                '5.2.7'),
                    makeRow(priceList, 'PILE-SP80',      q.pile_sp80?.qty ?? 0,                '5.2.8'),
                    // ── Mini Pile 15cm (by piece) ──
                    makeRow(priceList, 'PILE-MINI-2M',   q.pile_mini_2m?.qty ?? 0,             '5.3.1'),
                    makeRow(priceList, 'PILE-MINI-3M',   q.pile_mini_3m?.qty ?? 0,             '5.3.2'),
                    makeRow(priceList, 'PILE-MINI-4M',   q.pile_mini_4m?.qty ?? 0,             '5.3.3'),
                    makeRow(priceList, 'PILE-MINI-5M',   q.pile_mini_5m?.qty ?? 0,             '5.3.4'),
                    makeRow(priceList, 'PILE-MINI-6M',   q.pile_mini_6m?.qty ?? 0,             '5.3.5'),
                    // ── CPAC Mini Pile 10×12 (by piece) ──
                    makeRow(priceList, 'PILE-CPAC-2M',   q.pile_cpac_2m?.qty ?? 0,             '5.3.6'),
                    makeRow(priceList, 'PILE-CPAC-3M',   q.pile_cpac_3m?.qty ?? 0,             '5.3.7'),
                    makeRow(priceList, 'PILE-CPAC-4M',   q.pile_cpac_4m?.qty ?? 0,             '5.3.8'),
                    makeRow(priceList, 'PILE-CPAC-5M',   q.pile_cpac_5m?.qty ?? 0,             '5.3.9'),
                    // ── Bored Pile ──
                    makeRow(priceList, 'PILE-BRD-CON',   q.total_volume?.qty ?? 0,             '5.4'),
                    // ── Labor Surcharge (Low Volume) ──
                    makeRow(priceList, 'PILE-LABOR-SURCHARGE', q.labor_surcharge?.qty ?? 0,    '5.5'),
                    
                    // ── Services & Testing ──
                    makeRow(priceList, 'PILE-MACHINE',   q.machine_days?.qty ?? 0,       '5.6.1'),
                    makeRow(priceList, 'PILE-TRANSPORT',  q.transport_trips?.qty ?? 0,    '5.6.2'),
                    
                    // Pile Head Cutting (Mapped dynamically by size)
                    makeRow(priceList, 'PILE-CUT-D15',   q.pile_cut_d15?.qty ?? 0,       '5.6.3a'),
                    makeRow(priceList, 'PILE-CUT-D18',   q.pile_cut_d18?.qty ?? 0,       '5.6.3b'),
                    makeRow(priceList, 'PILE-CUT-D20',   q.pile_cut_d20?.qty ?? 0,       '5.6.3c'),
                    makeRow(priceList, 'PILE-CUT-D22',   q.pile_cut_d22?.qty ?? 0,       '5.6.3d'),
                    makeRow(priceList, 'PILE-CUT-D26',   q.pile_cut_d26?.qty ?? 0,       '5.6.3e'),
                    makeRow(priceList, 'PILE-CUT-D30',   q.pile_cut_d30?.qty ?? 0,       '5.6.3f'),
                    makeRow(priceList, 'PILE-CUT-D35',   q.pile_cut_d35?.qty ?? 0,       '5.6.3g'),
                    makeRow(priceList, 'PILE-CUT-D40',   q.pile_cut_d40?.qty ?? 0,       '5.6.3h'),
                    makeRow(priceList, 'PILE-CUT-B30',   q.pile_cut_b30?.qty ?? 0,       '5.6.3i'),
                    makeRow(priceList, 'PILE-CUT-B35',   q.pile_cut_b35?.qty ?? 0,       '5.6.3j'),
                    makeRow(priceList, 'PILE-CUT-B40',   q.pile_cut_b40?.qty ?? 0,       '5.6.3k'),
                    makeRow(priceList, 'PILE-CUT-B50',   q.pile_cut_b50?.qty ?? 0,       '5.6.3l'),
                    makeRow(priceList, 'PILE-CUT-B60',   q.pile_cut_b60?.qty ?? 0,       '5.6.3m'),
                    makeRow(priceList, 'PILE-CUT-MINI',  q.pile_cut_mini?.qty ?? 0,      '5.6.3n'),
                    
                    makeRow(priceList, 'PILE-DOWEL',     q.pile_dowel?.qty ?? 0,         '5.6.4'),
                    makeRow(priceList, 'PILE-WELD',      q.welding_joint?.qty ?? 0,      '5.6.5'),
                    makeRow(priceList, 'PILE-CAGE',      q.rebar_cage?.qty ?? 0,         '5.6.6'),
                    makeRow(priceList, 'PILE-BENTO',     q.bentonite?.qty ?? 0,          '5.6.7'),
                    makeRow(priceList, 'PILE-CASING',    q.casing?.qty ?? 0,             '5.6.8'),
                    // Assuming step saves type text for load test, but since we separated 
                    makeRow(priceList, 'PILE-LOADTEST',  (stepSaves[5]?.inp as { load_test_type?: string })?.load_test_type === 'dynamic' ? (q.load_test?.qty ?? 0) : 0, '5.6.9'),
                    makeRow(priceList, 'PILE-LOADTEST-STATIC', (stepSaves[5]?.inp as { load_test_type?: string })?.load_test_type === 'static' ? (q.load_test?.qty ?? 0) : 0, '5.6.10'),
                    makeRow(priceList, 'PILE-SEISMIC',   q.seismic_test?.qty ?? 0,       '5.6.11'),
                    makeRow(priceList, 'PILE-SOIL',      q.soil_boring?.qty ?? 0,        '5.6.12'),
                ] : [];
            }),
            build(6, 'งานฐานราก', 'Foundation Footing', () => {
                const q = stepSaves[6]?.res.quantities;
                return q ? [
                    makeRow(priceList, q.excavation_volume?.sku ?? 'FTG-EXC',    q.excavation_volume?.qty ?? 0,    '6.1'),
                    makeRow(priceList, q.sand_volume?.sku ?? 'FTG-SAND',         q.sand_volume?.qty ?? 0,          '6.2'),
                    makeRow(priceList, q.lean_volume?.sku ?? 'FTG-LEAN',         q.lean_volume?.qty ?? 0,          '6.3'),
                    ...explodeConcreteRows(priceList, q.concrete_volume, 'FTG-CON', '6.4.1'),
                    makeRow(priceList, q.waterproof_admix?.sku ?? 'CON-ADMIX-WP',q.waterproof_admix?.qty ?? 0,    '6.4.2'),
                    makeRow(priceList, q.pour_labor?.sku ?? 'LAB-POUR-GRND',     q.pour_labor?.qty ?? 0,          '6.4.3'),
                    makeRow(priceList, q.rebar_kg?.sku ?? 'FTG-REBAR',           q.rebar_kg?.qty ?? 0,             '6.5'),
                    makeRow(priceList, q.tie_wire?.sku ?? 'FTG-WIRE',            q.tie_wire?.qty ?? 0,             '6.6'),
                    makeRow(priceList, q.spacer?.sku ?? 'FTG-SPACER',            q.spacer?.qty ?? 0,               '6.7'),
                    makeRow(priceList, q.formwork_m2?.sku ?? 'FTG-FORM',         q.formwork_m2?.qty ?? 0,          '6.8'),
                    makeRow(priceList, q.backfill_volume?.sku ?? 'FTG-FILL',     q.backfill_volume?.qty ?? 0,      '6.9'),
                    makeRow(priceList, q.concrete_pump?.sku ?? 'FTG-PUMP',       q.concrete_pump?.qty ?? 0,        '6.10'),
                    makeRow(priceList, q.dewatering?.sku ?? 'FTG-DEWATER',       q.dewatering?.qty ?? 0,           '6.11'),
                    makeRow(priceList, q.vibrator?.sku ?? 'FTG-VIBRATOR',        q.vibrator?.qty ?? 0,             '6.12'),
                    makeRow(priceList, q.curing?.sku ?? 'FTG-CURING',            q.curing?.qty ?? 0,               '6.13'),
                ] : [];
            }),
            build(7, 'งานเสาตอม่อ', 'Pedestal / Column Stump', () => {
                const q = stepSaves[7]?.res.quantities;
                return q ? [
                    ...explodeConcreteRows(priceList, q.concrete_volume, 'PDS-CON', '7.1.1'),
                    makeRow(priceList, q.waterproof_admix?.sku ?? 'CON-ADMIX-WP',q.waterproof_admix?.qty ?? 0,  '7.1.2'),
                    makeRow(priceList, q.pour_labor?.sku ?? 'LAB-POUR-1FL',      q.pour_labor?.qty ?? 0,        '7.1.3'),
                    makeRow(priceList, q.rebar_kg?.sku ?? 'PDS-REBAR',           q.rebar_kg?.qty ?? 0,          '7.2'),
                    makeRow(priceList, q.tie_wire?.sku ?? 'RB-WIRE',             q.tie_wire?.qty ?? 0,          '7.3'),
                    makeRow(priceList, q.spacer?.sku ?? 'RB-SPACER',             q.spacer?.qty ?? 0,            '7.4'),
                    makeRow(priceList, q.formwork_m2?.sku ?? 'PDS-FORM',         q.formwork_m2?.qty ?? 0,       '7.5'),
                    makeRow(priceList, q.dowel_bar?.sku ?? 'PDS-DOWEL',          q.dowel_bar?.qty ?? 0,         '7.6'),
                    makeRow(priceList, q.concrete_pump?.sku ?? 'PDS-PUMP',       q.concrete_pump?.qty ?? 0,     '7.7'),
                    makeRow(priceList, q.vibrator?.sku ?? 'PDS-VIBRATOR',        q.vibrator?.qty ?? 0,          '7.8'),
                    makeRow(priceList, q.curing?.sku ?? 'PDS-CURING',            q.curing?.qty ?? 0,            '7.9'),
                ] : [];
            }),
            build(8, 'งานคานคอดิน', 'Ground Beam', () => {
                const q = stepSaves[8]?.res.quantities;
                return q ? [
                    makeRow(priceList, q.excavation_volume?.sku ?? 'GBM-EXC',    q.excavation_volume?.qty ?? 0,   '8.1'),
                    makeRow(priceList, q.sand_volume?.sku ?? 'GBM-SAND',         q.sand_volume?.qty ?? 0,         '8.2'),
                    makeRow(priceList, q.lean_volume?.sku ?? 'GBM-LEAN',         q.lean_volume?.qty ?? 0,         '8.3'),
                    ...explodeConcreteRows(priceList, q.concrete_volume, 'GBM-CON', '8.4.1'),
                    makeRow(priceList, q.waterproof_admix?.sku ?? 'CON-ADMIX-WP',q.waterproof_admix?.qty ?? 0,    '8.4.2'),
                    makeRow(priceList, q.pour_labor?.sku ?? 'LAB-POUR-1FL',      q.pour_labor?.qty ?? 0,          '8.4.3'),
                    makeRow(priceList, q.rebar_kg?.sku ?? 'GBM-REBAR',           q.rebar_kg?.qty ?? 0,            '8.5'),
                    makeRow(priceList, q.tie_wire?.sku ?? 'RB-WIRE',             q.tie_wire?.qty ?? 0,            '8.6'),
                    makeRow(priceList, q.spacer?.sku ?? 'RB-SPACER',             q.spacer?.qty ?? 0,              '8.7'),
                    makeRow(priceList, q.formwork_m2?.sku ?? 'GBM-FORM',         q.formwork_m2?.qty ?? 0,         '8.8'),
                    makeRow(priceList, q.backfill_volume?.sku ?? 'GBM-FILL',     q.backfill_volume?.qty ?? 0,     '8.9'),
                    makeRow(priceList, q.dowel_length?.sku ?? 'GBM-DOWEL',       q.dowel_length?.qty ?? 0,        '8.10'),
                    makeRow(priceList, q.concrete_pump?.sku ?? 'GBM-PUMP',       q.concrete_pump?.qty ?? 0,       '8.11'),
                    makeRow(priceList, q.vibrator?.sku ?? 'GBM-VIBRATOR',        q.vibrator?.qty ?? 0,            '8.12'),
                    makeRow(priceList, q.curing?.sku ?? 'GBM-CURING',            q.curing?.qty ?? 0,              '8.13'),
                    makeRow(priceList, q.termite_pipe?.sku ?? 'GBM-TERMITE',     q.termite_pipe?.qty ?? 0,        '8.14'),
                ] : [];
            }),
            build(9, 'งานพื้นหล่อในที่', 'Slab on Grade', () => {
                const q = stepSaves[9]?.res.quantities;
                return q ? [
                    makeRow(priceList, q.sand_volume?.sku ?? 'SOG-SAND',         q.sand_volume?.qty ?? 0,          '9.1'),
                    makeRow(priceList, q.plastic_area?.sku ?? 'SOG-PLASTIC',     q.plastic_area?.qty ?? 0,         '9.2'),
                    makeRow(priceList, q.wiremesh_kg?.sku ?? 'SOG-MESH',         q.wiremesh_kg?.qty ?? 0,          '9.3.1'),
                    makeRow(priceList, q.rebar_kg?.sku ?? 'SOG-REBAR',           q.rebar_kg?.qty ?? 0,             '9.3.2'),
                    makeRow(priceList, q.tie_wire?.sku ?? 'RB-WIRE',             q.tie_wire?.qty ?? 0,             '9.3.3'),
                    ...explodeConcreteRows(priceList, q.concrete_volume, 'SOG-CON', '9.4.1'),
                    makeRow(priceList, q.waterproof_admix?.sku ?? 'CON-ADMIX-WP',q.waterproof_admix?.qty ?? 0,     '9.4.2'),
                    makeRow(priceList, q.pour_labor?.sku ?? 'LAB-POUR-GRND',     q.pour_labor?.qty ?? 0,           '9.4.3'),
                    makeRow(priceList, q.edge_formwork_m?.sku ?? 'SOG-FORM-EDG', q.edge_formwork_m?.qty ?? 0,      '9.5'),
                    makeRow(priceList, q.control_joint?.sku ?? 'SOG-CJOINT',     q.control_joint?.qty ?? 0,        '9.6'),
                    makeRow(priceList, q.expansion_joint?.sku ?? 'SOG-EJOINT',   q.expansion_joint?.qty ?? 0,      '9.7'),
                    makeRow(priceList, q.concrete_pump?.sku ?? 'SOG-PUMP',       q.concrete_pump?.qty ?? 0,        '9.8'),
                    makeRow(priceList, q.vibrator?.sku ?? 'SOG-VIBRATOR',        q.vibrator?.qty ?? 0,             '9.9'),
                    makeRow(priceList, q.curing?.sku ?? 'SOG-CURING',            q.curing?.qty ?? 0,               '9.10'),
                    makeRow(priceList, q.hardener?.sku ?? 'SOG-HARDENER',        q.hardener?.qty ?? 0,             '9.11'),
                    makeRow(priceList, q.sleeve?.sku ?? 'SOG-SLEEVE',            q.sleeve?.qty ?? 0,               '9.12'),
                ] : [];
            }),
            build(10, 'งานพื้นสำเร็จรูป', 'Precast Slab', () => {
                const q = stepSaves[10]?.res.quantities;
                return q ? [
                    makeRow(priceList, q.panel_area?.sku ?? 'PCS-PANEL',       q.panel_area?.qty ?? 0,       '10.1'),
                    makeRow(priceList, q.wiremesh_kg?.sku ?? 'PCS-MESH',       q.wiremesh_kg?.qty ?? 0,      '10.2'),
                    ...explodeConcreteRows(priceList, q.topping_volume, 'PCS-TOP-CON', '10.3.1'),
                    makeRow(priceList, q.waterproof_admix?.sku ?? 'CON-ADMIX-WP', q.waterproof_admix?.qty ?? 0, '10.3.2'),
                    makeRow(priceList, q.pour_labor?.sku ?? 'LAB-POUR-1FL',    q.pour_labor?.qty ?? 0,       '10.3.3'),
                    makeRow(priceList, q.shoring_length?.sku ?? 'PCS-SHORE',   q.shoring_length?.qty ?? 0,   '10.4'),
                    makeRow(priceList, q.grout?.sku ?? 'PCS-GROUT',            q.grout?.qty ?? 0,            '10.5'),
                    makeRow(priceList, q.crane?.sku ?? 'PCS-CRANE',            q.crane?.qty ?? 0,            '10.6'),
                    makeRow(priceList, q.concrete_pump?.sku ?? 'PCS-PUMP',     q.concrete_pump?.qty ?? 0,    '10.7'),
                    makeRow(priceList, q.vibrator?.sku ?? 'PCS-VIBRATOR',      q.vibrator?.qty ?? 0,         '10.8'),
                    makeRow(priceList, q.curing?.sku ?? 'PCS-CURING',          q.curing?.qty ?? 0,           '10.9'),
                    makeRow(priceList, q.termite_pipe?.sku ?? 'PCS-TERMITE',   q.termite_pipe?.qty ?? 0,     '10.10'),
                    makeRow(priceList, q.delivery?.sku ?? 'PCS-DELIVERY',      q.delivery?.qty ?? 0,         '10.11'),
                ] : [];
            }),
            build(11, 'งานเสาชั้น 1', 'Column Floor 1', () => {
                const q = stepSaves[11]?.res.quantities;
                return q ? [
                    ...explodeConcreteRows(priceList, q.concrete_volume, 'COL-CON', '11.1.1'),
                    makeRow(priceList, q.waterproof_admix?.sku ?? 'CON-ADMIX-WP',   q.waterproof_admix?.qty ?? 0, '11.1.2'),
                    makeRow(priceList, q.pour_labor?.sku ?? 'LAB-POUR-1FL',         q.pour_labor?.qty ?? 0,       '11.1.3'),
                    makeRow(priceList, q.rebar_kg?.sku ?? 'COL-REBAR',              q.rebar_kg?.qty ?? 0,         '11.2.1'),
                    makeRow(priceList, q.tie_wire?.sku ?? 'RB-WIRE',                q.tie_wire?.qty ?? 0,         '11.2.2'),
                    makeRow(priceList, q.spacer?.sku ?? 'RB-SPACER',                q.spacer?.qty ?? 0,           '11.2.3'),
                    makeRow(priceList, q.formwork_area?.sku ?? 'COL-FORM',          q.formwork_area?.qty ?? 0,    '11.3'),
                    makeRow(priceList, q.concrete_pump?.sku ?? 'COL-PUMP',          q.concrete_pump?.qty ?? 0,    '11.4'),
                    makeRow(priceList, q.vibrator?.sku ?? 'COL-VIBRATOR',           q.vibrator?.qty ?? 0,         '11.5'),
                    makeRow(priceList, q.curing?.sku ?? 'COL-CURING',               q.curing?.qty ?? 0,           '11.6'),
                ] : [];
            }),
            build(12, 'งานคาน + พื้นดาดฟ้า', 'Beam + Roof Deck', () => {
                const q = stepSaves[12]?.res.quantities;
                return q ? [
                    ...explodeConcreteRows(priceList, q.beam_concrete, 'BMS-CON', '12.1.1'),
                    ...explodeConcreteRows(priceList, q.slab_concrete, 'BMS-SLAB-CON', '12.1.2'),
                    ...explodeConcreteRows(priceList, q.slope_concrete, 'BMS-CON', '12.1.3'),
                    makeRow(priceList, q.waterproof_admix?.sku ?? 'CON-ADMIX-WP',q.waterproof_admix?.qty ?? 0, '12.1.4'),
                    makeRow(priceList, q.pour_labor?.sku ?? 'LAB-POUR-2FL',      q.pour_labor?.qty ?? 0,       '12.1.5'),
                    makeRow(priceList, q.rebar_kg?.sku ?? 'BMS-REBAR',           q.rebar_kg?.qty ?? 0,         '12.2.1'),
                    makeRow(priceList, q.tie_wire?.sku ?? 'RB-WIRE',             q.tie_wire?.qty ?? 0,         '12.2.2'),
                    makeRow(priceList, q.spacer?.sku ?? 'RB-SPACER',             q.spacer?.qty ?? 0,           '12.2.3'),
                    makeRow(priceList, q.formwork_area?.sku ?? 'BMS-FORM',       q.formwork_area?.qty ?? 0,    '12.3'),
                    makeRow(priceList, q.shoring?.sku ?? 'BMS-SHORE',            q.shoring?.qty ?? 0,          '12.4'),
                    makeRow(priceList, q.waterproofing?.sku ?? 'BMS-WP',         q.waterproofing?.qty ?? 0,    '12.5'),
                    makeRow(priceList, q.roof_drain?.sku ?? 'BMS-DRAIN',         q.roof_drain?.qty ?? 0,       '12.6'),
                    makeRow(priceList, q.concrete_pump?.sku ?? 'BMS-PUMP',       q.concrete_pump?.qty ?? 0,    '12.7'),
                    makeRow(priceList, q.vibrator?.sku ?? 'BMS-VIBRATOR',        q.vibrator?.qty ?? 0,         '12.8'),
                    makeRow(priceList, q.curing?.sku ?? 'BMS-CURING',            q.curing?.qty ?? 0,           '12.9'),
                ] : [];
            }),
            build(13, 'งานโครงสร้างบันได', 'Staircase', () => {
                const q = stepSaves[13]?.res.quantities;
                return q ? [
                    ...explodeConcreteRows(priceList, q.concrete_volume, 'STR-CON', '13.1.1'),
                    makeRow(priceList, q.waterproof_admix?.sku ?? 'CON-ADMIX-WP',   q.waterproof_admix?.qty ?? 0, '13.1.2'),
                    makeRow(priceList, q.pour_labor?.sku ?? 'LAB-POUR-1FL',         q.pour_labor?.qty ?? 0,       '13.1.3'),
                    makeRow(priceList, q.rebar_kg?.sku ?? 'STR-REBAR',              q.rebar_kg?.qty ?? 0,         '13.2.1'),
                    makeRow(priceList, q.tie_wire?.sku ?? 'RB-WIRE',                q.tie_wire?.qty ?? 0,         '13.2.2'),
                    makeRow(priceList, q.spacer?.sku ?? 'RB-SPACER',                q.spacer?.qty ?? 0,           '13.2.3'),
                    makeRow(priceList, q.formwork_area?.sku ?? 'STR-FORM',          q.formwork_area?.qty ?? 0,    '13.3'),
                    makeRow(priceList, q.shoring?.sku ?? 'STR-SHORE',               q.shoring?.qty ?? 0,          '13.4'),
                    makeRow(priceList, q.nosing?.sku ?? 'STR-NOSING',               q.nosing?.qty ?? 0,           '13.5'),
                    makeRow(priceList, q.concrete_pump?.sku ?? 'STR-PUMP',          q.concrete_pump?.qty ?? 0,    '13.6'),
                    makeRow(priceList, q.vibrator?.sku ?? 'STR-VIBRATOR',           q.vibrator?.qty ?? 0,         '13.7'),
                    makeRow(priceList, q.curing?.sku ?? 'STR-CURING',               q.curing?.qty ?? 0,           '13.8'),
                ] : [];
            }),
            build(14, 'งานเพลทหัวเสา', 'Column Cap Plate', () => {
                const q = stepSaves[14]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'CCP-STEEL',    q.plate_steel?.qty ?? 0,      '14.1'),
                    makeRow(priceList, 'CCP-BOLT',     q.anchor_bolts?.qty ?? 0,     '14.2'),
                    makeRow(priceList, 'CCP-TEMPLATE', q.bolt_template?.qty ?? 0,    '14.3'),
                    makeRow(priceList, 'CCP-GROUT',    q.grout_bags?.qty ?? 0,       '14.4'),
                    makeRow(priceList, 'CCP-WELD',     q.welding?.qty ?? 0,          '14.5'),
                    makeRow(priceList, 'CCP-PAINT',    q.anti_rust_paint?.qty ?? 0,  '14.6'),
                ] : [];
            }),
            build(15, 'งานโครงหลังคา', 'Roof Structure', () => {
                const q = stepSaves[15]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'RST-STEEL',  q.steel_weight?.qty ?? 0,     '15.1'),
                    makeRow(priceList, 'RST-WELD',   q.welding_rods?.qty ?? 0,     '15.2'),
                    makeRow(priceList, 'RST-PAINT',  q.anti_rust_paint?.qty ?? 0,  '15.3'),
                    makeRow(priceList, 'RST-PURLIN', q.purlin_length?.qty ?? 0,    '15.4'),
                    makeRow(priceList, 'RST-SCREW',  q.purlin_screws?.qty ?? 0,    '15.5'),
                ] : [];
            }),
            build(16, 'งานมุงหลังคา', 'Roofing', () => {
                const q = stepSaves[16]?.res.quantities;
                const inp = stepSaves[16]?.inp as { roofing_type?: string } | undefined;
                if (!q || !inp) return [];
                
                let roofCode = 'ROF-CPAC';
                if (inp.roofing_type === 'excella') roofCode = 'ROF-EXCELLA';
                else if (inp.roofing_type === 'metal_sheet') roofCode = 'ROF-METAL';
                else if (inp.roofing_type === 'corrugated') roofCode = 'ROF-CORR';
                else if (inp.roofing_type === 'shingle') roofCode = 'ROF-SHINGLE';

                const capCode = inp.roofing_type === 'metal_sheet' ? 'ROF-CAP-MET' : 'ROF-CAP-TILE';

                return [
                    makeRow(priceList, roofCode,      q.roofing_main?.qty ?? 0,    '16.1'),
                    makeRow(priceList, capCode,       q.ridge_cap?.qty ?? 0,       '16.2'),
                    makeRow(priceList, 'ROF-DRYTECH', q.dry_tech?.qty ?? 0,        '16.3'),
                    makeRow(priceList, 'ROF-VALLEY',  q.valley_gutter?.qty ?? 0,   '16.4'),
                    makeRow(priceList, 'ROF-EAVE',    q.eave_board?.qty ?? 0,      '16.5'),
                    makeRow(priceList, 'ROF-INSUL',   q.insulation?.qty ?? 0,      '16.6'),
                    makeRow(priceList, 'ROF-BIRD',    q.bird_block?.qty ?? 0,      '16.7'),
                ];
            }),
            build(17, 'งานก่ออิฐ', 'Brickwork', () => {
                const q = stepSaves[17]?.res.quantities;
                if (!q) return [];
                const inp = stepSaves[17]?.inp as { brick_type?: string } | undefined;
                const brickCode = inp?.brick_type === 'aac' ? 'BRK-AAC' : 'BRK-CLAY';
                return [
                    makeRow(priceList, brickCode, q.bricks_required?.qty ?? 0, '17.1'),
                    makeRow(priceList, 'BRK-MORTAR', q.net_wall_area?.qty ?? 0, '17.2'),
                    makeRow(priceList, 'BRK-LINTEL', q.lintel_length?.qty ?? 0, '17.3'),
                ];
            }),
            build(18, 'งานฉาบปูน', 'Plastering', () => {
                const q = stepSaves[18]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'PLS-EXT', q.plaster_exterior?.qty ?? 0, '18.1'),
                    makeRow(priceList, 'PLS-INT', q.plaster_interior?.qty ?? 0, '18.2'),
                    makeRow(priceList, 'PLS-SKIM', q.skim_coat?.qty ?? 0, '18.3'),
                ] : [];
            }),
            build(19, 'งานฝ้าเพดาน', 'Ceiling', () => {
                const q = stepSaves[19]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'CLG-PANEL', q.ceiling_area?.qty ?? 0, '19.1'),
                    makeRow(priceList, 'CLG-FRAME', q.c_line_frame?.qty ?? 0, '19.2'),
                    makeRow(priceList, 'CLG-CORNICE', q.cornice?.qty ?? 0, '19.3'),
                ] : [];
            }),
            build(20, 'งานปูกระเบื้องพื้น', 'Floor Tiling', () => {
                const q = stepSaves[20]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'FLT-TILE', q.tile_area?.qty ?? 0, '20.1'),
                    makeRow(priceList, 'FLT-ADHESIVE', q.adhesive_cement?.qty ?? 0, '20.2'),
                    makeRow(priceList, 'FLT-SKIRTING', q.skirting?.qty ?? 0, '20.3'),
                ] : [];
            }),
            build(21, 'งานปูกระเบื้องห้องน้ำ', 'Bathroom Tiling', () => {
                const q = stepSaves[21]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'BTL-FLOOR', q.floor_tiles?.qty ?? 0, '21.1'),
                    makeRow(priceList, 'BTL-WALL', q.wall_tiles?.qty ?? 0, '21.2'),
                    makeRow(priceList, 'BTL-WP', q.waterproof?.qty ?? 0, '21.3'),
                ] : [];
            }),
            build(22, 'งานตกแต่งผนังภายนอก', 'Exterior Finish', () => {
                const q = stepSaves[22]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'EXF-MAT', q.facade_material?.qty ?? 0, '22.1'),
                ] : [];
            }),
            build(23, 'งานสีรองพื้น', 'Primer', () => {
                const q = stepSaves[23]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'PRM-INT',     q.primer_interior?.qty ?? 0,  '23.1'),
                    makeRow(priceList, 'PRM-EXT',     q.primer_exterior?.qty ?? 0,  '23.2'),
                    makeRow(priceList, 'PRM-SAND',    q.sandpaper?.qty ?? 0,        '23.3'),
                    makeRow(priceList, 'PRM-CRACK',   q.crack_sealer?.qty ?? 0,     '23.4'),
                    makeRow(priceList, 'PRM-ROLLER',  q.roller_set?.qty ?? 0,       '23.5'),
                    makeRow(priceList, 'PRM-BRUSH',   q.brush?.qty ?? 0,            '23.6'),
                ] : [];
            }),
            build(24, 'งานประตู-หน้าต่างอลู', 'Aluminium D&W', () => {
                const q = stepSaves[24]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'ALU-DOOR',    q.door_set?.qty ?? 0,    '24.1'),
                    makeRow(priceList, 'ALU-DOOR-A',  q.door_area?.qty ?? 0,   '24.2'),
                    makeRow(priceList, 'ALU-SLIDE',   q.sliding?.qty ?? 0,     '24.3'),
                    makeRow(priceList, 'ALU-WINDOW',  q.window_set?.qty ?? 0,  '24.4'),
                    makeRow(priceList, 'ALU-WIN-A',   q.window_area?.qty ?? 0, '24.5'),
                    makeRow(priceList, 'ALU-SEAL',    q.sealant?.qty ?? 0,     '24.6'),
                ] : [];
            }),
            build(25, 'งานทาสี รอบ 1', 'Paint Coat 1', () => {
                const q = stepSaves[25]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'PNT-INT',      q.interior_paint?.qty ?? 0,  '25.1'),
                    makeRow(priceList, 'PNT-ACCENT',   q.accent_paint?.qty ?? 0,    '25.2'),
                    makeRow(priceList, 'PNT-EXT',      q.exterior_paint?.qty ?? 0,  '25.3'),
                    makeRow(priceList, 'PNT-WOOD',     q.wood_stain?.qty ?? 0,      '25.4'),
                    makeRow(priceList, 'PNT-ROLLER',   q.roller_set?.qty ?? 0,      '25.5'),
                    makeRow(priceList, 'PNT-MASK',     q.masking_tape?.qty ?? 0,    '25.6'),
                    makeRow(priceList, 'PNT-DROP',     q.drop_cloth?.qty ?? 0,      '25.7'),
                ] : [];
            }),
            build(26, 'งานไฟฟ้า', 'Electrical', () => {
                const q = stepSaves[26]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'ELC-CONDUIT',  q.conduit?.qty ?? 0,           '26.1'),
                    makeRow(priceList, 'ELC-MAIN',     q.main_cable?.qty ?? 0,        '26.2'),
                    makeRow(priceList, 'ELC-BRANCH',   q.branch_cable?.qty ?? 0,      '26.3'),
                    makeRow(priceList, 'ELC-AC',       q.ac_cable?.qty ?? 0,          '26.4'),
                    makeRow(priceList, 'ELC-SOCKET',   q.switches_sockets?.qty ?? 0,  '26.5'),
                    makeRow(priceList, 'ELC-LIGHT',    q.lighting_fixtures?.qty ?? 0, '26.6'),
                    makeRow(priceList, 'ELC-CU',       q.consumer_unit?.qty ?? 0,     '26.7'),
                    makeRow(priceList, 'ELC-GROUND',   q.ground_rod?.qty ?? 0,        '26.8'),
                    makeRow(priceList, 'ELC-OUT',      q.outdoor_socket?.qty ?? 0,    '26.9'),
                    makeRow(priceList, 'ELC-EV',       q.ev_charger?.qty ?? 0,        '26.10'),
                    makeRow(priceList, 'ELC-AC-INSTALL', q.hvac_install?.qty ?? 0,    '26.11'),
                    makeRow(priceList, 'ELC-AC-COPPER', q.hvac_copper?.qty ?? 0,      '26.12'),
                ] : [];
            }),
            build(27, 'งานสุขาภิบาลภายใน', 'Sanitary Int', () => {
                const q = stepSaves[27]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'SIP-SUPPLY',  q.supply_pipe?.qty ?? 0,     '27.1'),
                    makeRow(priceList, 'SIP-DRAIN',   q.drain_pipe?.qty ?? 0,      '27.2'),
                    makeRow(priceList, 'SIP-HOT',     q.hot_pipe?.qty ?? 0,        '27.3'),
                    makeRow(priceList, 'SIP-VALVE',   q.valve_fitting?.qty ?? 0,   '27.4'),
                    makeRow(priceList, 'SIP-FD',      q.fd?.qty ?? 0,              '27.5'),
                    makeRow(priceList, 'SIP-PTRAP',   q.ptrap?.qty ?? 0,           '27.6'),
                    makeRow(priceList, 'SIP-CO',      q.cleanout?.qty ?? 0,        '27.7'),
                ] : [];
            }),
            build(28, 'งานสุขาภิบาลภายนอก', 'Sanitary Ext', () => {
                const q = stepSaves[28]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'SEP-SUPPLY',  q.ext_supply?.qty ?? 0,      '28.1'),
                    makeRow(priceList, 'SEP-DRAIN',   q.ext_drain?.qty ?? 0,       '28.2'),
                    makeRow(priceList, 'SEP-CHAMBER', q.chamber?.qty ?? 0,         '28.3'),
                    makeRow(priceList, 'SEP-SEPTIC',  q.septic?.qty ?? 0,          '28.4'),
                    makeRow(priceList, 'SEP-GREASE',  q.grease?.qty ?? 0,          '28.5'),
                    makeRow(priceList, 'SEP-METER',   q.meter?.qty ?? 0,           '28.6'),
                    makeRow(priceList, 'SEP-RAIN',    q.rainwater?.qty ?? 0,       '28.7'),
                    makeRow(priceList, 'SEP-PUMP',    q.pump_tank?.qty ?? 0,       '28.8'),
                ] : [];
            }),
            build(29, 'งานเบ็ดเตล็ด', 'Misc', () => {
                const q = stepSaves[29]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'MSC-CURTAIN',  q.curtains?.qty ?? 0,      '29.1'),
                    makeRow(priceList, 'MSC-BLIND',    q.blinds?.qty ?? 0,         '29.2'),
                    makeRow(priceList, 'MSC-TOWEL',    q.towel_bar?.qty ?? 0,      '29.3'),
                    makeRow(priceList, 'MSC-SOAP',     q.soap_dish?.qty ?? 0,      '29.4'),
                    makeRow(priceList, 'MSC-PAPER',    q.paper_holder?.qty ?? 0,   '29.5'),
                    makeRow(priceList, 'MSC-MIRROR',   q.mirror?.qty ?? 0,         '29.6'),
                    makeRow(priceList, 'MSC-STOPPER',  q.stopper?.qty ?? 0,        '29.7'),
                    makeRow(priceList, 'MSC-CLOSER',   q.closer?.qty ?? 0,         '29.8'),
                    makeRow(priceList, 'MSC-PEEP',     q.peephole?.qty ?? 0,       '29.9'),
                    makeRow(priceList, 'MSC-HNUM',     q.house_number?.qty ?? 0,   '29.10'),
                    makeRow(priceList, 'MSC-SHELF',    q.shelves?.qty ?? 0,        '29.11'),
                    makeRow(priceList, 'MSC-CABINET',  q.cabinet?.qty ?? 0,        '29.12'),
                    makeRow(priceList, 'MSC-MAIL',     q.mailbox?.qty ?? 0,        '29.13'),
                    makeRow(priceList, 'MSC-CLOTH',    q.clothesline?.qty ?? 0,    '29.14'),
                ] : [];
            }),
            build(30, 'งานสุขภัณฑ์', 'Sanitary Fix', () => {
                const q = stepSaves[30]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'SFX-TOILET',   q.toilets?.qty ?? 0,        '30.1'),
                    makeRow(priceList, 'SFX-BASIN',    q.basins?.qty ?? 0,         '30.2'),
                    makeRow(priceList, 'SFX-SHOWER',   q.showers?.qty ?? 0,        '30.3'),
                    makeRow(priceList, 'SFX-BIDET',    q.bidet?.qty ?? 0,          '30.4'),
                    makeRow(priceList, 'SFX-FAUCET',   q.faucet?.qty ?? 0,         '30.5'),
                    makeRow(priceList, 'SFX-KSINK',    q.kitchen_sink?.qty ?? 0,   '30.6'),
                    makeRow(priceList, 'SFX-KFAUCET',  q.kitchen_faucet?.qty ?? 0, '30.7'),
                    makeRow(priceList, 'SFX-HEATER',   q.heater?.qty ?? 0,         '30.8'),
                    makeRow(priceList, 'SFX-TUB',      q.bathtub?.qty ?? 0,        '30.9'),
                    makeRow(priceList, 'SFX-URINAL',   q.urinal?.qty ?? 0,         '30.10'),
                    makeRow(priceList, 'SFX-LSINK',    q.laundry_sink?.qty ?? 0,   '30.11'),
                    makeRow(priceList, 'SFX-SILI',     q.silicone?.qty ?? 0,       '30.12'),
                    makeRow(priceList, 'SFX-PTFE',     q.ptfe_tape?.qty ?? 0,      '30.13'),
                ] : [];
            }),
            build(31, 'งานประตู-หน้าต่างไม้', 'Wood D&W', () => {
                const q = stepSaves[31]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'WDR-DOOR',     q.doors?.qty ?? 0,       '31.1'),
                    makeRow(priceList, 'WDR-WINDOW',   q.windows?.qty ?? 0,     '31.2'),
                    makeRow(priceList, 'WDR-HARDWARE', q.hardware?.qty ?? 0,    '31.3'),
                    makeRow(priceList, 'WDR-SEAL',     q.sealant?.qty ?? 0,     '31.4'),
                    makeRow(priceList, 'WDR-FINISH',   q.wood_finish?.qty ?? 0, '31.5'),
                ] : [];
            }),
            build(32, 'งานทาสี รอบ 2', 'Final Paint', () => {
                const q = stepSaves[32]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'FPT-INT',      q.interior_paint?.qty ?? 0, '32.1'),
                    makeRow(priceList, 'FPT-EXT',      q.exterior_paint?.qty ?? 0, '32.2'),
                    makeRow(priceList, 'FPT-WOOD',     q.wood_stain?.qty ?? 0,     '32.3'),
                    makeRow(priceList, 'FPT-TOUCH',    q.touch_up?.qty ?? 0,       '32.4'),
                    makeRow(priceList, 'FPT-ROLLER',   q.roller_set?.qty ?? 0,     '32.5'),
                    makeRow(priceList, 'FPT-BRUSH',    q.brush?.qty ?? 0,          '32.6'),
                ] : [];
            }),
            build(33, 'งานตรวจ Defect', 'Defect', () => {
                const q = stepSaves[33]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'DEF-ITEM', q.defect_items?.qty ?? 0, '33.1'),
                    makeRow(priceList, 'DEF-CLEAN',   q.cleaning?.qty ?? 0,        '33.2'),
                    makeRow(priceList, 'DEF-TOUCH',   q.touch_up?.qty ?? 0,        '33.3'),
                    makeRow(priceList, 'DEF-CAULK',   q.caulking?.qty ?? 0,        '33.4'),
                    makeRow(priceList, 'DEF-SUPPLY',  q.cleaning_supply?.qty ?? 0, '33.5'),
                    makeRow(priceList, 'DEF-STICKER', q.sticker_set?.qty ?? 0,     '33.6'),
                ] : [];
            }),
            build(34, 'งานส่งมอบ', 'Handover', () => {
                const q = stepSaves[34]?.res.quantities;
                return q ? [
                    makeRow(priceList, 'HDV-DOC',     q.as_built_docs?.qty ?? 0,  '34.1'),
                    makeRow(priceList, 'HDV-KEY',     q.key_sets?.qty ?? 0,       '34.2'),
                    makeRow(priceList, 'HDV-WARR',    q.warranty?.qty ?? 0,       '34.3'),
                    makeRow(priceList, 'HDV-DWG',     q.drawing?.qty ?? 0,        '34.4'),
                    makeRow(priceList, 'HDV-MANUAL',  q.manual?.qty ?? 0,         '34.5'),
                    makeRow(priceList, 'HDV-PHOTO',   q.photos?.qty ?? 0,         '34.6'),
                    makeRow(priceList, 'HDV-TRAIN',   q.training?.qty ?? 0,       '34.7'),
                    makeRow(priceList, 'DEF-CLEAN',   q.big_cleaning?.qty ?? 0,   '34.8'),
                ] : [];
            }),
        ];
    
}
