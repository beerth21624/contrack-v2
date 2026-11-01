'use client';

import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
    SANITARY_WARE_CATALOGUE, SANITARY_WARE_ITEMS, SANITARY_WARE_UNITS, addBathroomSet, sanitaryWare,
} from '@/domain/calculators/sanitary-ware';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { PickListPage, type PickGroup } from '../shared/PickListPage';
import { useCalculator } from '../useCalculator';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const [MIRROR, BASIN_TAP, TOILET, FLOOR_DRAIN, PAPER_HOLDER, SOAP_DISH, SHOWER, TOWEL_RAIL, BIDET_SPRAY, BASIN] =
    SANITARY_WARE_ITEMS;

/** Guided journey: fixtures first, then the accessories of each bathroom. */
const groupsOf = (t: CalcT): readonly PickGroup[] => [
    { title: t('sanitaryWare.sanitaryWare'), items: [TOILET, BIDET_SPRAY, BASIN, BASIN_TAP, SHOWER] },
    { title: t('sanitaryWare.bathroomFixtures'), items: [MIRROR, PAPER_HOLDER, SOAP_DISH, TOWEL_RAIL, FLOOR_DRAIN] },
];

const hintsOf = (t: CalcT): Record<string, string> => ({
    [FLOOR_DRAIN]: t('sanitaryWare.countTheFDPointsIn'),
});

/** Guided journey: one click adds the fittings of one bathroom (counted on the plan), then single items are corrected. */
function BathroomSetHelper() {
    const t = useTranslations('calculators');
    const { update } = useCalculator(sanitaryWare);
    return (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-blue-50 border border-blue-100 px-3 py-2">
            <Button icon={<PlusOutlined />} onClick={() => update(p => ({ ...p, items: addBathroomSet(p.items) }))}>
                {t('sanitaryWare.add1BathroomSet')}
            </Button>
            <span className="text-[12px] text-gray-600">
                {t('sanitaryWare.countTheBathroomsFromThe')}
            </span>
        </div>
    );
}

/** Sheet "สุขภัณฑ์_Sanitary" — BOQ section 29 งานสุขภัณฑ์. */
export default function SanitaryWarePage() {
    const t = useTranslations('calculators');
    const inJourney = useJourneyMode();
    return (
        <PickListPage def={sanitaryWare} catalogue={SANITARY_WARE_CATALOGUE} options={SANITARY_WARE_ITEMS}
            units={SANITARY_WARE_UNITS} title={inJourney ? t('sanitaryWare.sanitaryWareInTheDrawings') : t('sanitaryWare.sanitaryWareQuantityCalculationTable')}
            journeyTop={<BathroomSetHelper />} groups={groupsOf(t)} itemHints={hintsOf(t)} />
    );
}
