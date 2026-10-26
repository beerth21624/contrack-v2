'use client';

import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
    SANITARY_WARE_CATALOGUE, SANITARY_WARE_ITEMS, SANITARY_WARE_UNITS, addBathroomSet, sanitaryWare,
} from '@/domain/calculators/sanitary-ware';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { PickListPage, type PickGroup } from '../shared/PickListPage';
import { useCalculator } from '../useCalculator';

const [MIRROR, BASIN_TAP, TOILET, FLOOR_DRAIN, PAPER_HOLDER, SOAP_DISH, SHOWER, TOWEL_RAIL, BIDET_SPRAY, BASIN] =
    SANITARY_WARE_ITEMS;

/** Guided journey: fixtures first, then the accessories of each bathroom. */
const GROUPS: readonly PickGroup[] = [
    { title: 'สุขภัณฑ์', items: [TOILET, BIDET_SPRAY, BASIN, BASIN_TAP, SHOWER] },
    { title: 'อุปกรณ์ในห้องน้ำ', items: [MIRROR, PAPER_HOLDER, SOAP_DISH, TOWEL_RAIL, FLOOR_DRAIN] },
];

const HINTS: Record<string, string> = {
    [FLOOR_DRAIN]: 'นับจุด FD ในแปลนห้องน้ำ (ห้องที่มีส่วนอาบน้ำมักมี 2 จุด)',
};

/** Guided journey: one click adds the fittings of one bathroom (counted on the plan), then single items are corrected. */
function BathroomSetHelper() {
    const { update } = useCalculator(sanitaryWare);
    return (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-blue-50 border border-blue-100 px-3 py-2">
            <Button icon={<PlusOutlined />} onClick={() => update(p => ({ ...p, items: addBathroomSet(p.items) }))}>
                เพิ่มชุดห้องน้ำ 1 ห้อง
            </Button>
            <span className="text-[12px] text-gray-600">
                นับห้องน้ำจากแปลน แล้วกดทีละห้อง: ได้ชักโครก สายชำระ อ่างล้างหน้า ก๊อก กระจก ฝักบัว และอุปกรณ์ ห้องละ 1 ชุด
                — แก้จำนวนแต่ละรายการได้ด้านล่าง
            </span>
        </div>
    );
}

/** Sheet "สุขภัณฑ์_Sanitary" — BOQ section 29 งานสุขภัณฑ์. */
export default function SanitaryWarePage() {
    const inJourney = useJourneyMode();
    return (
        <PickListPage def={sanitaryWare} catalogue={SANITARY_WARE_CATALOGUE} options={SANITARY_WARE_ITEMS}
            units={SANITARY_WARE_UNITS} title={inJourney ? 'สุขภัณฑ์ที่มีในแบบ' : 'ตารางคำนวณปริมาณสุขภัณฑ์'}
            journeyTop={<BathroomSetHelper />} groups={GROUPS} itemHints={HINTS} />
    );
}
