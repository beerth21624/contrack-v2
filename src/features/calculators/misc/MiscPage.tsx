'use client';

import { MISC_CATALOGUE, MISC_ITEMS, MISC_UNITS, misc } from '@/domain/calculators/misc';
import { PickListPage } from '../shared/PickListPage';
import { useTranslations } from 'next-intl';

/** Sheet "เบ็ดเตล็ด_Other" — BOQ section 28 งานเบ็ดเตล็ด. Rows may hold free-text items with their own unit / prices. */
export default function MiscPage() {
    const t = useTranslations('calculators');
    return (
        <PickListPage def={misc} catalogue={MISC_CATALOGUE} options={MISC_ITEMS} units={MISC_UNITS} allowFreeText
            title={t('misc.miscellaneousWorkQuantityTable')}
            notes={(
                <p className="mt-1 text-[12px] text-gray-500">
                    {t('misc.youCanTypeTheName')}
                </p>
            )}
            journeyNotes={(
                <p className="mt-1 text-[12px] text-gray-500">
                    {t('misc.railingEnterTheTotalLength')}
                </p>
            )} />
    );
}
