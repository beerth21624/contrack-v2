'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAppLocale } from '@/i18n/LocaleProvider';
import type { ProjectMeta, FinancialConfig } from '@/lib/store';

// ── Types (mirrored from BOQSummaryTable) ─────────────────────────────────────

interface SectionRow {
    key: string;
    code: string;
    name: string;
    nameEn?: string;
    qty: number | null;
    uom: string;
    uomEn?: string;
    matUnit: number | null;
    matTotal: number | null;
    labUnit: number | null;
    labTotal: number | null;
    total: number | null;
}

interface Section {
    stepNo: number;
    title: string;
    titleEn: string;
    hasData: boolean;
    rows: SectionRow[];
    sectionTotal: number;
}

// ── Formatter ─────────────────────────────────────────────────────────────────

const fmtN = (v: number | null) =>
    v === null ? '–' : v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Styles ────────────────────────────────────────────────────────────────────

const ACCENT = '#1a1a2e';
const ACCENT_LIGHT = '#f7f7f8';
const BORDER = '#d9d9d9';

const thStyle: React.CSSProperties = {
    padding: '8px 6px',
    fontSize: 9,
    fontWeight: 700,
    color: '#ffffff',
    background: ACCENT,
    textAlign: 'right',
    borderRight: '1px solid rgba(255,255,255,0.15)',
    whiteSpace: 'nowrap',
    lineHeight: 1.3,
};

const tdStyle = (align: 'left' | 'right' | 'center' = 'right', muted = false): React.CSSProperties => ({
    padding: '5px 6px',
    fontSize: 10,
    color: muted ? '#999' : '#262626',
    textAlign: align,
    borderRight: `1px solid ${BORDER}`,
    borderBottom: `1px solid #f0f0f0`,
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
});

// ── PDF Page Component ────────────────────────────────────────────────────────

export default function BOQPdfPage() {
    const t = useTranslations('pdf');
    const { locale } = useAppLocale();

    const [pdfData, setPdfData] = useState<{
        sections: Section[],
        projectMeta: ProjectMeta,
        financialConfig: FinancialConfig,
        directTotal: number,
        overheadAmt: number,
        profitAmt: number,
        taxAmt: number,
        grandTotal: number,
        ready: boolean
    }>({
        sections: [],
        projectMeta: { projectName: '', clientName: '', location: '', documentDate: '' },
        financialConfig: { overheadPercent: 0, profitPercent: 0, taxPercent: 0, fixedMonthlyOverhead: 0, contingencyPercent: 0 },
        directTotal: 0,
        overheadAmt: 0,
        profitAmt: 0,
        taxAmt: 0,
        grandTotal: 0,
        ready: false
    });

    useEffect(() => {
        try {
            const raw = localStorage.getItem('boq-pdf-data');
            if (raw) {
                const data = JSON.parse(raw) as {
                    sections?: Section[];
                    projectMeta?: ProjectMeta;
                    financialConfig?: FinancialConfig;
                    directTotal?: number;
                    overheadAmt?: number;
                    profitAmt?: number;
                    taxAmt?: number;
                    grandTotal?: number;
                };
                void Promise.resolve().then(() => {
                    setPdfData({
                        sections: data.sections ?? [],
                        projectMeta: data.projectMeta ?? { projectName: '', clientName: '', location: '', documentDate: '' },
                        financialConfig: data.financialConfig ?? { overheadPercent: 0, profitPercent: 0, taxPercent: 0, fixedMonthlyOverhead: 0, contingencyPercent: 0 },
                        directTotal: data.directTotal ?? 0,
                        overheadAmt: data.overheadAmt ?? 0,
                        profitAmt: data.profitAmt ?? 0,
                        taxAmt: data.taxAmt ?? 0,
                        grandTotal: data.grandTotal ?? 0,
                        ready: true
                    });
                });
                return;
            }
        } catch (e) {
            console.error('Failed to load BOQ data:', e);
        }
        void Promise.resolve().then(() => {
            setPdfData(prev => ({ ...prev, ready: true }));
        });
    }, []);

    if (!pdfData.ready) {
        return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Sarabun, sans-serif' }}>{t('loading')}</div>;
    }

    const { sections, projectMeta, financialConfig, directTotal, overheadAmt, profitAmt, taxAmt, grandTotal } = pdfData;

    const today = new Date().toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700;800&display=swap');
                @page {
                    margin: 8mm 10mm;
                    size: A4 landscape;
                }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { background: #fff; }
                .section-band { page-break-inside: avoid; }
                .page-break-avoid { page-break-inside: avoid; break-inside: avoid; }
                @media print {
                    .section-band { page-break-inside: avoid !important; }
                }
            `}</style>

            <div style={{
                fontFamily: "'Sarabun', sans-serif",
                color: '#1a1a1a',
                background: '#ffffff',
                lineHeight: 1.4,
                maxWidth: '100%',
            }}>
                {/* ── Header ─────────────────────────────────────────────────── */}
                <div style={{
                    padding: '24px 32px 16px',
                    borderBottom: `3px solid ${ACCENT}`,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT, letterSpacing: 1, marginBottom: 4 }}>
                                {projectMeta.projectName || 'Contrack BOQ System'}
                            </div>
                            <div style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>
                                <strong>{locale === 'en' ? 'Client:' : 'ลูกค้า:'}</strong> {projectMeta.clientName || '-'}
                            </div>
                            <div style={{ fontSize: 10, color: '#666' }}>
                                <strong>{locale === 'en' ? 'Location:' : 'สถานที่:'}</strong> {projectMeta.location || '-'}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{
                                fontSize: 28, fontWeight: 900, color: ACCENT,
                                lineHeight: 1, marginBottom: 4,
                            }}>
                                {t('reportTitle')}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b', letterSpacing: 2, marginBottom: 8 }}>
                                {t('boqSummary')}
                            </div>
                            <div style={{
                                display: 'inline-grid', gridTemplateColumns: 'auto auto',
                                gap: '2px 10px', fontSize: 10, textAlign: 'left',
                                background: '#f1f5f9', padding: '8px 12px',
                                borderRadius: 4, border: '1px solid #e2e8f0',
                            }}>
                                <div style={{ fontWeight: 700, color: ACCENT }}>{t('printDate')}</div>
                                <div>{projectMeta.documentDate || today}</div>
                            </div>
                        </div>
                    </div>
                </div>


                {/* ── Table (Detailed View) ──────────────────────────────────────────────────── */}
                <div style={{ padding: '0 32px 24px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 8, letterSpacing: 0.5 }}>
                        {locale === 'en' ? 'Detailed BOQ' : 'รายละเอียดงบประมาณ (Detailed BOQ)'}
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                        <thead>
                            <tr>
                                {[
                                    { label: '', w: '36px', align: 'center' as const },
                                    { label: t('colNo'), w: '40px', align: 'center' as const },
                                    { label: t('colDesc'), w: 'auto', align: 'left' as const },
                                    { label: t('colQty'), w: '70px', align: 'right' as const },
                                    { label: t('colUnit'), w: '45px', align: 'center' as const },
                                    { label: t('colMatUnit'), w: '80px', align: 'right' as const },
                                    { label: t('colMatTotal'), w: '90px', align: 'right' as const },
                                    { label: t('colLabUnit'), w: '80px', align: 'right' as const },
                                    { label: t('colLabTotal'), w: '90px', align: 'right' as const },
                                    { label: t('colTotal'), w: '100px', align: 'right' as const },
                                ].map((col, i) => (
                                    <th key={i} style={{
                                        ...thStyle,
                                        textAlign: col.align,
                                        width: col.w,
                                        whiteSpace: 'pre-line',
                                        borderRight: i < 9 ? '1px solid rgba(255,255,255,0.15)' : 'none',
                                    }}>
                                        {col.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sections.map((sec) => (
                                <React.Fragment key={sec.stepNo}>
                                    {/* Section header */}
                                    <tr className="section-band" style={{ background: ACCENT_LIGHT }}>
                                        <td style={{
                                            background: ACCENT, color: '#fff',
                                            textAlign: 'center', fontSize: 9, fontWeight: 700,
                                            padding: '6px 4px',
                                        }}>
                                            {String(sec.stepNo).padStart(2, '0')}
                                        </td>
                                        <td style={{ ...tdStyle('center'), fontWeight: 700, background: 'transparent' }}>
                                            {sec.stepNo}
                                        </td>
                                        <td colSpan={7} style={{ ...tdStyle('left'), background: 'transparent', borderRight: 'none' }}>
                                            <span style={{ fontWeight: 700, fontSize: 10 }}>{locale === 'en' ? sec.titleEn : sec.title}</span>
                                            {locale === 'th' && (
                                                <span style={{ fontSize: 9, color: '#888', marginLeft: 6 }}>{sec.titleEn}</span>
                                            )}
                                            {!sec.hasData && (
                                                <span style={{
                                                    marginLeft: 8, fontSize: 8, color: '#aaa',
                                                    border: '1px solid #ddd', borderRadius: 3,
                                                    padding: '1px 6px', background: '#fff',
                                                }}>
                                                    {t('noData')}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{
                                            padding: '6px 8px', textAlign: 'right',
                                            fontWeight: 700, fontSize: 10, color: '#1a1a1a',
                                            fontVariantNumeric: 'tabular-nums',
                                        }}>
                                            {sec.hasData ? fmtN(sec.sectionTotal) : '–'}
                                        </td>
                                    </tr>

                                    {/* Detail rows */}
                                    {sec.hasData ? (
                                        sec.rows.map((row, ri) => (
                                            <tr key={row.key} className="page-break-avoid" style={{ background: ri % 2 === 0 ? '#fff' : '#fafafa' }}>
                                                <td style={{ borderLeft: '3px solid #e0e0e0', marginLeft: 16 }} />
                                                <td style={tdStyle('center', true)}>{row.key}</td>
                                                <td style={tdStyle('left')}>{locale === 'en' && row.nameEn ? row.nameEn : row.name}</td>
                                                <td style={{ ...tdStyle('right'), fontWeight: 600 }}>{fmtN(row.qty)}</td>
                                                <td style={tdStyle('center', true)}>{locale === 'en' && row.uomEn ? row.uomEn : row.uom}</td>
                                                <td style={tdStyle('right', true)}>{fmtN(row.matUnit)}</td>
                                                <td style={tdStyle('right')}>{fmtN(row.matTotal)}</td>
                                                <td style={tdStyle('right', true)}>{fmtN(row.labUnit)}</td>
                                                <td style={tdStyle('right')}>{fmtN(row.labTotal)}</td>
                                                <td style={{
                                                    padding: '5px 8px', textAlign: 'right',
                                                    fontWeight: 700, fontSize: 10, color: '#1a1a1a',
                                                    fontVariantNumeric: 'tabular-nums',
                                                    borderLeft: '1px solid #e8e8e8',
                                                    borderBottom: '1px solid #f0f0f0',
                                                }}>
                                                    {fmtN(row.total)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td />
                                            <td />
                                            <td colSpan={8} style={{
                                                padding: '5px 10px', fontSize: 9, color: '#bbb',
                                                borderBottom: '1px solid #f0f0f0',
                                            }}>
                                                {t('noDataHint', { stepNo: sec.stepNo })}
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}

                            {/* Direct Cost Footer */}
                            <tr style={{ background: '#f8fafc' }}>
                                <td style={{ border: 'none' }} /><td style={{ border: 'none' }} />
                                <td colSpan={7} style={{ padding: '8px 8px', color: '#475569', fontWeight: 600, fontSize: 11, textAlign: 'right', borderBottom: '1px solid #cbd5e1' }}>
                                    {locale === 'en' ? 'Direct Cost' : 'รวมต้นทุนทางตรง'}
                                </td>
                                <td style={{ padding: '8px 8px', color: '#0f172a', fontWeight: 700, fontSize: 11, textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #cbd5e1' }}>
                                    {fmtN(directTotal)}
                                </td>
                            </tr>

                            {/* Contingency */}
                            {financialConfig.contingencyPercent > 0 && (
                                <tr>
                                    <td style={{ border: 'none' }} /><td style={{ border: 'none' }} />
                                    <td colSpan={7} style={{ padding: '6px 8px', color: '#64748b', fontSize: 10, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
                                        {locale === 'en' ? `Contingency (${financialConfig.contingencyPercent}%)` : `เงินสำรอง (${financialConfig.contingencyPercent}%)`}
                                    </td>
                                    <td style={{ padding: '6px 8px', color: '#0f172a', fontSize: 10, textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e2e8f0' }}>
                                        {fmtN(directTotal * (financialConfig.contingencyPercent / 100))}
                                    </td>
                                </tr>
                            )}
                            
                            {/* Overhead */}
                            {financialConfig.overheadPercent > 0 && (
                                <tr>
                                    <td style={{ border: 'none' }} /><td style={{ border: 'none' }} />
                                    <td colSpan={7} style={{ padding: '6px 8px', color: '#64748b', fontSize: 10, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
                                        {locale === 'en' ? `Overhead (${financialConfig.overheadPercent}%)` : `ค่าดำเนินการ (${financialConfig.overheadPercent}%)`}
                                    </td>
                                    <td style={{ padding: '6px 8px', color: '#0f172a', fontSize: 10, textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e2e8f0' }}>
                                        {fmtN(overheadAmt)}
                                    </td>
                                </tr>
                            )}

                            {/* Profit */}
                            {financialConfig.profitPercent > 0 && (
                                <tr>
                                    <td style={{ border: 'none' }} /><td style={{ border: 'none' }} />
                                    <td colSpan={7} style={{ padding: '6px 8px', color: '#64748b', fontSize: 10, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
                                        {locale === 'en' ? `Profit (${financialConfig.profitPercent}%)` : `กำไร (${financialConfig.profitPercent}%)`}
                                    </td>
                                    <td style={{ padding: '6px 8px', color: '#0f172a', fontSize: 10, textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e2e8f0' }}>
                                        {fmtN(profitAmt)}
                                    </td>
                                </tr>
                            )}

                            {/* VAT */}
                            {financialConfig.taxPercent > 0 && (
                                <tr>
                                    <td style={{ border: 'none' }} /><td style={{ border: 'none' }} />
                                    <td colSpan={7} style={{ padding: '6px 8px', color: '#64748b', fontSize: 10, textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
                                        {locale === 'en' ? `VAT (${financialConfig.taxPercent}%)` : `ภาษีมูลค่าเพิ่ม (${financialConfig.taxPercent}%)`}
                                    </td>
                                    <td style={{ padding: '6px 8px', color: '#0f172a', fontSize: 10, textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid #e2e8f0' }}>
                                        {fmtN(taxAmt)}
                                    </td>
                                </tr>
                            )}

                            {/* Grand total footer */}
                            <tr style={{ background: ACCENT }}>
                                <td style={{ border: 'none' }} />
                                <td style={{ border: 'none' }} />
                                <td colSpan={7} style={{
                                    padding: '10px 8px', color: '#fff',
                                    fontWeight: 700, fontSize: 12, textAlign: 'right', letterSpacing: 0.3,
                                }}>
                                    {t('grandTotal')}
                                </td>
                                <td style={{
                                    padding: '10px 8px', color: '#fff',
                                    fontWeight: 800, fontSize: 13, textAlign: 'right',
                                    fontVariantNumeric: 'tabular-nums',
                                }}>
                                    {fmtN(grandTotal)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* ── Signature Section ───────────────────────────────────────── */}
                <div style={{
                    padding: '24px 32px 0',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid',
                }}>
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                        gap: 24, marginTop: 16,
                    }}>
                        {[
                            { label: t('preparedBy') },
                            { label: t('verifiedBy') },
                            { label: t('authorizedBy') },
                        ].map((item, i) => (
                            <div key={i} style={{ textAlign: 'center' }}>
                                <div style={{ marginBottom: 40, borderBottom: '1px dotted #aaa', height: 40 }} />
                                <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT }}>{item.label}</div>
                                <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>
                                    {t('dateField')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Footer ─────────────────────────────────────────────────── */}
                <div style={{
                    padding: '16px 32px',
                    borderTop: '1px solid #e2e8f0',
                    marginTop: 16,
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 8, color: '#aaa',
                }}>
                    <div>{t('footerNote1')}</div>
                    <div>{t('footerNote2')}</div>
                </div>
            </div>
        </>
    );
}
