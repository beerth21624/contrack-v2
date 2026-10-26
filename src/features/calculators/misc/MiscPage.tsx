'use client';

import { MISC_CATALOGUE, MISC_ITEMS, MISC_UNITS, misc } from '@/domain/calculators/misc';
import { PickListPage } from '../shared/PickListPage';

/** Sheet "เบ็ดเตล็ด_Other" — BOQ section 28 งานเบ็ดเตล็ด. Rows may hold free-text items with their own unit / prices. */
export default function MiscPage() {
    return (
        <PickListPage def={misc} catalogue={MISC_CATALOGUE} options={MISC_ITEMS} units={MISC_UNITS} allowFreeText
            title="ตารางคำนวณปริมาณงานเบ็ดเตล็ด"
            notes={(
                <p className="mt-1 text-[12px] text-gray-500">
                    พิมพ์ชื่อรายการอื่นที่ไม่อยู่ในรายการได้ — ใส่หน่วย, ค่าวัสดุ และค่าแรงต่อหน่วยเอง (ถ้าไม่ใส่ราคา = 0).
                </p>
            )}
            journeyNotes={(
                <p className="mt-1 text-[12px] text-gray-500">ราวกันตก: ใส่ความยาวรวมเป็นเมตร (วัดจากแปลน/รูปด้าน)</p>
            )} />
    );
}
