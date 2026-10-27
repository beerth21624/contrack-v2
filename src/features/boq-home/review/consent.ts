// ─── Consent before the decision model sees a BOQ ───
// The model is asked only after the user confirms in a dialog, never on a data change. Pure: no React, no network.
// Tomorrow's per-user limits (a premium plan) plug in here and in the backend's AiAccess, not in the button.

export interface AiReviewGate {
    signedIn: boolean;
    /** Module `ai-assist` on for the current workspace (platform and workspace switches). */
    moduleEnabled: boolean;
    workspaceId: string | undefined;
    /** Item rows the review would send. */
    rowCount: number;
}

/**
 * What a click on "ตรวจ BOQ ก่อนส่ง" does: `ask` = show the consent dialog (the model can be used),
 * `rules` = open the panel with the deterministic rules only (nothing is sent anywhere).
 */
export function reviewClickAction(gate: AiReviewGate): 'ask' | 'rules' {
    return gate.signedIn && gate.moduleEnabled && gate.workspaceId !== undefined && gate.rowCount > 0 ? 'ask' : 'rules';
}

/** Dialog copy. Short, factual, professional Thai; says what is sent, to whom, what it costs, and who decides. */
export const CONSENT_TEXT = {
    title: 'ส่งข้อมูล BOQ ให้ AI ช่วยตรวจหรือไม่',
    sends: 'ระบบจะส่งรายการใน BOQ ของโครงการนี้ (ชื่อโครงการ ชื่อรายการ หน่วย ปริมาณ เปอร์เซ็นต์เผื่อ ราคาต่อหน่วย และหมายเหตุ) ไปยังโมเดล AI ภายนอก (Jev โดย TypeSafe AI) เพื่อหาแถวที่ดูไม่สอดคล้องกัน ไม่ส่งชื่อเจ้าของบ้าน สถานที่ หรือข้อมูลส่วนบุคคลอื่น',
    hints: 'ผลที่ได้เป็นข้อสังเกตเท่านั้นและอาจผิดพลาดได้ ระบบไม่แก้ตัวเลขใดให้ ผู้ประมาณราคายังเป็นผู้ตัดสินใจทุกรายการ',
    cost: 'การตรวจด้วย AI มีค่าใช้จ่ายต่อครั้ง และทำงานเฉพาะเมื่อกดยืนยันในหน้าต่างนี้เท่านั้น ไม่ทำงานเองเมื่อแก้ข้อมูล',
    confirm: 'ส่งให้ AI ตรวจ',
    rulesOnly: 'ตรวจเฉพาะกฎพื้นฐาน',
    cancel: 'ยกเลิก',
} as const;
