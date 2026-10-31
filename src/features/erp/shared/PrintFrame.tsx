'use client';

// ─── The frame of every printed ERP document (docs/erp/01-architecture.md §15) ───
// Screen: a toolbar (print / close, in the UI language) over an A4 sheet on the grey backdrop of the (print) layout.
// Paper: A4 with 15 mm margins, the toolbar hidden, Sarabun (Thai + Latin), backgrounds printed exactly.
// The document itself follows its own language (`language`), never the UI locale: the watermark text comes from
// documentTranslator(language); the page content is the caller's (also via documentTranslator + format.ts).
import { useEffect, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'antd';
import { CloseOutlined, PrinterOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/config';
import { documentTranslator } from '@/i18n/document-translator';

export type PrintWatermark = 'draft' | 'void';
export type PrintOrientation = 'portrait' | 'landscape';

const R = 'erpp';

function printCss(orientation: PrintOrientation): string {
    const [w, h] = orientation === 'landscape' ? ['297mm', '210mm'] : ['210mm', '297mm'];
    return `
@page { size: A4 ${orientation}; margin: 15mm; }
.${R}-toolbar {
  position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 8px 16px; background: #fff; border-bottom: 1px solid #e5e7eb;
}
.${R}-toolbar-title { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #4b5563; font-size: 13px; }
.${R}-viewport { overflow-x: auto; padding: 16px; }
.${R}-sheet {
  position: relative; box-sizing: border-box; width: ${w}; min-height: ${h}; margin: 0 auto; padding: 15mm;
  background: #fff; box-shadow: 0 1px 3px rgb(16 24 40 / .12), 0 1px 2px rgb(16 24 40 / .06);
  font-family: var(--font-sarabun, 'Sarabun'), 'Sarabun', 'TH Sarabun New', Tahoma, sans-serif;
  color: #000; font-size: 11pt; line-height: 1.4; font-variant-numeric: tabular-nums lining-nums;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.${R}-sheet *, .${R}-sheet *::before, .${R}-sheet *::after { box-sizing: border-box; }
.${R}-content { position: relative; z-index: 1; }
.${R}-watermark {
  position: absolute; inset: 0; z-index: 0; display: flex; align-items: center; justify-content: center;
  pointer-events: none; overflow: hidden;
}
.${R}-watermark span {
  transform: rotate(-30deg); font-size: 88pt; font-weight: 700; letter-spacing: 4mm; white-space: nowrap;
  color: rgb(0 0 0 / .07); border: 2mm solid rgb(0 0 0 / .07); padding: 2mm 10mm; border-radius: 4mm;
}
@media print {
  html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
  .${R}-toolbar { display: none !important; }
  .${R}-viewport { overflow: visible; padding: 0; }
  .${R}-sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  /* fixed = repeated on every printed page */
  .${R}-watermark { position: fixed; }
}
`;
}

export function PrintFrame({ language, watermark, title, orientation = 'portrait', ready = true, children }: {
    /** The document's language (document.language), not the UI locale. */
    language: Locale;
    /** Draft and void documents print a watermark ("ฉบับร่าง" / "DRAFT", "ยกเลิก" / "VOID"). */
    watermark?: PrintWatermark | null;
    /** Tab title while the page is open: the browser's default file name for "save as PDF" (e.g. the document number). */
    title?: string;
    orientation?: PrintOrientation;
    /** false while the document loads: the print button waits. */
    ready?: boolean;
    children: ReactNode;
}) {
    const t = useTranslations('erp');
    const tc = useTranslations('common');
    const router = useRouter();
    const td = useMemo(() => documentTranslator(language), [language]);
    const css = useMemo(() => printCss(orientation), [orientation]);

    useEffect(() => {
        if (title === undefined || title === '') return undefined;
        const before = document.title;
        document.title = title;
        return () => { document.title = before; };
    }, [title]);

    // Opened in a new tab (the usual way): close it; reached by navigation: go back.
    const close = () => {
        if (window.history.length > 1) router.back();
        else window.close();
    };

    return (
        <>
            <style>{css}</style>
            <div className={`${R}-toolbar`} role="toolbar" aria-label={t('print.toolbar')}>
                <span className={`${R}-toolbar-title`}>{title ?? t('print.paper')}</span>
                <Button type="primary" icon={<PrinterOutlined />} disabled={!ready} onClick={() => window.print()}>
                    {t('print.print')}
                </Button>
                <Button icon={<CloseOutlined />} onClick={close}>{tc('close')}</Button>
            </div>
            <div className={`${R}-viewport`}>
                <article className={`${R}-sheet`} lang={language}>
                    {watermark !== undefined && watermark !== null && (
                        <div className={`${R}-watermark`} aria-hidden="true">
                            <span>{watermark === 'draft' ? td('common.draft') : td('common.void')}</span>
                        </div>
                    )}
                    <div className={`${R}-content`}>{children}</div>
                </article>
            </div>
        </>
    );
}
