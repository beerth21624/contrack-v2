// ─── Trades (ประเภทงานช่าง) for subcontracting, grouped from the BOQ sections ───
// A trade is a set of planned tasks (S-Curve / Man-Day blocks), so the split of a BOQ section between two trades
// (ก่ออิฐ items vs ท่อร้อยสายไฟ in section 17, ฉาบปูน vs สายไฟ in section 18) follows exactly the Man-Day split.
// Section 1 (รื้อถอน / ถมดิน) has no planned task and belongs to site preparation; section 0 (land inspection) is the
// contractor's own survey and is never subcontracted.
// Plan: docs/marketplace/01-module1-subcontracting-plan.md §3.2.
import type { TradeId } from '../../shared/contract/subcontracting/common';
import { PLAN_TASKS } from '../planning/tasks';

export interface TradeDef {
    id: TradeId;
    /** Short Thai name. */
    label: string;
    /** Planned task ids ("1.5" …) whose Man-Day blocks make up the trade. */
    taskIds: readonly string[];
    /** Whole BOQ sections with no planned task that also belong to the trade. */
    extraSections: readonly number[];
    /** Suggested inspection checklist when a payment stage is claimed. */
    checklist: readonly string[];
    /** Suggested questions asked to bidders (the buyer edits them per package). */
    questions: readonly string[];
}

export const TRADES: readonly TradeDef[] = [
    {
        id: 'site-prep', label: 'เตรียมพื้นที่ / รื้อถอน / ถมดิน / วางผัง', taskIds: ['1.2', '1.3'], extraSections: [1],
        checklist: ['ระดับดินถมตามแบบ', 'บดอัดแน่น ไม่มีน้ำขัง', 'หมุดและแนวผังตรงตามแบบ', 'ขนเศษวัสดุออกจากพื้นที่แล้ว'],
        questions: ['มีรถแม็คโคร/รถบดอัดเองหรือเช่า'],
    },
    {
        id: 'temp-utilities', label: 'น้ำ-ไฟชั่วคราว', taskIds: ['1.1'], extraSections: [],
        checklist: ['ตู้ไฟชั่วคราวมีเบรกเกอร์กันดูด', 'สายไฟยกพ้นพื้น', 'จุดน้ำใช้ครบตามที่ตกลง'],
        questions: [],
    },
    {
        id: 'piling', label: 'เสาเข็ม', taskIds: ['1.4'], extraSections: [],
        checklist: ['จำนวนต้นครบตามแบบ', 'ตำแหน่งเข็มคลาดเคลื่อนไม่เกินเกณฑ์', 'ความลึก/ระดับหัวเข็มตามแบบ', 'เข็มไม่แตกร้าว'],
        questions: ['ใช้ปั้นจั่นหรือเครื่องเจาะแบบไหน', 'มีผลทดสอบเข็ม (Seismic test) ให้หรือไม่'],
    },
    {
        id: 'structure', label: 'โครงสร้าง ค.ส.ล.', taskIds: ['1.5', '1.6', '1.7', '2.1', '2.2', '2.3', '2.4', '2.5'], extraSections: [],
        checklist: ['ขนาดและระดับตามแบบ', 'เหล็กเสริมขนาด/ระยะ/ระยะหุ้มตามแบบ', 'แบบหล่อแข็งแรง ได้ดิ่งได้ฉาก', 'เทคอนกรีตแน่น ไม่เป็นโพรง', 'บ่มคอนกรีตตามกำหนด'],
        questions: ['มีวิศวกรหรือโฟร์แมนคุมงานหน้างานไหม', 'ใช้คอนกรีตผสมเสร็จหรือผสมเอง'],
    },
    {
        id: 'roof-structure', label: 'โครงหลังคา', taskIds: ['3.1', '3.2'], extraSections: [],
        checklist: ['ขนาดเหล็กและระยะแปตามแบบ', 'รอยเชื่อมเต็ม ไม่มีตามด', 'ทาสีกันสนิมครบ', 'ความลาดเอียงตามแบบ'],
        questions: ['มีช่างเชื่อมที่ผ่านการรับรองกี่คน'],
    },
    {
        id: 'roofing', label: 'มุงหลังคา', taskIds: ['3.3'], extraSections: [],
        checklist: ['ระยะทับซ้อนตามสเปกผู้ผลิต', 'ยึดครบทุกจุด', 'ครอบและรอยต่อไม่รั่ว (ทดสอบน้ำ)', 'เก็บเศษวัสดุบนหลังคาแล้ว'],
        questions: [],
    },
    {
        id: 'masonry', label: 'ก่ออิฐ-ฉาบปูน', taskIds: ['4.1', '5.1'], extraSections: [],
        checklist: ['ผนังได้ดิ่งได้แนว', 'เสาเอ็น-ทับหลังครบ', 'ฉาบเรียบ ไม่แตกลายงา', 'มุมและขอบวงกบตรง'],
        questions: ['เคยทำงานฉาบเรียบขัดมันไหม'],
    },
    {
        id: 'electrical', label: 'ไฟฟ้า', taskIds: ['4.2', '5.2', '8.1'], extraSections: [],
        checklist: ['แนวท่อร้อยสายตามแบบ', 'ขนาดสายตามแบบ', 'ต่อลงดินครบ', 'ทดสอบเบรกเกอร์และกันดูด', 'ทุกจุดใช้งานได้'],
        questions: ['ช่างมีหนังสือรับรองความรู้ความสามารถช่างไฟฟ้าภายในอาคารกี่คน'],
    },
    {
        id: 'plumbing', label: 'ประปา-สุขาภิบาล-สุขภัณฑ์', taskIds: ['8.2', '8.4'], extraSections: [],
        checklist: ['ทดสอบแรงดันท่อน้ำดี ไม่รั่ว', 'ท่อน้ำทิ้งมีความลาดเอียง ไหลดี', 'สุขภัณฑ์ยึดแน่น ยาแนวเรียบร้อย', 'ถังบำบัดติดตั้งตามแบบ'],
        questions: [],
    },
    {
        id: 'ceiling', label: 'ฝ้าเพดาน', taskIds: ['6.1'], extraSections: [],
        checklist: ['ระดับฝ้าเรียบ ได้ระดับ', 'โครงคร่าวระยะตามสเปก', 'รอยต่อเรียบ ไม่แตก'],
        questions: [],
    },
    {
        id: 'tiling', label: 'ปูกระเบื้อง / ตกแต่งผนัง', taskIds: ['6.2', '6.3', '6.4'], extraSections: [],
        checklist: ['ไม่มีกระเบื้องโพรง (เคาะฟัง)', 'แนวยาแนวตรง ร่องเท่ากัน', 'พื้นห้องน้ำลาดลงท่อระบาย', 'ไม่มีแผ่นแตกบิ่น'],
        questions: [],
    },
    {
        id: 'painting', label: 'ทาสี', taskIds: ['6.5', '7.2', '8.6'], extraSections: [],
        checklist: ['ทารองพื้นครบทุกผนัง', 'จำนวนรอบตามสเปก', 'สีเรียบ ไม่เป็นคราบ', 'ไม่เปื้อนกระจก/วงกบ/พื้น'],
        questions: [],
    },
    {
        id: 'doors-windows', label: 'ประตู-หน้าต่าง', taskIds: ['7.1', '8.5'], extraSections: [],
        checklist: ['ขนาดและชนิดตามตาราง', 'เปิดปิดคล่อง ไม่ฝืด', 'ยาแนวกันน้ำรอบวงกบ', 'อุปกรณ์ล็อคครบ'],
        questions: [],
    },
    {
        id: 'misc', label: 'เบ็ดเตล็ด', taskIds: ['8.3'], extraSections: [],
        checklist: ['ติดตั้งครบตามรายการ'],
        questions: [],
    },
];

const BY_ID = new Map<TradeId, TradeDef>(TRADES.map(t => [t.id, t]));

export function getTrade(id: TradeId): TradeDef {
    const t = BY_ID.get(id);
    if (t === undefined) throw new Error(`unknown trade ${id}`);
    return t;
}

export function tradeLabel(id: TradeId): string {
    return BY_ID.get(id)?.label ?? id;
}

/** Trade of the planned task (S-Curve id), e.g. '4.2' → 'electrical'. */
export function tradeOfTask(taskId: string): TradeId | undefined {
    return TRADES.find(t => t.taskIds.includes(taskId))?.id;
}

/**
 * Trade of one BOQ row (section 0–31 and its Excel row; slot rows carry the first row of their slot), or undefined
 * for rows that are never subcontracted (section 0).
 */
export function tradeOfRow(section: number, excelRow: number): TradeId | undefined {
    const extra = TRADES.find(t => t.extraSections.includes(section));
    if (extra !== undefined) return extra.id;
    for (const task of PLAN_TASKS) {
        const b = task.manday;
        if (b.section !== section) continue;
        if (b.rows?.from !== undefined && excelRow < b.rows.from) continue;
        if (b.rows?.to !== undefined && excelRow >= b.rows.to) continue;
        return tradeOfTask(task.id);
    }
    return undefined;
}

/** BOQ sections that hold rows of the trade (some sections are shared with another trade). */
export function sectionsOfTrade(id: TradeId): number[] {
    const t = getTrade(id);
    const fromTasks = PLAN_TASKS.filter(p => t.taskIds.includes(p.id)).map(p => p.manday.section);
    return [...new Set([...t.extraSections, ...fromTasks])].sort((a, b) => a - b);
}

/** Planned tasks of the trade (for the schedule a package proposes). */
export function tasksOfTrade(id: TradeId): string[] {
    return [...getTrade(id).taskIds];
}
