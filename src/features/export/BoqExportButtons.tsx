'use client';

// "ดาวน์โหลด Excel" + "พิมพ์ / PDF" for the current project. Reused by the BOQ (Home) page and the journey finish card.
// PDF = the browser's print dialog ("Save as PDF") on a print-only document, so Thai uses the app's Sarabun font.

import { useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Button, message, Space } from 'antd';
import { FileExcelOutlined, PrinterOutlined } from '@ant-design/icons';
import { useProjectStore } from '@/store/project-store';
import { computeProject, type Project } from '@/domain/project';
import { boqFileBaseName } from './boq-sheet';
import { buildBoqPrintModel, type BoqPrintModel } from './boq-print-model';
import { BoqPrintDocument } from './BoqPrintDocument';
import { downloadBoqXlsx } from './xlsx';

export const EXPORT_TEXT = {
    excel: 'ดาวน์โหลด Excel',
    print: 'พิมพ์ / PDF',
    excelFailed: 'สร้างไฟล์ Excel ไม่สำเร็จ',
} as const;

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
    const [printModel, setPrintModel] = useState<BoqPrintModel | null>(null);
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

    const onPrint = () => {
        const model = buildBoqPrintModel(computeProject(project).boq, project.meta);
        const prevTitle = document.title;
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            window.removeEventListener('afterprint', finish);
            document.title = prevTitle;
            setPrintModel(null);
        };
        // Mount the print document synchronously, so the dialog sees it.
        flushSync(() => setPrintModel(model));
        document.title = boqFileBaseName(project.meta);   // the browser's default PDF file name
        window.addEventListener('afterprint', finish);
        window.print();
        // Browsers whose print() returns before the dialog closes fire afterprint later; the others are done now.
        if (!('onafterprint' in window)) finish();
    };

    return (
        <>
            {msgHolder}
            <Space wrap size={8}>
                <Button size={size} icon={<FileExcelOutlined />} loading={busy} disabled={!ready}
                    onClick={() => { void onExcel(); }}>
                    {EXPORT_TEXT.excel}
                </Button>
                <Button size={size} type={primary ? 'primary' : 'default'} icon={<PrinterOutlined />} disabled={!ready}
                    onClick={onPrint}>
                    {EXPORT_TEXT.print}
                </Button>
            </Space>
            {printModel !== null && createPortal(<BoqPrintDocument model={printModel} />, document.body)}
        </>
    );
}
