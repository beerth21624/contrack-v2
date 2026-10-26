'use client';

import { Button, DatePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useProjectStore } from '@/store/project-store';
import type { ProjectMeta } from '@/domain/project';
import { InputTextField, SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS } from '@/components/sheet/NumberCell';

const FIELDS: { field: keyof ProjectMeta; label: string; placeholder: string }[] = [
    { field: 'projectName', label: 'ชื่อโครงการ', placeholder: 'เช่น บ้านพักอาศัย คสล. 1 ชั้น' },
    { field: 'siteAddress', label: 'สถานที่ก่อสร้าง', placeholder: 'ตำบล อำเภอ จังหวัด' },
    { field: 'ownerName', label: 'เจ้าของบ้าน', placeholder: 'ชื่อ-นามสกุล' },
    { field: 'preparedBy', label: 'ผู้จัดทำ BOQ', placeholder: 'ชื่อผู้รับเหมา / บริษัท' },
];

/** The stored date format (a plain string in the project: "26/10/2026"). */
const DATE_FORMAT = 'DD/MM/YYYY';

/** "26/10/2026" → that day; undefined for anything else (free text typed before the picker existed). */
function parseDocumentDate(text: string): Dayjs | undefined {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
    if (!m) return undefined;
    const [, d = '', mo = '', y = ''] = m;
    const day = dayjs(new Date(Number(y), Number(mo) - 1, Number(d)));
    // 31/02 rolls over to March in Date: not a real date.
    return day.isValid() && day.date() === Number(d) && day.month() === Number(mo) - 1 ? day : undefined;
}

/** The first level: the BOQ header (Excel BOQ Home rows 2–4). */
export function ProjectInfoInputs() {
    const meta = useProjectStore(s => s.project.meta);
    const setMeta = useProjectStore(s => s.setMeta);
    const date = parseDocumentDate(meta.documentDate);
    // A date typed as free text earlier stays as it is until a date is picked.
    const legacyText = date === undefined && meta.documentDate.trim() !== '' ? meta.documentDate : undefined;

    return (
        <SheetCard>
            <p className="mb-2 text-[12px] text-gray-500">เว้นว่างไว้แล้วกลับมากรอกทีหลังได้</p>
            {FIELDS.map(f => (
                <InputTextField key={f.field} label={f.label} value={meta[f.field]} placeholder={f.placeholder}
                    onChange={v => setMeta({ [f.field]: v })} />
            ))}
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-2 py-1">
                <span className="text-[13px] text-gray-700">วันที่เอกสาร</span>
                <div className="flex flex-wrap items-center gap-2">
                    <DatePicker size="small" variant="borderless" format={DATE_FORMAT} value={date ?? null}
                        placeholder={legacyText ?? 'เลือกวันที่'} aria-label="วันที่เอกสาร"
                        style={{ background: SHEET_COLORS.input, borderRadius: 3, minWidth: 150 }}
                        onChange={d => setMeta({ documentDate: d === null ? '' : d.format(DATE_FORMAT) })} />
                    <Button size="small" type="link" className="!px-1" onClick={() => setMeta({ documentDate: dayjs().format(DATE_FORMAT) })}>
                        วันนี้
                    </Button>
                </div>
            </div>
        </SheetCard>
    );
}
