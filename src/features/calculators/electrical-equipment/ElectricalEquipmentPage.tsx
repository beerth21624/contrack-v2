'use client';

import {
    EQUIPMENT_CATALOGUE, EQUIPMENT_ITEMS, EQUIPMENT_UNITS, electricalEquipment,
} from '@/domain/calculators/electrical-equipment';
import { circuitSummary, electricalPipe } from '@/domain/calculators/electrical-pipe';
import { calculatorInput } from '@/domain/project';
import { useProjectStore } from '@/store/project-store';
import { PickListPage, type PickGroup, type PickSuggestion } from '../shared/PickListPage';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const [CEILING_LAMP, DOWNLIGHT, FLUORESCENT_WP, SOCKET_WP, SOCKET, SWITCH] = EQUIPMENT_ITEMS;

/** Guided journey: the count list by symbol family of the electrical plan. */
const groups = (t: CalcT): readonly PickGroup[] => [
    { title: t('electricalEquipment.luminaires'), items: [DOWNLIGHT, CEILING_LAMP, FLUORESCENT_WP] },
    { title: t('electricalEquipment.sockets'), items: [SOCKET, SOCKET_WP] },
    { title: t('electricalEquipment.switches'), items: [SWITCH] },
];

/** Only where people hesitate: waterproof sockets are not counted again as ordinary ones. */
const hints = (t: CalcT): Record<string, string> => ({
    [SOCKET_WP]: t('electricalEquipment.outdoorWetPointsDoNot'),
});

/** Sheet "อุปกรณ์ไฟฟ้า_Equipment " — BOQ section 26, group อุปกรณ์ไฟฟ้า. */
export default function ElectricalEquipmentPage() {
    const t = useTranslations('calculators');
    const project = useProjectStore(s => s.project);
    const { switches, sockets } = circuitSummary(calculatorInput(project, electricalPipe).circuits);
    const suggestions: PickSuggestion[] = [
        { item: SWITCH, qty: switches, levelId: 'electrical-pipe', what: t('electricalEquipment.switchPoints') },
        { item: SOCKET, qty: sockets, levelId: 'electrical-pipe', what: t('electricalEquipment.socketPointsIncludingWaterproofType') },
    ];

    return (
        <PickListPage def={electricalEquipment} catalogue={EQUIPMENT_CATALOGUE} options={EQUIPMENT_ITEMS}
            units={EQUIPMENT_UNITS} title={t('electricalEquipment.electricalEquipmentQuantityTable')}
            groups={groups(t)} itemHints={hints(t)} suggestions={suggestions} />
    );
}
