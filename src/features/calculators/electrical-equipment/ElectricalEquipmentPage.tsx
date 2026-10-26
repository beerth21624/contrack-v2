'use client';

import {
    EQUIPMENT_CATALOGUE, EQUIPMENT_ITEMS, EQUIPMENT_UNITS, electricalEquipment,
} from '@/domain/calculators/electrical-equipment';
import { circuitSummary, electricalPipe } from '@/domain/calculators/electrical-pipe';
import { calculatorInput } from '@/domain/project';
import { useProjectStore } from '@/store/project-store';
import { PickListPage, type PickGroup, type PickSuggestion } from '../shared/PickListPage';

const [CEILING_LAMP, DOWNLIGHT, FLUORESCENT_WP, SOCKET_WP, SOCKET, SWITCH] = EQUIPMENT_ITEMS;

/** Guided journey: the count list by symbol family of the electrical plan. */
const GROUPS: readonly PickGroup[] = [
    { title: 'ดวงโคม', items: [DOWNLIGHT, CEILING_LAMP, FLUORESCENT_WP] },
    { title: 'เต้ารับ', items: [SOCKET, SOCKET_WP] },
    { title: 'สวิตช์', items: [SWITCH] },
];

/** Only where people hesitate: waterproof sockets are not counted again as ordinary ones. */
const HINTS: Record<string, string> = {
    [SOCKET_WP]: 'ภายนอก / จุดเปียก — ไม่ต้องนับซ้ำในเต้ารับทั่วไป',
};

/** Sheet "อุปกรณ์ไฟฟ้า_Equipment " — BOQ section 26, group อุปกรณ์ไฟฟ้า. */
export default function ElectricalEquipmentPage() {
    const project = useProjectStore(s => s.project);
    const { switches, sockets } = circuitSummary(calculatorInput(project, electricalPipe).circuits);
    const suggestions: PickSuggestion[] = [
        { item: SWITCH, qty: switches, levelId: 'electrical-pipe', what: 'จุดสวิตช์' },
        { item: SOCKET, qty: sockets, levelId: 'electrical-pipe', what: 'จุดเต้ารับ (รวมชนิดกันน้ำ)' },
    ];

    return (
        <PickListPage def={electricalEquipment} catalogue={EQUIPMENT_CATALOGUE} options={EQUIPMENT_ITEMS}
            units={EQUIPMENT_UNITS} title="ตารางคำนวณปริมาณอุปกรณ์ไฟฟ้า"
            groups={GROUPS} itemHints={HINTS} suggestions={suggestions} />
    );
}
