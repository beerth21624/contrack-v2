'use client';

import {
    EQUIPMENT_CATALOGUE, EQUIPMENT_ITEMS, EQUIPMENT_UNITS, electricalEquipment,
} from '@/domain/calculators/electrical-equipment';
import { circuitSummary, electricalPipe } from '@/domain/calculators/electrical-pipe';
import { formatNumber } from '@/components/sheet/NumberCell';
import { calculatorInput } from '@/domain/project';
import { useProjectStore } from '@/store/project-store';
import { PickListPage } from '../shared/PickListPage';

/** Sheet "อุปกรณ์ไฟฟ้า_Equipment " — BOQ section 26, group อุปกรณ์ไฟฟ้า. */
export default function ElectricalEquipmentPage() {
    const project = useProjectStore(s => s.project);
    const { switches, sockets } = circuitSummary(calculatorInput(project, electricalPipe).circuits);

    return (
        <PickListPage def={electricalEquipment} catalogue={EQUIPMENT_CATALOGUE} options={EQUIPMENT_ITEMS}
            units={EQUIPMENT_UNITS} title="ตารางคำนวณปริมาณอุปกรณ์ไฟฟ้า"
            journeyNotes={(
                <ul className="mt-1 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>นับสัญลักษณ์ในแปลนไฟฟ้า: โคมแต่ละชนิด เต้ารับ (ชนิดกันน้ำสำหรับภายนอก/จุดเปียก) และสวิตช์</li>
                    {switches + sockets > 0 && (
                        <li>
                            ตรวจสอบกับขั้นตอนท่อร้อยสายไฟ: นับสวิตช์ไว้ {formatNumber(switches, 0)} จุด, เต้ารับ {formatNumber(sockets, 0)} จุด
                        </li>
                    )}
                </ul>
            )} />
    );
}
