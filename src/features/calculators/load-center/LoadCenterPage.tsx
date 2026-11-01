'use client';

import {
    LOAD_CENTER_CATALOGUE, LOAD_CENTER_ITEMS, LOAD_CENTER_UNITS, loadCenter,
} from '@/domain/calculators/load-center';
import { circuitSummary, electricalPipe } from '@/domain/calculators/electrical-pipe';
import { calculatorInput } from '@/domain/project';
import { useProjectStore } from '@/store/project-store';
import { PickListPage, type PickGroup, type PickSuggestion } from '../shared/PickListPage';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const [MAIN_CB, ELCB20, CB16, CB20, CONSUMER_UNIT, GROUND_ROD, GROUND_CABLE, MAIN_CABLE] = LOAD_CENTER_ITEMS;

/** Guided journey: the count list as the electrical diagram shows it. */
const groups = (t: CalcT): readonly PickGroup[] => [
    { title: t('loadCenter.panelAndBreakers'), items: [CONSUMER_UNIT, MAIN_CB, ELCB20, CB16, CB20] },
    { title: t('loadCenter.mainCableAndGroundingSystem'), items: [MAIN_CABLE, GROUND_ROD, GROUND_CABLE] },
];

/** Only where people hesitate: which circuits get an ELCB, and where the two cables are measured. */
const hints = (t: CalcT): Record<string, string> => ({
    [ELCB20]: t('loadCenter.bathroomWaterHeaterAndOutdoor'),
    [CB20]: t('loadCenter.circuitsAlreadyOnAnElcb'),
    [MAIN_CABLE]: t('loadCenter.fromTheElectricMeterTo'),
    [GROUND_CABLE]: t('loadCenter.fromTheControlPanelTo'),
});

/** Sheet "ตู้ควบคุม_Load Center" — BOQ section 26, group งานตู้ควบคุมระบบไฟฟ้า. */
export default function LoadCenterPage() {
    const t = useTranslations('calculators');
    const project = useProjectStore(s => s.project);
    const { byBreaker } = circuitSummary(calculatorInput(project, electricalPipe).circuits);
    const suggestions: PickSuggestion[] = [
        { item: CB16, qty: byBreaker['16A.'] ?? 0, levelId: 'electrical-pipe', what: t('loadCenter.n16aBreakerCircuits') },
        { item: CB20, qty: byBreaker['20A.'] ?? 0, levelId: 'electrical-pipe', what: t('loadCenter.n20aBreakerCircuits') },
    ];

    return (
        <PickListPage def={loadCenter} catalogue={LOAD_CENTER_CATALOGUE} options={LOAD_CENTER_ITEMS}
            units={LOAD_CENTER_UNITS} title={t('loadCenter.controlPanelEquipmentQuantityTable')}
            groups={groups(t)} itemHints={hints(t)} suggestions={suggestions} />
    );
}
