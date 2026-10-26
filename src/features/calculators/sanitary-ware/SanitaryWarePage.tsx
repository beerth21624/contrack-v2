'use client';

import {
    SANITARY_WARE_CATALOGUE, SANITARY_WARE_ITEMS, SANITARY_WARE_UNITS, sanitaryWare,
} from '@/domain/calculators/sanitary-ware';
import { PickListPage } from '../shared/PickListPage';

/** Sheet "สุขภัณฑ์_Sanitary" — BOQ section 29 งานสุขภัณฑ์. */
export default function SanitaryWarePage() {
    return (
        <PickListPage def={sanitaryWare} catalogue={SANITARY_WARE_CATALOGUE} options={SANITARY_WARE_ITEMS}
            units={SANITARY_WARE_UNITS} title="ตารางคำนวณปริมาณสุขภัณฑ์" />
    );
}
