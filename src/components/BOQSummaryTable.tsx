import React, { useMemo, useState, useCallback } from 'react';
import { Typography, Tag, Button, App, Space, Alert } from 'antd';
import { DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import { type PriceItem, type StepResult } from '@/types';
import { buildBOQSections, BOQ_CATEGORIES, type Section } from '@/lib/boq-mapper';
import { exportBOQSummaryToExcel } from '@/lib/excel-io';
import { useTranslations } from 'next-intl';
import { useAppLocale } from '@/i18n/LocaleProvider';
import { useAppStore } from '@/lib/store';
import { buildSchedule } from '@/lib/schedule-engine';
import { SCHEDULE_DATA } from '@/data/schedule-data';

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtN = (v: number | null) =>
    v === null ? '–' : v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtTotal = (v: number) =>
    v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const { Text } = Typography;

// ── Types ────────────────────────────────────────────────────────────────────

interface BOQSummaryProps {
    stepSaves: Record<number, { inp?: unknown; res: StepResult } | undefined>;
    priceList: PriceItem[];
}

// Removed local Section, SectionRow, makeRow

// ── Layout constants ──────────────────────────────────────────────────────────

const GRID = '52px 60px minmax(220px,1fr) 100px 58px 100px 120px 100px 120px 130px';

const TH: React.CSSProperties = {
    padding: '9px 10px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#ffffff',
    textAlign: 'right',
    borderRight: '1px solid rgba(255,255,255,0.1)',
    lineHeight: 1.35,
    whiteSpace: 'nowrap',
};

const TD = (align: 'left' | 'right' | 'center' = 'right', muted = false): React.CSSProperties => ({
    padding: '9px 10px',
    fontSize: 13,
    color: muted ? '#8c8c8c' : '#262626',
    textAlign: align,
    fontVariantNumeric: 'tabular-nums',
    borderRight: '1px solid #f0f0f0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
});

// ── Main Component ────────────────────────────────────────────────────────────

export const BOQSummaryTable: React.FC<BOQSummaryProps> = ({ stepSaves, priceList }) => {
    const { message } = App.useApp();
    const t = useTranslations('pdf');

    const { locale } = useAppLocale();
    const scheduleConfig = useAppStore(state => state.scheduleConfig);

    const sections: Section[] = useMemo(() => {
        return buildBOQSections(stepSaves, priceList);
    }, [stepSaves, priceList]);

    const categoriesWithTotals = useMemo(() => {
        return BOQ_CATEGORIES.map(cat => {
            const total = sections
                .filter(sec => cat.stepNos.includes(sec.stepNo))
                .reduce((sum, sec) => sum + sec.sectionTotal, 0);
            return { ...cat, total };
        });
    }, [sections]);

    const financialConfig = useAppStore(state => state.financialConfig);
    const projectMeta = useAppStore(state => state.projectMeta);

    const directTotal = sections.reduce((s, sec) => s + sec.sectionTotal, 0);

    // Calculate Schedule Weeks for Fixed Overhead
    const schedule = useMemo(() => {
        return buildSchedule(stepSaves, SCHEDULE_DATA, scheduleConfig);
    }, [stepSaves, scheduleConfig]);
    
    const scheduleWeeks = Math.ceil(schedule.totalDays / 7);
    const totalMonths = scheduleWeeks / 4;

    const contingencyAmt = directTotal * (financialConfig.contingencyPercent / 100);
    const fixedOverheadAmt = (financialConfig.fixedMonthlyOverhead || 0) * totalMonths;
    const overheadAmt = (directTotal * (financialConfig.overheadPercent / 100)) + fixedOverheadAmt;
    const profitAmt = directTotal * (financialConfig.profitPercent / 100);
    const subTotal = directTotal + contingencyAmt + overheadAmt + profitAmt;
    const taxAmt = subTotal * (financialConfig.taxPercent / 100);
    const grandTotal = subTotal + taxAmt;

    const [downloading, setDownloading] = useState(false);

    const handleDownloadPdf = useCallback(async () => {
        if (typeof window === 'undefined') return;
        setDownloading(true);
        const hide = message.loading('กำลังสร้าง PDF...', 0);
        try {
            const response = await fetch('/api/boq/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sections, categoriesWithTotals, financialConfig, projectMeta, directTotal, overheadAmt, profitAmt, subTotal, taxAmt, grandTotal }),
            });

            const contentType = response.headers.get('content-type') ?? '';
            if (!response.ok || !contentType.includes('application/pdf')) {
                let errorMessage = 'ไม่สามารถสร้าง PDF ได้';
                if (contentType.includes('application/json')) {
                    const errorBody = (await response.json()) as Record<string, string>;
                    errorMessage = errorBody.error ?? errorMessage;
                }
                throw new Error(errorMessage);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'BOQ-Summary.pdf';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            message.success('ดาวน์โหลด PDF สำเร็จ');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'ดาวน์โหลดไม่สำเร็จ';
            message.error(errorMessage);
        } finally {
            hide();
            setDownloading(false);
        }
    }, [sections, categoriesWithTotals, financialConfig, projectMeta, directTotal, overheadAmt, profitAmt, subTotal, taxAmt, grandTotal, message]);
    
    const handleDownloadExcel = useCallback(() => {
        exportBOQSummaryToExcel(sections, grandTotal);
        void message.success('Export Excel สำเร็จ — BOQ_Summary.xlsx');
    }, [sections, grandTotal, message]);
    // ── Earthwork Balance Check (Guardrail 2.4) ────────────
    const totalExcavation = 
        (stepSaves[6]?.res.quantities.excavation_volume?.qty ?? 0) + 
        (stepSaves[8]?.res.quantities.excavation_volume?.qty ?? 0);
    const totalBackfill = 
        (stepSaves[6]?.res.quantities.backfill_volume?.qty ?? 0) + 
        (stepSaves[8]?.res.quantities.backfill_volume?.qty ?? 0);
    const requiresImportedSoil = totalBackfill > totalExcavation;

    return (
        <div style={{ maxWidth: 1400, margin: '0 auto', fontFamily: "'Sarabun', sans-serif" }}>

            {/* ── Document Header (responsive: stacks on mobile) ─────────────── */}
            <div
                style={{
                    background: '#fff',
                    border: '1px solid #d9d9d9',
                    borderRadius: 10,
                    marginBottom: 12,
                    padding: '14px 16px',
                    boxShadow: '0 1px 4px rgba(0,0,0,.05)',
                }}
                className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center sm:px-7 sm:py-5 boq-summary-header"
            >
                <div className="w-full sm:w-auto border-b border-[#f0f0f0] sm:border-0 pb-3 sm:pb-0">
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 2 }}>
                        {t('reportTitle')}
                    </div>
                    <div style={{ fontSize: 13, color: '#595959', fontWeight: 400 }}>
                        {t('boqSummary')}
                    </div>
                </div>
                <div className="flex flex-col-reverse sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full sm:w-auto">

                    <Space wrap className="w-full sm:w-auto pt-1 sm:pt-0">
                        <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            onClick={handleDownloadPdf}
                            loading={downloading}
                            style={{
                                background: '#1a1a2e',
                                borderColor: '#1a1a2e',
                                fontWeight: 600,
                            }}
                        >
                            PDF
                        </Button>
                        <Button
                            icon={<FileExcelOutlined />}
                            onClick={handleDownloadExcel}
                            style={{
                                borderColor: '#217346',
                                color: '#217346',
                                fontWeight: 600,
                            }}
                        >
                            Excel
                        </Button>
                    </Space>
                    <div className="w-full sm:w-auto sm:border-l sm:border-[#f0f0f0] sm:pl-6 text-left sm:text-right">
                        <div style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>
                            {t('grandTotal')} (THB)
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#262626', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                            {fmtTotal(grandTotal)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Earthwork Guardrail Alert */}
            {requiresImportedSoil && (
                <div style={{ marginBottom: 12 }}>
                    <Alert
                        title="ตรวจพบความเสี่ยงงานดิน (Earthwork Balance)"
                        description={`ปริมาณดินถมกลับฐานรากและคาน (${fmtN(totalBackfill)} m³) มากกว่าปริมาณดินขุด (${fmtN(totalExcavation)} m³) โปรดตรวจสอบว่าได้เผื่องบประมาณค่า "ทรายถม" หรือ "ดินถม" ใน Step 1 ไว้เพียงพอหรือไม่`}
                        type="warning"
                        showIcon
                        style={{ borderRadius: 8, border: '1px solid #ffe58f' }}
                    />
                </div>
            )}

            {/* ── Mobile View (Cards) ── */}
            <div className="md:hidden flex flex-col gap-4">
                {sections.map((sec) => (
                    <div key={sec.stepNo} style={{ background: '#fff', borderRadius: 8, border: '1px solid #d9d9d9', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
                        <div style={{ background: '#f7f7f8', padding: '12px 14px', borderBottom: '1px solid #d9d9d9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <div style={{ background: '#1a1a2e', color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                    {String(sec.stepNo).padStart(2, '0')}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{locale === 'en' ? sec.titleEn : sec.title}</div>
                                    <div style={{ fontSize: 11, color: '#8c8c8c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{locale === 'th' ? sec.titleEn : ''}</div>
                                </div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a', flexShrink: 0, marginLeft: 12 }}>
                                {sec.hasData ? fmtTotal(sec.sectionTotal) : '–'}
                            </div>
                        </div>

                        <div>
                            {sec.hasData ? (
                                sec.rows.map((row, ri) => (
                                    <div key={row.key} style={{ padding: '12px 14px', borderBottom: ri === sec.rows.length - 1 ? 'none' : '1px solid #f5f5f5' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 }}>
                                            <div style={{ fontWeight: 600, fontSize: 13, color: '#262626', lineHeight: 1.3 }}>
                                                <Text type="secondary" style={{ fontSize: 11, marginRight: 4 }}>{row.key}</Text>
                                                {locale === 'en' && row.nameEn ? row.nameEn : row.name}
                                            </div>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1a1a', flexShrink: 0 }}>
                                                {fmtN(row.total)}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8c8c8c' }}>
                                            <span>{locale === 'en' ? 'Qty:' : 'จำนวน:'} <strong style={{ color: '#595959' }}>{fmtN(row.qty)} {locale === 'en' && row.uomEn ? row.uomEn : row.uom}</strong></span>
                                            <span>
                                                {locale === 'en' ? 'Mat' : 'วัสดุ'} {fmtN(row.matTotal)} <span style={{ margin: '0 4px', color: '#d9d9d9' }}>|</span> {locale === 'en' ? 'Lab' : 'แรง'} {fmtN(row.labTotal)}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ padding: '16px', fontSize: 12, color: '#8c8c8c', textAlign: 'center' }}>
                                    <Tag style={{ border: 'none', background: '#f5f5f5' }}>{t('noData')}</Tag>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                <div style={{ padding: '16px 14px', background: '#fff', borderRadius: 8, marginBottom: 8, border: '1px solid #d9d9d9', borderTop: '4px solid #d9d9d9' }}>
                    <div className="flex justify-between text-[13px] mb-2"><span className="text-gray-500">{locale === 'en' ? 'Direct Cost' : 'ต้นทุนทางตรง'}</span><span className="font-bold text-[#1a1a1a]">{fmtTotal(directTotal)}</span></div>
                    {financialConfig.contingencyPercent > 0 && <div className="flex justify-between text-[13px] mb-2"><span className="text-gray-500">{locale === 'en' ? `Contingency (${financialConfig.contingencyPercent}%)` : `เงินสำรอง (${financialConfig.contingencyPercent}%)`}</span><span>{fmtTotal(contingencyAmt)}</span></div>}
                    {financialConfig.overheadPercent > 0 && <div className="flex justify-between text-[13px] mb-2"><span className="text-gray-500">{locale === 'en' ? `Overhead (${financialConfig.overheadPercent}%)` : `ค่าดำเนินการ (${financialConfig.overheadPercent}%)`}</span><span>{fmtTotal(overheadAmt)}</span></div>}
                    {financialConfig.profitPercent > 0 && <div className="flex justify-between text-[13px] mb-2"><span className="text-gray-500">{locale === 'en' ? `Profit (${financialConfig.profitPercent}%)` : `กำไร (${financialConfig.profitPercent}%)`}</span><span>{fmtTotal(profitAmt)}</span></div>}
                    {financialConfig.taxPercent > 0 && <div className="flex justify-between text-[13px] mb-2"><span className="text-gray-500">{locale === 'en' ? `VAT (${financialConfig.taxPercent}%)` : `ภาษีมูลค่าเพิ่ม (${financialConfig.taxPercent}%)`}</span><span>{fmtTotal(taxAmt)}</span></div>}
                </div>
                <div style={{ background: '#1a1a2e', color: '#fff', padding: '16px 20px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{t('grandTotal')}</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 20 }}>
                        {fmtTotal(grandTotal)}
                    </div>
                </div>
            </div>

            {/* ── Desktop Table ── */}
            <div className="hidden md:block table-scroll-wrapper" style={{
                background: '#fff',
                border: '1px solid #d9d9d9',
                borderRadius: 10,
                overflowX: 'auto',
                boxShadow: '0 1px 4px rgba(0,0,0,.05)',
            }}>
                <div style={{ minWidth: 860 }}>

                    {/* Column headers */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: GRID,
                        background: '#1a1a2e',
                    }}>
                        {[
                            { label: '', align: 'center' as const },
                            { label: t('colNo'), align: 'center' as const },
                            { label: t('colDesc'), align: 'left' as const },
                            { label: t('colQty'), align: 'right' as const },
                            { label: t('colUnit'), align: 'center' as const },
                            { label: t('colMatUnit'), align: 'right' as const },
                            { label: t('colMatTotal'), align: 'right' as const },
                            { label: t('colLabUnit'), align: 'right' as const },
                            { label: t('colLabTotal'), align: 'right' as const },
                            { label: t('colTotal'), align: 'right' as const },
                        ].map((col, i) => (
                            <div key={i} style={{ ...TH, textAlign: col.align, borderRight: i < 9 ? '1px solid rgba(255,255,255,0.1)' : 'none', whiteSpace: 'pre-line' }}>
                                {col.label}
                            </div>
                        ))}
                    </div>

                    {/* Sections */}
                    {sections.map((sec) => (
                        <div key={sec.stepNo}>

                            {/* Section header band */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: GRID,
                                background: '#f7f7f8',
                                borderTop: '1px solid #d9d9d9',
                                borderBottom: '1px solid #d9d9d9',
                            }}>
                                {/* Step indicator */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: '#1a1a2e', color: '#fff',
                                    fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                                }}>
                                    {String(sec.stepNo).padStart(2, '0')}
                                </div>

                                {/* No. */}
                                <div style={{ ...TD('center'), background: 'transparent', color: '#595959', fontWeight: 700 }}>
                                    {sec.stepNo}
                                </div>

                                {/* Title */}
                                <div style={{ ...TD('left'), background: 'transparent', borderRight: '1px solid #e8e8e8' }}>
                                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1a1a1a' }}>{locale === 'en' ? sec.titleEn : sec.title}</span>
                                    {locale === 'th' && (
                                        <span style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 8 }}>{sec.titleEn}</span>
                                    )}
                                    {!sec.hasData && (
                                        <Tag style={{ marginLeft: 10, fontSize: 11, color: '#8c8c8c', borderColor: '#d9d9d9', background: '#fff' }}>
                                            {t('noData')}
                                        </Tag>
                                    )}
                                </div>

                                {/* Empty cells */}
                                {[0, 1, 2, 3, 4, 5].map(i => (
                                    <div key={i} style={{ borderRight: i < 5 ? '1px solid #e8e8e8' : 'none' }} />
                                ))}

                                {/* Section total */}
                                <div style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#1a1a1a', fontVariantNumeric: 'tabular-nums' }}>
                                    {sec.hasData ? fmtTotal(sec.sectionTotal) : '–'}
                                </div>
                            </div>

                            {/* Child rows */}
                            {sec.hasData ? (
                                sec.rows.map((row, ri) => (
                                    <div
                                        key={row.key}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: GRID,
                                            background: ri % 2 === 0 ? '#ffffff' : '#fafafa',
                                            borderBottom: '1px solid #f0f0f0',
                                        }}
                                    >
                                        {/* Left indent line */}
                                        <div style={{ borderLeft: '3px solid #d9d9d9', marginLeft: 24 }} />

                                        {/* Sub-no */}
                                        <div style={{ ...TD('center', true), fontSize: 12 }}>{row.key}</div>

                                        {/* Name */}
                                        <div style={{ ...TD('left'), fontSize: 13, color: '#262626' }}>{locale === 'en' && row.nameEn ? row.nameEn : row.name}</div>

                                        {/* Qty */}
                                        <div style={{ ...TD('right'), fontWeight: 600 }}>{fmtN(row.qty)}</div>

                                        {/* UOM */}
                                        <div style={{ ...TD('center', true), fontSize: 12 }}>{locale === 'en' && row.uomEn ? row.uomEn : row.uom}</div>

                                        {/* Mat unit */}
                                        <div style={{ ...TD('right', true), fontSize: 12 }}>{fmtN(row.matUnit)}</div>

                                        {/* Mat total */}
                                        <div style={{ ...TD('right') }}>{fmtN(row.matTotal)}</div>

                                        {/* Lab unit */}
                                        <div style={{ ...TD('right', true), fontSize: 12 }}>{fmtN(row.labUnit)}</div>

                                        {/* Lab total */}
                                        <div style={{ ...TD('right') }}>{fmtN(row.labTotal)}</div>

                                        {/* Row total */}
                                        <div style={{ padding: '9px 12px', fontSize: 13, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#1a1a1a', borderLeft: '1px solid #e8e8e8' }}>
                                            {fmtN(row.total)}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                /* Empty placeholder */
                                <div style={{ display: 'grid', gridTemplateColumns: GRID, background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
                                    <div />
                                    <div />
                                    <div style={{ padding: '8px 12px', gridColumn: '3 / -1', borderLeft: '3px solid #f0f0f0' }}>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            {t('noDataHint', { stepNo: sec.stepNo })}
                                        </Text>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Direct Cost Footer */}
                    <div style={{ display: 'grid', gridTemplateColumns: GRID, background: '#fafafa', borderTop: '2px solid #d9d9d9' }}>
                        <div /><div /><div style={{ padding: '10px 12px', color: '#595959', fontWeight: 600, fontSize: 14, textAlign: 'right' }}>{locale === 'en' ? 'Direct Cost' : 'รวมต้นทุนทางตรง'}</div>
                        {[0, 1, 2, 3, 4, 5].map(i => <div key={i} />)}
                        <div style={{ padding: '10px 12px', color: '#1a1a1a', fontWeight: 700, fontSize: 14, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtTotal(directTotal)}</div>
                    </div>

                    {/* Contingency */}
                    {financialConfig.contingencyPercent > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: GRID, background: '#fff' }}>
                            <div /><div /><div style={{ padding: '8px 12px', color: '#8c8c8c', fontSize: 13, textAlign: 'right' }}>{locale === 'en' ? `Contingency (${financialConfig.contingencyPercent}%)` : `เงินสำรอง (${financialConfig.contingencyPercent}%)`}</div>
                            {[0, 1, 2, 3, 4, 5].map(i => <div key={i} />)}
                            <div style={{ padding: '8px 12px', color: '#262626', fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtTotal(contingencyAmt)}</div>
                        </div>
                    )}

                    {/* Overhead */}
                    {financialConfig.overheadPercent > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: GRID, background: '#fff' }}>
                            <div /><div /><div style={{ padding: '8px 12px', color: '#8c8c8c', fontSize: 13, textAlign: 'right' }}>{locale === 'en' ? `Overhead (${financialConfig.overheadPercent}%)` : `ค่าดำเนินการ (${financialConfig.overheadPercent}%)`}</div>
                            {[0, 1, 2, 3, 4, 5].map(i => <div key={i} />)}
                            <div style={{ padding: '8px 12px', color: '#262626', fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtTotal(overheadAmt)}</div>
                        </div>
                    )}

                    {/* Profit */}
                    {financialConfig.profitPercent > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: GRID, background: '#fff' }}>
                            <div /><div /><div style={{ padding: '8px 12px', color: '#8c8c8c', fontSize: 13, textAlign: 'right' }}>{locale === 'en' ? `Profit (${financialConfig.profitPercent}%)` : `กำไร (${financialConfig.profitPercent}%)`}</div>
                            {[0, 1, 2, 3, 4, 5].map(i => <div key={i} />)}
                            <div style={{ padding: '8px 12px', color: '#262626', fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtTotal(profitAmt)}</div>
                        </div>
                    )}

                    {/* VAT */}
                    {financialConfig.taxPercent > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: GRID, background: '#fff' }}>
                            <div /><div /><div style={{ padding: '8px 12px', color: '#8c8c8c', fontSize: 13, textAlign: 'right' }}>{locale === 'en' ? `VAT (${financialConfig.taxPercent}%)` : `ภาษีมูลค่าเพิ่ม (${financialConfig.taxPercent}%)`}</div>
                            {[0, 1, 2, 3, 4, 5].map(i => <div key={i} />)}
                            <div style={{ padding: '8px 12px', color: '#262626', fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtTotal(taxAmt)}</div>
                        </div>
                    )}

                    {/* Grand Total Footer */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: GRID,
                        background: '#1a1a2e',
                        borderTop: '2px solid #1a1a2e',
                    }}>
                        <div />
                        <div />
                        <div style={{ padding: '13px 12px', color: '#ffffff', fontWeight: 700, fontSize: 14, textAlign: 'right', letterSpacing: 0.3 }}>
                            {t('grandTotal')}
                        </div>
                        {[0, 1, 2, 3, 4, 5].map(i => <div key={i} />)}
                        <div style={{ padding: '13px 12px', color: '#ffffff', fontWeight: 800, fontSize: 15, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {fmtTotal(grandTotal)}
                        </div>
                    </div>

                </div>
            </div>

            {/* ── Footer note ─────────────────────────────────────────────── */}
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                    {t('footerNote1')}
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                    {t('footerNote2')}
                </Text>
            </div>

        </div>
    );
};
