'use client';

import {
    EQUIPMENT_CATALOGUE, EQUIPMENT_ITEMS, EQUIPMENT_UNITS, electricalEquipment,
} from '@/domain/calculators/electrical-equipment';
import { PickListPage } from '../shared/PickListPage';

/** Sheet "อุปกรณ์ไฟฟ้า_Equipment " — BOQ section 26, group อุปกรณ์ไฟฟ้า. */
export default function ElectricalEquipmentPage() {
    return (
        <PickListPage def={electricalEquipment} catalogue={EQUIPMENT_CATALOGUE} options={EQUIPMENT_ITEMS}
            units={EQUIPMENT_UNITS} title="ตารางคำนวณปริมาณอุปกรณ์ไฟฟ้า" />
    );
}
