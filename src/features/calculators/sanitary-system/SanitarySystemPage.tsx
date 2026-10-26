'use client';

import {
    SANITARY_SYSTEM_CATALOGUE, SANITARY_SYSTEM_ITEMS, SANITARY_SYSTEM_UNITS, sanitarySystem,
} from '@/domain/calculators/sanitary-system';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { PickListPage } from '../shared/PickListPage';

/** Sheet "ระบบสุขาภิบาล_Sanitary System" — BOQ section 27 งานระบบสุขาภิบาล. */
export default function SanitarySystemPage() {
    const inJourney = useJourneyMode();
    return (
        <PickListPage def={sanitarySystem} catalogue={SANITARY_SYSTEM_CATALOGUE} options={SANITARY_SYSTEM_ITEMS}
            units={SANITARY_SYSTEM_UNITS}
            title={inJourney ? 'อุปกรณ์ระบบระบายน้ำทิ้งที่มีในแบบ' : 'ตารางคำนวณปริมาณอุปกรณ์ระบบระบายน้ำทิ้ง'}
            journeyNotes={(
                <p className="mt-2 text-[12px] text-gray-500">
                    งานถังบำบัด บ่อพัก และท่อระบายน้ำ ต้องใช้รถแมคโครเล็ก
                </p>
            )}
            notes={(
                <p className="mt-1 text-[12px] text-gray-500">
                    ถังบำบัด, บ่อพัก และท่อระบายน้ำ มีหมายเหตุใน BOQ: &quot;รถแมคโครเล็ก&quot;.
                </p>
            )} />
    );
}
