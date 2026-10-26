'use client';

import {
    LOAD_CENTER_CATALOGUE, LOAD_CENTER_ITEMS, LOAD_CENTER_UNITS, loadCenter,
} from '@/domain/calculators/load-center';
import { circuitSummary, electricalPipe } from '@/domain/calculators/electrical-pipe';
import { calculatorInput } from '@/domain/project';
import { useProjectStore } from '@/store/project-store';
import { PickListPage } from '../shared/PickListPage';

/** Sheet "ตู้ควบคุม_Load Center" — BOQ section 26, group งานตู้ควบคุมระบบไฟฟ้า. */
export default function LoadCenterPage() {
    const project = useProjectStore(s => s.project);
    const circuits = calculatorInput(project, electricalPipe).circuits;
    const { byBreaker } = circuitSummary(circuits);
    const breakers = Object.entries(byBreaker).map(([size, n]) => `${size.replace(/\.$/, '')} ${n} วงจร`).join(', ');

    return (
        <PickListPage def={loadCenter} catalogue={LOAD_CENTER_CATALOGUE} options={LOAD_CENTER_ITEMS}
            units={LOAD_CENTER_UNITS} title="ตารางคำนวณปริมาณอุปกรณ์ตู้ควบคุม"
            journeyNotes={(
                <ul className="mt-1 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>เบรกเกอร์ย่อย 1 ตัวต่อ 1 วงจร (ชนิดกันดูด ELCB สำหรับวงจรห้องน้ำ เครื่องทำน้ำอุ่น และภายนอก)</li>
                    {circuits.length > 0 && <li>ด่านท่อร้อยสายไฟมี {circuits.length} วงจร{breakers === '' ? '' : `: ${breakers}`}</li>}
                    <li>สายเมนไฟฟ้า: ระยะจากมิเตอร์ไฟฟ้าถึงตู้ควบคุม · สายกราวด์: จากตู้ถึงแท่งกราวด์</li>
                </ul>
            )} />
    );
}
