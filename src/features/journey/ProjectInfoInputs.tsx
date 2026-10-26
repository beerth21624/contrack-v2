'use client';

import { useProjectStore } from '@/store/project-store';
import type { ProjectMeta } from '@/domain/project';
import { InputTextField, SheetCard } from '@/components/sheet/SheetFields';

const FIELDS: { field: keyof ProjectMeta; label: string; placeholder: string }[] = [
    { field: 'projectName', label: 'ชื่อโครงการ', placeholder: 'เช่น บ้านพักอาศัย คสล. 1 ชั้น' },
    { field: 'siteAddress', label: 'สถานที่ก่อสร้าง', placeholder: 'ตำบล อำเภอ จังหวัด' },
    { field: 'ownerName', label: 'เจ้าของบ้าน', placeholder: 'ชื่อ-นามสกุล' },
    { field: 'preparedBy', label: 'ผู้จัดทำ BOQ', placeholder: 'ชื่อผู้รับเหมา / บริษัท' },
    { field: 'documentDate', label: 'วันที่เอกสาร', placeholder: 'เช่น 26/10/2026' },
];

/** The first level: the BOQ header (Excel BOQ Home rows 2–4). */
export function ProjectInfoInputs() {
    const meta = useProjectStore(s => s.project.meta);
    const setMeta = useProjectStore(s => s.setMeta);
    return (
        <SheetCard>
            {FIELDS.map(f => (
                <InputTextField key={f.field} label={f.label} value={meta[f.field]} placeholder={f.placeholder}
                    onChange={v => setMeta({ [f.field]: v })} />
            ))}
        </SheetCard>
    );
}
