'use client';

import { useEffect, useState, Fragment } from 'react';
import { TEAM_COLORS } from '@/data/schedule-data';

interface ManDayRow {
    key: number;
    stepId: number;
    title: string;
    titleEn: string;
    team: string;
    teamEn?: string;
    skilled: number;
    laborers: number;
    days: number;
    manDays: number;
    hasData: boolean;
    boqItemCount: number;
}

interface PrintPayload {
    rows: ManDayRow[];
    grouped: Record<string, ManDayRow[]>;
    totalManDays: number;
    totalSkilledDays: number;
    totalLaborerDays: number;
    completedCount: number;
    locale: string;
}

const ACCENT = '#1a1a2e';

export default function ManDayPdfPage() {
    const [payload, setPayload] = useState<PrintPayload | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        try {
            const raw = localStorage.getItem('manday-pdf-data');
            if (raw) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setPayload(JSON.parse(raw) as PrintPayload);
            }
        } catch (e) {
            console.error(e);
        }
        setReady(true);
    }, []);

    if (!ready) {
        return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Sarabun, sans-serif' }}>กำลังโหลดข้อมูล...</div>;
    }

    if (!payload) {
        return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Sarabun, sans-serif' }}>ไม่พบข้อมูล Man-Day (No Man-Day Data)</div>;
    }

    const { grouped, totalManDays, totalSkilledDays, totalLaborerDays, completedCount, locale } = payload;
    const today = new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700;800&display=swap');
                @page { margin: 10mm 12mm; size: A4 portrait; }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { background: #fff; }
                .table-row { page-break-inside: avoid; }
            `}</style>
            
            <div style={{ fontFamily: "'Sarabun', sans-serif", color: '#1a1a1a', background: '#ffffff', lineHeight: 1.4, width: '100%', maxWidth: 800, margin: '0 auto' }}>
                {/* ── Header ─────────────────────────────────────────────────── */}
                <div style={{ padding: '0 0 16px', borderBottom: `3px solid ${ACCENT}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT, letterSpacing: 1, marginBottom: 4 }}>
                                Contrack BOQ System
                            </div>
                            <div style={{ fontSize: 10, color: '#666' }}>{locale === 'en' ? 'BOQ System — Construction Man-Day Planning' : 'ระบบประมาณราคา BOQ — การประเมินกำลังคน Man-Day'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 28, fontWeight: 900, color: ACCENT, lineHeight: 1, marginBottom: 4 }}>{locale === 'en' ? 'Man-Day Report' : 'รายงานการใช้กำลังคน'}</div>
                            <div style={{ display: 'inline-grid', gridTemplateColumns: 'auto auto', gap: '2px 10px', fontSize: 10, textAlign: 'left', background: '#f1f5f9', padding: '6px 10px', borderRadius: 4, border: '1px solid #e2e8f0', marginTop: 8 }}>
                                <div style={{ fontWeight: 700, color: ACCENT }}>{locale === 'en' ? 'Print Date:' : 'วันที่พิมพ์:'}</div>
                                <div>{today}</div>
                                <div style={{ fontWeight: 700, color: ACCENT }}>{locale === 'en' ? 'Status:' : 'สถานะข้อมูล:'}</div>
                                <div>{completedCount} / 34 {locale === 'en' ? 'Steps Evaluated' : 'ขั้นตอนที่ประเมินแล้ว'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Summary Cards ───────────────────────────────────────────── */}
                <div style={{ display: 'flex', gap: 12, margin: '20px 0' }}>
                    <div style={{ flex: 1, padding: 12, background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: 6, textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#595959', marginBottom: 4 }}>{locale === 'en' ? 'Skilled Worker Needs' : 'ความต้องการช่างฝีมือ'}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#1890ff' }}>{totalSkilledDays} <span style={{ fontSize: 12, fontWeight: 400 }}>{locale === 'en' ? 'Days' : 'วัน'}</span></div>
                    </div>
                    <div style={{ flex: 1, padding: 12, background: '#f9f0ff', border: '1px solid #d3adf7', borderRadius: 6, textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#595959', marginBottom: 4 }}>{locale === 'en' ? 'Laborer Needs' : 'ความต้องการคนงานทั่วไป'}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#722ed1' }}>{totalLaborerDays} <span style={{ fontSize: 12, fontWeight: 400 }}>{locale === 'en' ? 'Days' : 'วัน'}</span></div>
                    </div>
                    <div style={{ flex: 1, padding: 12, background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#595959', marginBottom: 4 }}>{locale === 'en' ? 'Total Man-Day' : 'รวม Man-Day ทั้งหมด'}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#fa8c16' }}>{totalManDays} <span style={{ fontSize: 12, fontWeight: 400 }}>{locale === 'en' ? 'Man-Day' : 'แมนเดย์'}</span></div>
                    </div>
                </div>

                {/* ── Table Combine ──────────────────────────────────────────── */}
                <div style={{ width: '100%', marginBottom: 30 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                        <thead>
                            <tr style={{ background: ACCENT, color: '#fff' }}>
                                <th style={{ padding: '8px 6px', textAlign: 'center', width: 40 }}>#</th>
                                <th style={{ padding: '8px 6px', textAlign: 'left' }}>{locale === 'en' ? 'Task Description' : 'ขั้นตอนการทำงาน'}</th>
                                <th style={{ padding: '8px 6px', textAlign: 'center', width: 70 }}>{locale === 'en' ? 'Skilled' : 'ช่างฝีมือ'}</th>
                                <th style={{ padding: '8px 6px', textAlign: 'center', width: 70 }}>{locale === 'en' ? 'Laborer' : 'คนงาน'}</th>
                                <th style={{ padding: '8px 6px', textAlign: 'center', width: 60 }}>{locale === 'en' ? 'Duration' : 'ระยะเวลา'}</th>
                                <th style={{ padding: '8px 6px', textAlign: 'center', width: 70 }}>Man-Day</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(grouped)
                                .filter(([_, items]) => items.length > 0)
                                .map(([team, items]) => {
                                    const activeItems = items.filter(r => r.hasData);
                                    if (activeItems.length === 0) return null;
                                    const teamManDays = activeItems.reduce((s, r) => s + r.manDays, 0);
                                    const baseColor = TEAM_COLORS[team] ?? '#888';
                                    const teamLabel = locale === 'en' && activeItems[0]?.teamEn ? activeItems[0].teamEn : team;

                                    return (
                                        <Fragment key={team}>
                                            {/* Team Header */}
                                            <tr style={{ background: '#f5f5f5', borderTop: '2px solid #d9d9d9', borderBottom: '1px solid #d9d9d9' }}>
                                                <td colSpan={2} style={{ padding: '8px 10px', fontWeight: 700, color: '#262626' }}>
                                                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: baseColor, marginRight: 8 }} />
                                                    {teamLabel}
                                                </td>
                                                <td colSpan={3} style={{ textAlign: 'right', padding: '8px 10px', fontSize: 9, color: '#8c8c8c' }}>
                                                    {activeItems.length} {locale === 'en' ? 'Tasks' : 'รายการ'}
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 700, color: '#fa8c16', background: '#fffbe6' }}>
                                                    {teamManDays}
                                                </td>
                                            </tr>

                                            {/* Team Items */}
                                            {activeItems.map((row, idx) => (
                                                <tr key={row.stepId} className="table-row" style={{ borderBottom: '1px solid #f0f0f0', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: '#8c8c8c' }}>
                                                        {String(row.stepId).padStart(2, '0')}
                                                    </td>
                                                    <td style={{ padding: '8px 6px' }}>
                                                        <div style={{ fontWeight: 600, color: '#262626' }}>{locale === 'en' ? row.titleEn : row.title}</div>
                                                        {locale === 'th' && <div style={{ fontSize: 9, color: '#8c8c8c' }}>{row.titleEn}</div>}
                                                    </td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', color: '#1890ff', fontWeight: 600 }}>{row.skilled || '-'}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', color: '#722ed1', fontWeight: 600 }}>{row.laborers || '-'}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', color: '#595959', fontWeight: 600 }}>{row.days}</td>
                                                    <td style={{ padding: '8px 6px', textAlign: 'center', color: '#fa8c16', fontWeight: 700 }}>{row.manDays}</td>
                                                </tr>
                                            ))}
                                        </Fragment>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>

                {/* ── Signatures ────────────────────────────────────────────── */}
                <div className="table-row" style={{ marginTop: 40, pageBreakInside: 'avoid' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, padding: '0 16px' }}>
                        {[
                            locale === 'en' ? 'Prepared By' : 'ผู้จัดทำ / Prepared By',
                            locale === 'en' ? 'Verified By' : 'ผู้ตรวจสอบ / Verified By',
                            locale === 'en' ? 'Authorized By' : 'ผู้อนุมัติ / Authorized By'
                        ].map((label, i) => (
                            <div key={i} style={{ textAlign: 'center' }}>
                                <div style={{ marginBottom: 30, borderBottom: '1px dotted #aaa', height: 30 }} />
                                <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>{label}</div>
                                <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{locale === 'en' ? 'Date: ........................' : 'วันที่ / Date: ........................'}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Footer ─────────────────────────────────────────────────── */}
                <div style={{
                    padding: '16px 0',
                    borderTop: '1px solid #e2e8f0',
                    marginTop: 40,
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 9, color: '#aaa',
                }}>
                    <div>{locale === 'en' ? '* This is an estimated Man-Day plan subject to on-site adjustments.' : '* ข้อมูลนี้เป็นเพียงการประเมิน Man-Day เบื้องต้น อาจมีการปรับเปลี่ยนหน้างาน'}</div>
                    <div>{locale === 'en' ? 'Generated by Contrack BOQ System' : 'เอกสารนี้สร้างโดยระบบ Contrack BOQ System'}</div>
                </div>
            </div>
        </>
    );
}
