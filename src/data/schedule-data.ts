// ── Schedule Data from คู่มือ 4 ──────────────────────────────────────────────
// "แผนระยะเวลา ที่ใช้แต่ละขั้นตอน" — บ้านพักอาศัย คสล. 1 ชั้น 128 ตร.ม.
// Source: Site Operating System™ © 2025 Contrepreneur.com

export interface StepSchedule {
    stepId: number;
    title: string;
    titleEn: string;
    /** Default duration in days (for 128 sqm reference house) */
    defaultDays: number;
    /** Number of crews */
    crews: number;
    /** Breakdown of 1 crew: skilled + laborers */
    crewSetup: string;
    /** Team type */
    team: string;
    /** Productivity rate description */
    productivity: string;
    /** Productivity numeric value (unit/day/crew) for auto-calc, null = use default days */
    productivityRate: number | null;
    /** Unit for productivity */
    productivityUnit: string;
    /** Steps that can run in parallel with this step (step IDs) */
    parallelWith: number[];
    /** Step IDs that must complete before this step can start */
    dependsOn: number[];
    /** Delay in days before dependent steps can start (e.g. for concrete curing) */
    curingDays?: number;
}

export const SCHEDULE_DATA: StepSchedule[] = [
    {
        stepId: 0, title: 'สำรวจที่ดิน / หมุดหลัก', titleEn: 'Land Survey & Benchmark',
        defaultDays: 1, crews: 1, crewSetup: 'ช่างสำรวจ 1 คนงาน 1',
        team: 'ทีมสำรวจ',
        productivity: '~1 งาน/ทีม/วัน',
        productivityRate: null, productivityUnit: '',
        parallelWith: [], dependsOn: [],
    },
    {
        stepId: 1, title: 'ถมดิน', titleEn: 'Earthwork',
        defaultDays: 2, crews: 1, crewSetup: 'คนขับ 1',
        team: 'ทีมถมดิน',
        productivity: '100–150 ลบ.ม./วัน/รถสิบล้อ',
        productivityRate: 125, productivityUnit: 'ลบ.ม./วัน',
        parallelWith: [], dependsOn: [0],
    },
    {
        stepId: 2, title: 'เดินน้ำ–ไฟชั่วคราว', titleEn: 'Temp Utilities',
        defaultDays: 0.5, crews: 1, crewSetup: 'ช่าง 1 คนงาน 1',
        team: 'ทีมช่างโครงสร้าง',
        productivity: '~2 งาน/ทีม/วัน',
        productivityRate: null, productivityUnit: '',
        parallelWith: [], dependsOn: [1],
    },
    {
        stepId: 3, title: 'ปลูกที่พักคนงาน', titleEn: 'Site Camp',
        defaultDays: 1, crews: 1, crewSetup: 'ช่าง 1 คนงาน 5',
        team: 'ทีมช่างโครงสร้าง',
        productivity: '~1 งาน/ทีม/วัน',
        productivityRate: null, productivityUnit: '',
        parallelWith: [2], dependsOn: [1],
    },
    {
        stepId: 4, title: 'วางผัง/ปักหมุด', titleEn: 'Site Layout',
        defaultDays: 1, crews: 1, crewSetup: 'ช่าง 1 คนงาน 2',
        team: 'ทีมช่างโครงสร้าง',
        productivity: '~1 งาน/ทีม/วัน',
        productivityRate: null, productivityUnit: '',
        parallelWith: [], dependsOn: [1, 2, 3],
    },
    {
        stepId: 5, title: 'งานเสาเข็ม', titleEn: 'Piling',
        defaultDays: 1, crews: 1, crewSetup: 'ช่าง 1 คนงาน 2',
        team: 'ทีมเสาเข็ม',
        productivity: '6–8 ต้น/วัน',
        productivityRate: 7, productivityUnit: 'ต้น/วัน',
        parallelWith: [], dependsOn: [4],
    },
    {
        stepId: 6, title: 'ทำฐานราก', titleEn: 'Footing',
        defaultDays: 3, crews: 1, crewSetup: 'ช่าง 2 คนงาน 4',
        team: 'ทีมช่างโครงสร้าง',
        productivity: '~2 ฟุตติ้ง/วัน/ทีม',
        productivityRate: 2, productivityUnit: 'ฟุตติ้ง/วัน',
        parallelWith: [], dependsOn: [5],
        curingDays: 7,
    },
    {
        stepId: 7, title: 'ทำเสาตอม่อ', titleEn: 'Column Neck',
        defaultDays: 2, crews: 1, crewSetup: 'ช่าง 2 คนงาน 4',
        team: 'ทีมช่างโครงสร้าง',
        productivity: '~4 ต้น/วัน/ทีม',
        productivityRate: 4, productivityUnit: 'ต้น/วัน',
        parallelWith: [], dependsOn: [6],
        curingDays: 7,
    },
    {
        stepId: 8, title: 'คานคอดิน', titleEn: 'Ground Beam',
        defaultDays: 3, crews: 1, crewSetup: 'ช่าง 2 คนงาน 4',
        team: 'ทีมช่างโครงสร้าง',
        productivity: '~10 ม./วัน/ทีม',
        productivityRate: 10, productivityUnit: 'ม./วัน',
        parallelWith: [], dependsOn: [7],
        curingDays: 7,
    },
    {
        stepId: 9, title: 'เทพื้นหล่อในที่', titleEn: 'Slab on Grade',
        defaultDays: 2, crews: 1, crewSetup: 'ช่าง 2 คนงาน 4',
        team: 'ทีมช่างโครงสร้าง',
        productivity: '~40 ตร.ม./วัน/ทีม',
        productivityRate: 40, productivityUnit: 'ตร.ม./วัน/ทีม',
        parallelWith: [], dependsOn: [8],
        curingDays: 7,
    },
    {
        stepId: 10, title: 'วางแผ่นพื้นสำเร็จ', titleEn: 'Precast Slab',
        defaultDays: 2, crews: 1, crewSetup: 'ช่าง 2 คนงาน 4',
        team: 'ทีมช่างโครงสร้าง',
        productivity: '~50 ตร.ม./วัน/ทีม',
        productivityRate: 50, productivityUnit: 'ตร.ม./วัน/ทีม',
        parallelWith: [9], dependsOn: [8],
    },
    {
        stepId: 11, title: 'เสาชั้น 1', titleEn: 'Column Floor 1',
        defaultDays: 3, crews: 1, crewSetup: 'ช่าง 2 คนงาน 4',
        team: 'ทีมช่างโครงสร้าง',
        productivity: '~4 ต้น/วัน/ทีม',
        productivityRate: 4, productivityUnit: 'ต้น/วัน',
        parallelWith: [], dependsOn: [9, 10],
        curingDays: 7,
    },
    {
        stepId: 12, title: 'คาน+พื้นดาดฟ้า', titleEn: 'Beam + Roof Deck',
        defaultDays: 7, crews: 1, crewSetup: 'ช่าง 3 คนงาน 5',
        team: 'ทีมช่างโครงสร้าง',
        productivity: 'ตามปริมาณงาน',
        productivityRate: null, productivityUnit: '',
        parallelWith: [13], dependsOn: [11],
        curingDays: 7,
    },
    {
        stepId: 13, title: 'โครงสร้างบันได', titleEn: 'Staircase',
        defaultDays: 5, crews: 1, crewSetup: 'ช่าง 2 คนงาน 4',
        team: 'ทีมช่างโครงสร้าง',
        productivity: 'ตามปริมาณงาน',
        productivityRate: null, productivityUnit: '',
        parallelWith: [12], dependsOn: [11],
        curingDays: 7,
    },
    {
        stepId: 14, title: 'เพลทหัวเสา', titleEn: 'Column Cap Plate',
        defaultDays: 1, crews: 1, crewSetup: 'ช่าง 2 คนงาน 4',
        team: 'ทีมช่างโครงสร้าง',
        productivity: '~4 จุด/วัน/ทีม',
        productivityRate: 4, productivityUnit: 'จุด/วัน',
        parallelWith: [], dependsOn: [12],
    },
    {
        stepId: 15, title: 'โครงหลังคา', titleEn: 'Roof Structure',
        defaultDays: 7, crews: 1, crewSetup: 'ช่าง 3 คนงาน 3',
        team: 'ทีมช่างเหล็ก',
        productivity: 'ตามปริมาณงาน',
        productivityRate: null, productivityUnit: '',
        parallelWith: [], dependsOn: [14],
    },
    {
        stepId: 16, title: 'มุงหลังคา', titleEn: 'Roofing',
        defaultDays: 2, crews: 1, crewSetup: 'ช่าง 2 คนงาน 2',
        team: 'ทีมช่างเหล็ก',
        productivity: '~30 ตร.ม./วัน/ทีม',
        productivityRate: 30, productivityUnit: 'ตร.ม./วัน/ทีม',
        parallelWith: [17], dependsOn: [15],
    },
    {
        stepId: 17, title: 'ก่ออิฐ', titleEn: 'Brickwork',
        defaultDays: 14, crews: 1, crewSetup: 'ช่าง 3 คนงาน 3',
        team: 'ทีมช่างปูน',
        productivity: '~21 ตร.ม./วัน/ทีม',
        productivityRate: 21, productivityUnit: 'ตร.ม./วัน/ทีม',
        parallelWith: [16], dependsOn: [15],
    },
    // ─── M&E Rough-in (วางท่อฝังผนังก่อนฉาบ) ────────────
    {
        stepId: 26.1, title: 'เดินท่อร้อยสายไฟฝังผนัง (Rough-in)', titleEn: 'Electrical Rough-in',
        defaultDays: 4, crews: 1, crewSetup: 'ช่าง 2 คนงาน 1',
        team: 'ทีมช่างไฟ',
        productivity: 'ตามปริมาณงาน',
        productivityRate: null, productivityUnit: '',
        parallelWith: [27.1, 28.1], dependsOn: [17],
    },
    {
        stepId: 27.1, title: 'เดินท่อประปาฝังผนัง (Rough-in)', titleEn: 'Sanitary Rough-in',
        defaultDays: 3, crews: 1, crewSetup: 'ช่าง 1 คนงาน 1',
        team: 'ทีมช่างประปา',
        productivity: 'ตามปริมาณงาน',
        productivityRate: null, productivityUnit: '',
        parallelWith: [26.1, 28.1], dependsOn: [17],
    },
    {
        stepId: 28.1, title: 'วางท่อสุขาภิบาล (Rough-in)', titleEn: 'Ext Sanitary Rough-in',
        defaultDays: 3, crews: 1, crewSetup: 'ช่าง 1 คนงาน 1',
        team: 'ทีมช่างประปา',
        productivity: 'ตามปริมาณงาน',
        productivityRate: null, productivityUnit: '',
        parallelWith: [26.1, 27.1], dependsOn: [17],
    },
    // ───────────────────────────────────────────────
    {
        stepId: 18, title: 'ฉาบปูน', titleEn: 'Plastering',
        defaultDays: 14, crews: 1, crewSetup: 'ช่าง 3 คนงาน 3',
        team: 'ทีมช่างปูน',
        productivity: '~36 ตร.ม./วัน/ทีม',
        productivityRate: 36, productivityUnit: 'ตร.ม./วัน/ทีม',
        parallelWith: [], dependsOn: [26.1, 27.1, 28.1], // ฉาบปูนต้องทำหลังเดินท่อเสร็จ
    },
    {
        stepId: 19, title: 'ปิดฝ้าเพดาน', titleEn: 'Ceiling',
        defaultDays: 7, crews: 1, crewSetup: 'ช่าง 2 คนงาน 2',
        team: 'ทีมช่างปูน',
        productivity: '~30 ตร.ม./วัน/ทีม',
        productivityRate: 30, productivityUnit: 'ตร.ม./วัน/ทีม',
        parallelWith: [20, 21, 22], dependsOn: [18],
    },
    {
        stepId: 20, title: 'ปูกระเบื้องพื้น', titleEn: 'Floor Tiling',
        defaultDays: 14, crews: 1, crewSetup: 'ช่าง 2 คนงาน 2',
        team: 'ทีมปูกระเบื้อง',
        productivity: '~12 ตร.ม./วัน/ทีม',
        productivityRate: 12, productivityUnit: 'ตร.ม./วัน/ทีม',
        parallelWith: [19, 21, 22], dependsOn: [18],
    },
    {
        stepId: 21, title: 'ปูกระเบื้องห้องน้ำ', titleEn: 'Bathroom Tiling',
        defaultDays: 14, crews: 1, crewSetup: 'ช่าง 2 คนงาน 2',
        team: 'ทีมปูกระเบื้อง',
        productivity: '~10 ตร.ม./วัน/ทีม',
        productivityRate: 10, productivityUnit: 'ตร.ม./วัน/ทีม',
        parallelWith: [19, 20, 22], dependsOn: [18],
    },
    {
        stepId: 22, title: 'ตกแต่งผนังภายนอก', titleEn: 'Exterior Finish',
        defaultDays: 4, crews: 1, crewSetup: 'ช่าง 1 คนงาน 1',
        team: 'ทีมช่างปูน',
        productivity: 'ตามปริมาณงาน',
        productivityRate: null, productivityUnit: '',
        parallelWith: [19, 20, 21], dependsOn: [18],
    },
    {
        stepId: 23, title: 'ทาสีรองพื้น', titleEn: 'Primer',
        defaultDays: 4, crews: 1, crewSetup: 'ช่าง 4 คนงาน 2',
        team: 'ทีมช่างสี',
        productivity: '~240 ตร.ม./วัน/ทีม',
        productivityRate: 240, productivityUnit: 'ตร.ม./วัน/ทีม',
        parallelWith: [], dependsOn: [19, 20, 21, 22],
    },
    {
        stepId: 24, title: 'ประตู-หน้าต่างอลูมิเนียม', titleEn: 'Aluminium',
        defaultDays: 5, crews: 1, crewSetup: 'ช่าง 3 คนงาน 1',
        team: 'ทีมช่างอลูมิเนียม',
        productivity: 'ตามปริมาณงาน',
        productivityRate: null, productivityUnit: '',
        parallelWith: [], dependsOn: [23],
    },
    {
        stepId: 25, title: 'ทาสีจริง รอบ 1', titleEn: 'Paint Coat 1',
        defaultDays: 5, crews: 1, crewSetup: 'ช่าง 4 คนงาน 2',
        team: 'ทีมช่างสี',
        productivity: '~160 ตร.ม./วัน/ทีม',
        productivityRate: 160, productivityUnit: 'ตร.ม./วัน/ทีม',
        parallelWith: [], dependsOn: [24],
    },
    {
        stepId: 26, title: 'ติดตั้งอุปกรณ์ไฟฟ้า', titleEn: 'Electrical',
        defaultDays: 4, crews: 1, crewSetup: 'ช่าง 3 คนงาน 1',
        team: 'ทีมช่างไฟ',
        productivity: 'ตามปริมาณงาน',
        productivityRate: null, productivityUnit: '',
        parallelWith: [27, 28, 29], dependsOn: [25],
    },
    {
        stepId: 27, title: 'สุขาภิบาลภายใน', titleEn: 'Sanitary Int',
        defaultDays: 1, crews: 1, crewSetup: 'ช่าง 1 คนงาน 2',
        team: 'ทีมช่างประปา',
        productivity: 'ตามปริมาณงาน',
        productivityRate: null, productivityUnit: '',
        parallelWith: [26, 28, 29], dependsOn: [25],
    },
    {
        stepId: 28, title: 'สุขาภิบาลภายนอก', titleEn: 'Sanitary Ext',
        defaultDays: 2, crews: 1, crewSetup: 'ช่าง 1 คนงาน 2',
        team: 'ทีมช่างประปา',
        productivity: 'ตามปริมาณงาน',
        productivityRate: null, productivityUnit: '',
        parallelWith: [26, 27, 29], dependsOn: [25],
    },
    {
        stepId: 29, title: 'อุปกรณ์เบ็ดเตล็ด', titleEn: 'Misc Fixtures',
        defaultDays: 1, crews: 1, crewSetup: 'ช่าง 2 คนงาน 1',
        team: 'ทีมช่างอลูมิเนียม',
        productivity: 'ตามปริมาณงาน',
        productivityRate: null, productivityUnit: '',
        parallelWith: [26, 27, 28], dependsOn: [25],
    },
    {
        stepId: 30, title: 'ติดตั้งสุขภัณฑ์', titleEn: 'Sanitary Fix',
        defaultDays: 3, crews: 1, crewSetup: 'ช่าง 1 คนงาน 1',
        team: 'ทีมช่างประปา',
        productivity: '~1 ห้อง/วัน/ทีม',
        productivityRate: 1, productivityUnit: 'ห้อง/วัน',
        parallelWith: [], dependsOn: [26, 27, 28, 29],
    },
    {
        stepId: 31, title: 'ประตู–หน้าต่างไม้', titleEn: 'Wood Door',
        defaultDays: 5, crews: 1, crewSetup: 'ช่าง 1 คนงาน 1',
        team: 'ทีมช่างไม้',
        productivity: '1~2 บาน/วัน/ทีม',
        productivityRate: 1.5, productivityUnit: 'บาน/วัน',
        parallelWith: [30], dependsOn: [26, 27, 28, 29],
    },
    {
        stepId: 32, title: 'ทาสีรอบสุดท้าย', titleEn: 'Final Paint',
        defaultDays: 3, crews: 1, crewSetup: 'ช่าง 4 คนงาน 2',
        team: 'ทีมช่างสี',
        productivity: '~160 ตร.ม./วัน/ทีม',
        productivityRate: 160, productivityUnit: 'ตร.ม./วัน/ทีม',
        parallelWith: [], dependsOn: [30, 31],
    },
    {
        stepId: 33, title: 'ตรวจ Defect', titleEn: 'Defect Inspection',
        defaultDays: 2, crews: 1, crewSetup: 'ช่าง 2 คนงาน 1',
        team: 'ทีมตรวจงาน',
        productivity: 'ตามปริมาณงาน',
        productivityRate: null, productivityUnit: '',
        parallelWith: [], dependsOn: [32],
    },
    {
        stepId: 34, title: 'ส่งมอบ', titleEn: 'Handover',
        defaultDays: 1, crews: 1, crewSetup: 'ช่าง 1 คนงาน 1',
        team: 'ทีมตรวจงาน',
        productivity: 'ตามปริมาณงาน',
        productivityRate: null, productivityUnit: '',
        parallelWith: [], dependsOn: [33],
    },
];

// Team colors for Gantt chart
export const TEAM_COLORS: Record<string, string> = {
    'ทีมสำรวจ': '#5c6bc0',
    'ทีมถมดิน': '#8B4513',
    'ทีมช่างโครงสร้าง': '#1a73e8',
    'ทีมเสาเข็ม': '#6d4c41',
    'ทีมช่างเหล็ก': '#546e7a',
    'ทีมช่างปูน': '#ef6c00',
    'ทีมปูกระเบื้อง': '#00897b',
    'ทีมช่างสี': '#7b1fa2',
    'ทีมช่างอลูมิเนียม': '#0277bd',
    'ทีมช่างไฟ': '#c62828',
    'ทีมช่างประปา': '#2e7d32',
    'ทีมช่างไม้': '#4e342e',
    'ทีมตรวจงาน': '#37474f',
};
