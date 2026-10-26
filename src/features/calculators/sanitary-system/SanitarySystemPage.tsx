'use client';

import {
    SANITARY_SYSTEM_CATALOGUE, SANITARY_SYSTEM_ITEMS, SANITARY_SYSTEM_UNITS, sanitarySystem,
} from '@/domain/calculators/sanitary-system';
import { PickListPage } from '../shared/PickListPage';

/** Sheet "ระบบสุขาภิบาล_Sanitary System" — BOQ section 27 งานระบบสุขาภิบาล. */
export default function SanitarySystemPage() {
    return (
        <PickListPage def={sanitarySystem} catalogue={SANITARY_SYSTEM_CATALOGUE} options={SANITARY_SYSTEM_ITEMS}
            units={SANITARY_SYSTEM_UNITS} title="ตารางคำนวณปริมาณอุปกรณ์ระบบระบายน้ำทิ้ง"
            notes={(
                <p className="mt-1 text-[12px] text-gray-500">
                    ถังบำบัด, บ่อพัก และท่อระบายน้ำ มีหมายเหตุใน BOQ: &quot;รถแมคโครเล็ก&quot;.
                </p>
            )} />
    );
}
