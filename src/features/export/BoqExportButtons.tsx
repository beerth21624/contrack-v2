'use client';

// "ดาวน์โหลด Excel" + "พิมพ์ / PDF" for the current project. Reused by the BOQ (Home) page and the journey finish card.
// PDF = the browser's print dialog ("Save as PDF") on a print-only document, so Thai uses the app's Sarabun font.
// The arrow next to the print button prints one form only (summary ปร.5 or detail ปร.4).

import { useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Button, Dropdown, message, Space, type MenuProps } from 'antd';
import { DownOutlined, FileExcelOutlined, PrinterOutlined } from '@ant-design/icons';
import { useProjectStore } from '@/store/project-store';
import { computeProject, type Project } from '@/domain/project';
import { boqFileBaseName } from './boq-sheet';
import { buildBoqPrintModel, type BoqPrintModel, type PrintPart } from './boq-print-model';
import { BoqPrintDocument, PRINT_FONT_VAR } from './BoqPrintDocument';
import { downloadBoqXlsx } from './xlsx';

export const EXPORT_TEXT = {
    excel: 'ดาวน์โหลด Excel',
    print: 'พิมพ์ / PDF',
    printChoose: 'เลือกแบบที่จะพิมพ์',
    printAll: 'ทั้งชุด (แบบสรุป ปร.5 + รายการ ปร.4)',
    printSummary: 'เฉพาะแบบสรุป (ปร.5)',
    printDetail: 'เฉพาะรายการ ปริมาณงานและราคา (ปร.4)',
    excelFailed: 'สร้างไฟล์ Excel ไม่สำเร็จ',
} as const;

const PRINT_MENU: NonNullable<MenuProps['items']> = [
    { key: 'all', label: EXPORT_TEXT.printAll },
    { key: 'summary', label: EXPORT_TEXT.printSummary },
    { key: 'detail', label: EXPORT_TEXT.printDetail },
];

const isPrintPart = (k: string): k is PrintPart => k === 'all' || k === 'summary' || k === 'detail';

export interface BoqExportButtonsProps {
    /** Project to export (default: the saved project in the store). */
    project?: Project;
    size?: 'small' | 'middle' | 'large';
    /** Primary style for the print button (e.g. on the journey finish card). */
    primary?: boolean;
}

export function BoqExportButtons({ project: projectProp, size = 'middle', primary = false }: BoqExportButtonsProps) {
    const stored = useProjectStore(s => s.project);
    const hasHydrated = useProjectStore(s => s.hasHydrated);
    const project = projectProp ?? stored;
    const ready = projectProp !== undefined || hasHydrated;
    const [busy, setBusy] = useState(false);
    const [printJob, setPrintJob] = useState<{ model: BoqPrintModel; part: PrintPart } | null>(null);
    const [msg, msgHolder] = message.useMessage();

    const onExcel = async () => {
        setBusy(true);
        try {
            await downloadBoqXlsx(project);
        } catch (e) {
            console.error('BOQ Excel export failed', e);
            void msg.error(EXPORT_TEXT.excelFailed);
        } finally {
            setBusy(false);
        }
    };

    const onPrint = (part: PrintPart) => {
        const model = buildBoqPrintModel(computeProject(project).boq, project.meta);
        const prevTitle = document.title;
        const root = document.documentElement;
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            window.removeEventListener('afterprint', finish);
            document.title = prevTitle;
            root.style.removeProperty(PRINT_FONT_VAR);
            setPrintJob(null);
        };
        // The page-number margin box only inherits from <html>; hand it the Sarabun family that body has.
        const font = getComputedStyle(document.body).getPropertyValue('--font-sarabun').trim();
        if (font !== '') root.style.setProperty(PRINT_FONT_VAR, font);
        // Mount the print document synchronously, so the dialog sees it.
        flushSync(() => setPrintJob({ model, part }));
        document.title = boqFileBaseName(project.meta);   // the browser's default PDF file name
        window.addEventListener('afterprint', finish);
        window.print();
        // Browsers whose print() returns before the dialog closes fire afterprint later; the others are done now.
        if (!('onafterprint' in window)) finish();
    };

    const printType = primary ? 'primary' : 'default';
    return (
        <>
            {msgHolder}
            <Space wrap size={8}>
                <Button size={size} icon={<FileExcelOutlined />} loading={busy} disabled={!ready}
                    onClick={() => { void onExcel(); }}>
                    {EXPORT_TEXT.excel}
                </Button>
                <Space.Compact>
                    <Button size={size} type={printType} icon={<PrinterOutlined />} disabled={!ready}
                        onClick={() => onPrint('all')}>
                        {EXPORT_TEXT.print}
                    </Button>
                    <Dropdown disabled={!ready} trigger={['click']}
                        menu={{ items: PRINT_MENU, onClick: ({ key }) => { if (isPrintPart(key)) onPrint(key); } }}>
                        <Button size={size} type={printType} icon={<DownOutlined />} disabled={!ready}
                            aria-label={EXPORT_TEXT.printChoose} title={EXPORT_TEXT.printChoose} />
                    </Dropdown>
                </Space.Compact>
            </Space>
            {printJob !== null && createPortal(<BoqPrintDocument model={printJob.model} part={printJob.part} />, document.body)}
        </>
    );
}
