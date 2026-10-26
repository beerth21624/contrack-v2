'use client';

import {
    LOAD_CENTER_CATALOGUE, LOAD_CENTER_ITEMS, LOAD_CENTER_UNITS, loadCenter,
} from '@/domain/calculators/load-center';
import { PickListPage } from '../shared/PickListPage';

/** Sheet "ตู้ควบคุม_Load Center" — BOQ section 26, group งานตู้ควบคุมระบบไฟฟ้า. */
export default function LoadCenterPage() {
    return (
        <PickListPage def={loadCenter} catalogue={LOAD_CENTER_CATALOGUE} options={LOAD_CENTER_ITEMS}
            units={LOAD_CENTER_UNITS} title="ตารางคำนวณปริมาณอุปกรณ์ตู้ควบคุม" />
    );
}
