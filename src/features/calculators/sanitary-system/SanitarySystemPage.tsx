'use client';

import {
    SANITARY_SYSTEM_CATALOGUE, SANITARY_SYSTEM_ITEMS, SANITARY_SYSTEM_UNITS, sanitarySystem,
} from '@/domain/calculators/sanitary-system';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { PickListPage } from '../shared/PickListPage';
import { useTranslations } from 'next-intl';

/** Sheet "ระบบสุขาภิบาล_Sanitary System" — BOQ section 27 งานระบบสุขาภิบาล. */
export default function SanitarySystemPage() {
    const t = useTranslations('calculators');
    const inJourney = useJourneyMode();
    return (
        <PickListPage def={sanitarySystem} catalogue={SANITARY_SYSTEM_CATALOGUE} options={SANITARY_SYSTEM_ITEMS}
            units={SANITARY_SYSTEM_UNITS}
            title={inJourney ? t('sanitarySystem.drainageEquipmentShownInThe') : t('sanitarySystem.drainageEquipmentQuantityCalculationTable')}
            journeyNotes={(
                <p className="mt-2 text-[12px] text-gray-500">
                    {t('sanitarySystem.septicTankManholeAndDrain')}
                </p>
            )}
            notes={(
                <p className="mt-1 text-[12px] text-gray-500">
                    {t('sanitarySystem.septicTankManholeAndDrain2')}
                </p>
            )} />
    );
}
