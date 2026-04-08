'use client';

import { useEffect, useState } from 'react';
import { TEAM_COLORS } from '@/data/schedule-data';
import type { ScheduleItem } from '@/lib/schedule-engine';
import dayjs from 'dayjs';

interface PrintPayload {
    items: ScheduleItem[];
    totalDays: number;
    criticalSetArr: number[];
    startDateIso: string;
    locale?: string;
}

const ACCENT = '#1a1a2e';

const BORDER = '#e8e8e8';

export default function SchedulePdfPage() {
    const [state, setState] = useState<{
        payload: PrintPayload | null;
        ready: boolean;
    }>({
        payload: null,
        ready: false,
    });

    useEffect(() => {
        try {
            const raw = localStorage.getItem('schedule-pdf-data');
            if (raw) {
                const data = JSON.parse(raw) as PrintPayload;
                void Promise.resolve().then(() => {
                    setState({
                        payload: data,
                        ready: true,
                    });
                });
                return;
            }
        } catch (e) {
            console.error(e);
        }
        void Promise.resolve().then(() => {
            setState(prev => ({ ...prev, ready: true }));
        });
    }, []);

    if (!state.ready) {
        return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Sarabun, sans-serif' }}>กำลังโหลดข้อมูล...</div>;
    }

    const { payload } = state;

    if (!payload) {
        return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Sarabun, sans-serif' }}>ไม่พบข้อมูลแผยงาน (No Schedule Data)</div>;
    }

    const { items, totalDays, criticalSetArr, startDateIso, locale = 'th' } = payload;
    const criticalSet = new Set(criticalSetArr);
    const startDate = dayjs(startDateIso);
    const today = new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    // Build timeline ticks
    const viewTotalDays = Math.max(1, totalDays);
    const hideWeekText = viewTotalDays > 100;
    const weekTicks: { label: string; left: number; isMajor: boolean; showText: boolean }[] = [];
    for (let d = 1; d <= viewTotalDays; d += 7) {
        const weekNum = Math.floor((d - 1) / 7) + 1;
        const isMajor = (weekNum - 1) % 4 === 0;
        const monthNum = Math.floor((weekNum - 1) / 4) + 1;
        weekTicks.push({
            label: isMajor ? `M${monthNum}` : `W${weekNum}`,
            left: ((d - 1) / viewTotalDays) * 100,
            isMajor,
            showText: isMajor || !hideWeekText,
        });
    }

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700;800&display=swap');
                @page { margin: 8mm 10mm; size: A4 landscape; }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { background: #fff; }
                .gantt-row { page-break-inside: avoid; }
            `}</style>
            
            <div style={{ fontFamily: "'Sarabun', sans-serif", color: '#1a1a1a', background: '#ffffff', lineHeight: 1.4, width: '100%' }}>
                {/* ── Header ─────────────────────────────────────────────────── */}
                <div style={{ padding: '24px 32px 16px', borderBottom: `3px solid ${ACCENT}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT, letterSpacing: 1, marginBottom: 4 }}>
                                Contrack BOQ System
                            </div>
                            <div style={{ fontSize: 10, color: '#666' }}>{locale === 'en' ? 'BOQ System — Project Schedule Planning' : 'ระบบประมาณราคา BOQ — Project Schedule Planning'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 28, fontWeight: 900, color: ACCENT, lineHeight: 1, marginBottom: 4 }}>{locale === 'en' ? 'Project Schedule' : 'แผนงานโครงการ'}</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b', letterSpacing: 2, marginBottom: 8 }}>Schedule Timeline</div>
                            <div style={{ display: 'inline-grid', gridTemplateColumns: 'auto auto', gap: '2px 10px', fontSize: 10, textAlign: 'left', background: '#f1f5f9', padding: '8px 12px', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                                <div style={{ fontWeight: 700, color: ACCENT }}>{locale === 'en' ? 'Start Date:' : 'วันที่เริ่มโครงการ:'}</div>
                                <div>{startDate.format('DD/MM/YYYY')}</div>
                                <div style={{ fontWeight: 700, color: ACCENT }}>{locale === 'en' ? 'Print Date:' : 'วันที่พิมพ์:'}</div>
                                <div>{today}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Gantt Chart + Table Combine ────────────────────────────── */}
                <div style={{ padding: '16px 32px 24px', width: '100%' }}>
                    <div style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                        {/* Header Row */}
                        <div style={{ display: 'flex', background: ACCENT, color: '#fff', fontSize: 10, fontWeight: 700, alignItems: 'stretch' }}>
                            <div style={{ width: 140, padding: '10px 8px', borderRight: '1px solid rgba(255,255,255,0.2)' }}>{locale === 'en' ? 'Step' : 'ขั้นตอนการทำงาน'}</div>
                            <div style={{ width: 45, padding: '10px 8px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)' }}>{locale === 'en' ? 'Days' : 'วัน'}</div>
                            <div style={{ width: 45, padding: '10px 8px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)' }}>{locale === 'en' ? 'Team' : 'ทีม'}</div>
                            <div style={{ width: 90, padding: '10px 8px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.2)' }}>{locale === 'en' ? 'Start - End' : 'เริ่ม - สิ้นสุด'}</div>
                            
                            {/* Gantt Header */}
                            <div style={{ flex: 1, position: 'relative', background: '#333' }}>
                                {weekTicks.map((t, i) => (
                                    <div key={i} style={{
                                        position: 'absolute',
                                        left: `${t.left}%`,
                                        top: 0, bottom: 0,
                                        borderLeft: t.isMajor ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.15)',
                                        paddingLeft: 4,
                                        paddingTop: 8,
                                        fontSize: t.isMajor ? 11 : 9,
                                        color: t.isMajor ? '#fff' : '#aaa',
                                        transform: 'translateX(-1px)'
                                    }}>
                                        {t.showText ? t.label : ''}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Rows */}
                        <div style={{ background: '#fff' }}>
                            {items.map((item, idx) => {
                                const hasData = item.hasBoqData;
                                const isCritical = criticalSet.has(item.stepId);
                                const isEven = idx % 2 === 0;

                                const left = hasData ? ((item.startDay - 1) / viewTotalDays) * 100 : 0;
                                const width = hasData ? (item.days / viewTotalDays) * 100 : 0;
                                const baseColor = TEAM_COLORS[item.team] ?? '#888';

                                return (
                                    <div key={item.stepId} className="gantt-row" style={{
                                        display: 'flex',
                                        background: isEven ? '#fff' : '#fafafa',
                                        borderBottom: `1px solid ${BORDER}`,
                                        alignItems: 'stretch',
                                    }}>
                                        <div style={{ width: 140, padding: '6px 8px', borderRight: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', opacity: hasData ? 1 : 0.4 }}>
                                            <div style={{ background: baseColor, color: '#fff', fontSize: 8, fontWeight: 800, padding: '2px 4px', borderRadius: 2, marginRight: 8, flexShrink: 0 }}>
                                                {String(item.stepId).padStart(2, '0')}
                                            </div>
                                            <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.2, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {item.title}
                                            </div>
                                        </div>
                                        <div style={{ width: 45, padding: '6px 4px', textAlign: 'center', borderRight: `1px solid ${BORDER}`, fontSize: 10, fontWeight: 700, color: hasData ? '#1890ff' : '#aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {hasData ? item.days : '-'}
                                        </div>
                                        <div style={{ width: 45, padding: '6px 4px', textAlign: 'center', borderRight: `1px solid ${BORDER}`, fontSize: 10, color: hasData ? '#595959' : '#aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {hasData ? item.crews : '-'}
                                        </div>
                                        <div style={{ width: 90, padding: '6px 4px', textAlign: 'center', borderRight: `1px solid ${BORDER}`, fontSize: 9, color: hasData ? '#8c8c8c' : '#aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {hasData ? `${startDate.add(item.startDay-1, 'day').format('DD/MM')} - ${startDate.add(item.endDay-1, 'day').format('DD/MM')}` : '-'}
                                        </div>
                                        
                                        {/* Gantt Bar Area */}
                                        <div style={{ flex: 1, position: 'relative' }}>
                                            {weekTicks.map((t, i) => (
                                                <div key={i} style={{
                                                    position: 'absolute', left: `${t.left}%`, top: 0, bottom: 0, width: 1,
                                                    background: t.isMajor ? '#d9d9d9' : '#f0f0f0'
                                                }} />
                                            ))}
                                            {hasData && (
                                                <div style={{
                                                    position: 'absolute',
                                                    left: `${left}%`,
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    width: `${Math.max(width, 0.5)}%`,
                                                    height: 14,
                                                    background: baseColor,
                                                    borderRadius: 2,
                                                    border: isCritical ? '1px solid #faad14' : 'none',
                                                    boxShadow: isCritical ? '0 0 0 1px #faad14' : 'none',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: width > 5 ? 'center' : 'flex-start',
                                                    paddingLeft: width > 5 ? 0 : 4,
                                                }}>
                                                    {width > 2 && <span style={{ color: '#fff', fontSize: 8, fontWeight: 700 }}>{item.days}</span>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ── Signatures ────────────────────────────────────────────── */}
                <div style={{ padding: '0 32px 16px', pageBreakInside: 'avoid' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginTop: 12 }}>
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
                    padding: '16px 32px',
                    borderTop: '1px solid #e2e8f0',
                    marginTop: 16,
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 9, color: '#aaa',
                }}>
                    <div>{locale === 'en' ? '* This is an estimated timeline subject to on-site adjustments.' : '* แผนงานระยะเวลาประเมินเบื้องต้น อาจมีการปรับเปลี่ยนหน้างาน'}</div>
                    <div>{locale === 'en' ? 'Generated by Contrack BOQ System' : 'เอกสารนี้สร้างโดยระบบ Contrack BOQ System'}</div>
                </div>
            </div>
        </>
    );
}
