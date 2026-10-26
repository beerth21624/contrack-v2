'use client';

import {
    LOAD_CENTER_CATALOGUE, LOAD_CENTER_ITEMS, LOAD_CENTER_UNITS, loadCenter,
} from '@/domain/calculators/load-center';
import { circuitSummary, electricalPipe } from '@/domain/calculators/electrical-pipe';
import { calculatorInput } from '@/domain/project';
import { useProjectStore } from '@/store/project-store';
import { PickListPage, type PickGroup, type PickSuggestion } from '../shared/PickListPage';

const [MAIN_CB, ELCB20, CB16, CB20, CONSUMER_UNIT, GROUND_ROD, GROUND_CABLE, MAIN_CABLE] = LOAD_CENTER_ITEMS;

/** Guided journey: the count list as the electrical diagram shows it. */
const GROUPS: readonly PickGroup[] = [
    { title: 'ตู้และเบรกเกอร์', items: [CONSUMER_UNIT, MAIN_CB, ELCB20, CB16, CB20] },
    { title: 'สายเมนและระบบกราวด์', items: [MAIN_CABLE, GROUND_ROD, GROUND_CABLE] },
];

/** Only where people hesitate: which circuits get an ELCB, and where the two cables are measured. */
const HINTS: Record<string, string> = {
    [ELCB20]: 'วงจรห้องน้ำ เครื่องทำน้ำอุ่น และภายนอก',
    [CB20]: 'วงจรที่ใช้ ELCB แล้วไม่ต้องนับซ้ำ',
    [MAIN_CABLE]: 'จากมิเตอร์ไฟฟ้าถึงตู้ควบคุม',
    [GROUND_CABLE]: 'จากตู้ควบคุมถึงแท่งกราวด์',
};

/** Sheet "ตู้ควบคุม_Load Center" — BOQ section 26, group งานตู้ควบคุมระบบไฟฟ้า. */
export default function LoadCenterPage() {
    const project = useProjectStore(s => s.project);
    const { byBreaker } = circuitSummary(calculatorInput(project, electricalPipe).circuits);
    const suggestions: PickSuggestion[] = [
        { item: CB16, qty: byBreaker['16A.'] ?? 0, levelId: 'electrical-pipe', what: 'วงจรเบรกเกอร์ 16A' },
        { item: CB20, qty: byBreaker['20A.'] ?? 0, levelId: 'electrical-pipe', what: 'วงจรเบรกเกอร์ 20A' },
    ];

    return (
        <PickListPage def={loadCenter} catalogue={LOAD_CENTER_CATALOGUE} options={LOAD_CENTER_ITEMS}
            units={LOAD_CENTER_UNITS} title="ตารางคำนวณปริมาณอุปกรณ์ตู้ควบคุม"
            groups={GROUPS} itemHints={HINTS} suggestions={suggestions} />
    );
}
