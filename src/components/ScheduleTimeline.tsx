'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Typography, Tag, Tooltip, DatePicker, Card, Table, Switch, Space, Empty, Collapse, Button, InputNumber, App } from 'antd';
import {
    ClockCircleOutlined, TeamOutlined, CalendarOutlined,
    ThunderboltOutlined,
    FilePdfOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { buildSchedule, type ScheduleItem, type ProjectSchedule } from '@/lib/schedule-engine';
import { TEAM_COLORS, type StepSchedule } from '@/data/schedule-data';
import type { StepResult } from '@/types';
import { useAppStore } from '@/lib/store';
import { useTranslations } from 'next-intl';
import { useAppLocale } from '@/i18n/LocaleProvider';

const { Text } = Typography;

const ALL_STEP_IDS = Array.from({ length: 34 }, (_, i) => i + 1);

interface ScheduleTimelineProps {
    stepSaves: Record<number, { inp?: unknown; res: StepResult } | undefined>;
    scheduleData: StepSchedule[];
}

/* ── Professional Gantt Bar ──────────────────────────── */
const GanttBar: React.FC<{
    item: ScheduleItem;
    totalDays: number;
    isCritical: boolean;
    hasData: boolean;
    t: (key: string, values?: Record<string, string | number | Date>) => string;
}> = ({ item, totalDays, isCritical, hasData, t }) => {
    const left = ((item.startDay - 1) / totalDays) * 100;
    const width = (item.days / totalDays) * 100;
    const baseColor = TEAM_COLORS[item.team] ?? '#888';

    // If no data, show ghost bar
    if (!hasData) {
        return (
            <Tooltip title={<span>{item.title} — {t('noBoqData')}</span>}>
                <div
                    style={{
                        position: 'absolute',
                        left: `${left}%`,
                        width: `${Math.max(width, 2)}%`,
                        height: 20,
                        background: 'repeating-linear-gradient(45deg, #e8e8e8, #e8e8e8 4px, #f5f5f5 4px, #f5f5f5 8px)',
                        borderRadius: 4,
                        border: '1px dashed #d9d9d9',
                        cursor: 'default',
                    }}
                />
            </Tooltip>
        );
    }

    return (
        <Tooltip
            title={
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>{item.title} ({item.titleEn})</div>
                    <div>{t('dayRange', { start: item.startDay, end: item.endDay, days: item.days })}</div>
                    <div>{t('teamCount', { crews: item.crews, crewSetup: item.crewSetup })}</div>
                    <div>{t('teamLabel', { team: item.team })}</div>
                    <div>Prod: {item.productivity}</div>
                    {item.hasBoqData && <Tag color="green" style={{ marginTop: 4, fontSize: 10 }}>{t('calcFromBoq')}</Tag>}
                </div>
            }
            placement="right"
        >
            <div
                style={{
                    position: 'absolute',
                    left: `${left}%`,
                    width: `${Math.max(width, 2)}%`,
                    height: 20,
                    background: `linear-gradient(135deg, ${baseColor} 0%, ${baseColor}cc 100%)`,
                    borderRadius: 4,
                    border: isCritical ? '2px solid #faad14' : 'none',
                    boxShadow: isCritical ? '0 0 6px rgba(250,173,20,.35)' : '0 1px 2px rgba(0,0,0,.1)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: width > 4 ? 'flex-start' : 'center',
                    paddingLeft: width > 4 ? 6 : 0,
                    overflow: 'hidden',
                }}
                className="gantt-bar"
            >
                <span style={{
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    textShadow: '0 1px 2px rgba(0,0,0,.3)',
                    letterSpacing: 0.3,
                }}>
                    {width > 4 ? `${item.days}d` : ''}
                </span>
            </div>
        </Tooltip>
    );
};

/* ── Main Component ───────────────────────────────────── */
export const ScheduleTimeline: React.FC<ScheduleTimelineProps> = ({ stepSaves, scheduleData }) => {
    const t = useTranslations('schedule');
    const { locale } = useAppLocale();
    const [startDate, setStartDate] = useState<Dayjs>(dayjs());
    const [showTable, setShowTable] = useState(false);

    // Connect to global Zastrand store for config persistency
    const config = useAppStore(state => state.scheduleConfig);
    const setConfig = useAppStore(state => state.setScheduleConfig);

    const [downloading, setDownloading] = useState(false);
    const { message: messageApi } = App.useApp();

    const completedCount = ALL_STEP_IDS.filter(id => stepSaves[id]).length;

    const schedule: ProjectSchedule = useMemo(
        () => buildSchedule(stepSaves as Record<number, { inp?: unknown; res: StepResult } | undefined>, scheduleData, config),
        [stepSaves, scheduleData, config],
    );

    const criticalSet = useMemo(() => new Set(schedule.criticalPath), [schedule.criticalPath]);

    const endDate = startDate.add(schedule.totalDays - 1, 'day');

    const { actualCrewDays, actualTotalDays } = useMemo(() => {
        const active = schedule.items.filter(it => it.hasBoqData);
        const cDays = active.reduce((sum, it) => sum + (it.days * it.crews), 0);
        const activeDaysSet = new Set<number>();
        active.forEach(it => {
            for (let d = it.startDay; d <= it.endDay; d++) activeDaysSet.add(d);
        });
        return { actualCrewDays: cDays, actualTotalDays: activeDaysSet.size };
    }, [schedule.items]);

    const displayMonths = Math.round(actualTotalDays / 30 * 10) / 10;

    const teams = useMemo(() => {
        const set = new Set(schedule.items.map(i => i.team));
        return [...set];
    }, [schedule.items]);

    /* ── Week tick marks for Gantt ── */
    const weekTicks = useMemo(() => {
        const ticks: { label: string; left: number; isMajor: boolean; showText: boolean }[] = [];
        const total = Math.max(1, schedule.totalDays);
        const hideWeekText = total > 100; // Hide 'W...' labels if project > 3-4 months to avoid overlap
        for (let d = 1; d <= total; d += 7) {
            const weekNum = Math.floor((d - 1) / 7) + 1;
            const isMajor = (weekNum - 1) % 4 === 0; // every 4 weeks = month boundary
            const monthNum = Math.floor((weekNum - 1) / 4) + 1;
            ticks.push({
                label: isMajor ? t('monthLabel', { month: monthNum }) : t('weekLabel', { week: weekNum }),
                left: ((d - 1) / total) * 100,
                isMajor,
                showText: isMajor || !hideWeekText,
            });
        }
        return ticks;
    }, [schedule.totalDays, t]);

    const updateCrew = (stepId: number, count: number) => {
        setConfig(prev => ({
            ...prev,
            crewOverrides: {
                ...prev.crewOverrides,
                [stepId]: count
            }
        }));
    };

    const handleDownloadPdf = useCallback(async () => {
        try {
            setDownloading(true);
            const payload = {
                items: schedule.items,
                totalDays: schedule.totalDays,
                criticalSetArr: Array.from(criticalSet),
                startDateIso: startDate.toISOString(),
                locale,
            };

            const response = await fetch('/api/schedule/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error('Failed to generate PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Schedule_Timeline_${dayjs().format('YYYYMMDD')}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);

            messageApi.success(t('pdfSuccess'));
        } catch (error) {
            messageApi.error(t('pdfError'));
            console.error(error);
        } finally {
            setDownloading(false);
        }
    }, [schedule.items, schedule.totalDays, criticalSet, startDate, locale, messageApi, t]);

    /* ── Table columns ── */
    const tableCols: ColumnsType<ScheduleItem> = [
        {
            title: t('colNo'), dataIndex: 'stepId', key: 'stepId', width: 40, align: 'center',
            render: (v: number) => (
                <Text style={{ fontSize: 11, fontWeight: 600, color: stepSaves[v] ? '#1a1a1a' : '#bfbfbf' }}>
                    {String(v).padStart(2, '0')}
                </Text>
            ),
        },
        {
            title: t('colStep'), dataIndex: 'title', key: 'title', ellipsis: true,
            render: (v: string, r: ScheduleItem) => (
                <div style={{ opacity: stepSaves[r.stepId] ? 1 : 0.4 }}>
                    <Text strong style={{ fontSize: 13 }}>{v}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>{r.titleEn}</Text>
                </div>
            ),
        },
        {
            title: t('colDays'), dataIndex: 'days', key: 'days', width: 90, align: 'center',
            render: (v: number, r: ScheduleItem) => {
                const canEdit = !!stepSaves[r.stepId];
                if (!canEdit) return <Text type="secondary">—</Text>;

                const isManual = config.isManualOverrides[r.stepId] ?? false;
                const currentManualDays = config.dayOverrides[r.stepId] ?? r.days;
                
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        {isManual ? (
                            <InputNumber
                                min={1}
                                value={currentManualDays}
                                size="small"
                                onChange={(val) => setConfig(p => ({ ...p, dayOverrides: { ...p.dayOverrides, [r.stepId]: val ?? 1 } }))}
                                style={{ width: 60, textAlign: 'center' }}
                            />
                        ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Text strong>{v}</Text>
                                {r.hasBoqData && <ThunderboltOutlined style={{ color: '#52c41a', fontSize: 11 }} />}
                            </span>
                        )}
                        <Switch
                            checkedChildren="Auto"
                            unCheckedChildren="Manual"
                            checked={!isManual}
                            onChange={(auto) => {
                                setConfig(p => ({
                                    ...p,
                                    isManualOverrides: { ...p.isManualOverrides, [r.stepId]: !auto },
                                    dayOverrides: { ...p.dayOverrides, [r.stepId]: v }
                                }));
                            }}
                            size="small"
                        />
                    </div>
                );
            },
        },
        {
            title: t('colTeams'), dataIndex: 'crews', key: 'crews', width: 110, align: 'center',
            responsive: ['sm'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[],
            render: (v: number, r: ScheduleItem) => {
                const current = config.crewOverrides[r.stepId] ?? v;
                const canEdit = !!stepSaves[r.stepId];
                return (
                    <div style={{ opacity: canEdit ? 1 : 0.4 }}>
                        <Space.Compact size="small">
                            <Button
                                disabled={!canEdit || current <= 1}
                                onClick={() => updateCrew(r.stepId, current - 1)}>-</Button>
                            <InputNumber
                                disabled={!canEdit}
                                min={1} max={50} value={current}
                                onChange={(val) => updateCrew(r.stepId, val ?? v)}
                                style={{ width: 45, textAlign: 'center', fontSize: 12 }}
                            />
                            <Button
                                disabled={!canEdit}
                                onClick={() => updateCrew(r.stepId, current + 1)}>+</Button>
                        </Space.Compact>
                    </div>
                );
            }
        },
        {
            title: t('colTeamName'), dataIndex: 'team', key: 'team', width: 150,
            responsive: ['md'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[],
            render: (v: string) => (
                <Tag style={{ background: TEAM_COLORS[v] ?? '#888', color: '#fff', border: 'none', fontSize: 11 }}>
                    {v}
                </Tag>
            ),
        },
        {
            title: t('colStart'), key: 'start', width: 90, align: 'center',
            responsive: ['sm'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[],
            render: (_: unknown, r: ScheduleItem) => (
                <Text style={{ fontSize: 12, opacity: stepSaves[r.stepId] ? 1 : 0.4 }}>
                    {r.hasBoqData ? startDate.add(r.startDay - 1, 'day').format('DD MMM') : '-'}
                </Text>
            ),
        },
        {
            title: t('colEnd'), key: 'end', width: 90, align: 'center',
            responsive: ['sm'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[],
            render: (_: unknown, r: ScheduleItem) => (
                <Text style={{ fontSize: 12, opacity: stepSaves[r.stepId] ? 1 : 0.4 }}>
                    {r.hasBoqData ? startDate.add(r.endDay - 1, 'day').format('DD MMM') : '-'}
                </Text>
            ),
        },
    ];

    return (
        <div style={{ width: '100%', margin: '0 auto' }}>
            {/* ── Settings Panel ── */}
            <Collapse
                size="small"
                style={{ marginBottom: 16, borderRadius: 10 }}
                items={[{
                    key: 'config',
                    label: <span><ClockCircleOutlined /> {t('settingsTitle')}</span>,
                    children: (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
                            <div>
                                <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{t('weatherBuffer')}</Text>
                                <InputNumber
                                    value={config.weatherBufferPercent * 100}
                                    min={0} max={100} step={5}
                                    formatter={(v) => `${v}%`}
                                    parser={(v) => Number(v?.toString().replace('%', '') ?? 0)}
                                    onChange={(v) => setConfig(p => ({ ...p, weatherBufferPercent: (v ?? 0) / 100 }))}
                                    style={{ width: 120 }}
                                    size="small"
                                />
                                <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4, maxWidth: 200 }}>
                                    {t('weatherHint')}
                                </div>
                            </div>
                            <div>
                                <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>ระยะเวลาบ่มคอนกรีต (Curing Days)</Text>
                                <InputNumber
                                    value={config.globalCuringDays ?? 7}
                                    step={1}
                                    onChange={(v) => {
                                        let val = v ?? 7;
                                        if (val > 28) {
                                            messageApi.warning('ระยะเวลาบ่มคอนกรีตไม่ควรเกิน 28 วัน');
                                            val = 28;
                                        } else if (val < 0) {
                                            val = 0;
                                        }
                                        setConfig(p => ({ ...p, globalCuringDays: val }));
                                    }}
                                    style={{ width: 120 }}
                                    size="small"
                                />
                                <span style={{ fontSize: 13, marginLeft: 8 }}>วัน</span>
                                <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4, maxWidth: 220 }}>
                                    จำนวนวันพักหลังจากเทคอนกรีต ก่อนเริ่มงานโครงสร้างส่วนถัดไป
                                </div>
                            </div>
                        </div>
                    )
                }]}
            />

            {/* ── Export Actions ── */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
                <Button
                    type="primary"
                    icon={<FilePdfOutlined />}
                    onClick={handleDownloadPdf}
                    loading={downloading}
                    style={{ background: '#1a1a2e', borderColor: '#1a1a2e', fontWeight: 600, borderRadius: 8 }}
                >
                    {t('printPdf')}
                </Button>
            </div>

            {/* ── Date Picker + Controls ── */}
            <Card
                size="small"
                style={{ marginBottom: 16, borderRadius: 10 }}
                styles={{ body: { display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', padding: '10px 16px' } }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CalendarOutlined style={{ color: '#595959' }} />
                    <Text strong style={{ fontSize: 13 }}>{t('startDate')}</Text>
                    <DatePicker
                        value={startDate}
                        onChange={(d) => d && setStartDate(d)}
                        format="DD/MM/YYYY"
                        style={{ width: 130 }}
                        size="small"
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ClockCircleOutlined style={{ color: '#595959' }} />
                    <Text style={{ fontSize: 13 }}>
                        {t('endDate')} <Text strong style={{ color: '#389e0d' }}>{endDate.format('DD/MM/YYYY')}</Text>
                    </Text>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{t('showTable')}</Text>
                    <Switch size="small" checked={showTable} onChange={setShowTable} />
                </div>
            </Card>

            {/* ── Gantt Chart ── */}
            {!showTable && (
                <Card
                    size="small"
                    style={{
                        marginBottom: 16,
                        borderRadius: 10,
                        overflow: 'hidden',
                    }}
                    styles={{ header: { background: '#262626', borderBottom: 'none' }, body: { padding: '0' } }}
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
                            <CalendarOutlined />
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{t('ganttTitle')}</span>
                            <Text style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, marginLeft: 4 }}>
                                {t('ganttSubtitle')}
                            </Text>
                        </div>
                    }
                >
                    {/* Scrollable Container */}
                    <div className="table-scroll-wrapper" style={{ maxHeight: 680, overflowY: 'auto', overflowX: 'auto' }}>
                        <div style={{ minWidth: 720 }}>
                            {/* Header row with ticks */}
                            <div style={{
                                display: 'flex',
                                borderBottom: '2px solid #e8e8e8',
                                background: '#fafafa',
                                position: 'sticky',
                                top: 0,
                                zIndex: 10,
                            }}>
                                <div style={{
                                    width: 160,
                                    flexShrink: 0,
                                    padding: '8px 12px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#595959',
                                    borderRight: '1px solid #f0f0f0',
                                }}>
                                    {t('colStep')}
                                </div>
                                <div style={{ flex: 1, position: 'relative', height: 32 }}>
                                    {weekTicks.map((t, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                position: 'absolute',
                                                left: `${t.left}%`,
                                                top: 0,
                                                bottom: 0,
                                                borderLeft: t.isMajor ? '2px solid #d9d9d9' : '1px solid #f0f0f0',
                                                paddingLeft: 4,
                                                paddingTop: t.isMajor ? 4 : 10,
                                                fontSize: t.isMajor ? 11 : 9,
                                                fontWeight: t.isMajor ? 700 : 400,
                                                color: t.isMajor ? '#434343' : '#bfbfbf',
                                                whiteSpace: 'nowrap',
                                                transform: 'translateX(-2px)',
                                            }}
                                        >
                                            {t.showText ? t.label : ''}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Gantt rows */}
                            <div>
                                {schedule.items.map((item, idx) => {
                                    const hasData = !!stepSaves[item.stepId];
                                    return (
                                        <div
                                            key={item.stepId}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                height: 32,
                                                borderBottom: '1px solid #f5f5f5',
                                                background: idx % 2 === 0 ? '#fff' : '#fafbfc',
                                                transition: 'background 0.15s',
                                            }}
                                            className="gantt-row"
                                        >
                                            {/* Label */}
                                            <div style={{
                                                width: 160,
                                                flexShrink: 0,
                                                fontSize: 11,
                                                padding: '0 8px 0 12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                borderRight: '1px solid #f0f0f0',
                                                opacity: hasData ? 1 : 0.4,
                                            }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    width: 6,
                                                    height: 6,
                                                    borderRadius: '50%',
                                                    background: hasData ? (TEAM_COLORS[item.team] ?? '#888') : '#d9d9d9',
                                                    flexShrink: 0,
                                                }} />
                                                <span style={{
                                                    fontWeight: 600,
                                                    color: '#8c8c8c',
                                                    fontSize: 10,
                                                    width: 18,
                                                    flexShrink: 0,
                                                }}>
                                                    {String(item.stepId).padStart(2, '0')}
                                                </span>
                                                <span style={{
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    color: '#434343',
                                                }}>
                                                    {item.title}
                                                </span>
                                            </div>

                                            {/* Bar area */}
                                            <div style={{ flex: 1, position: 'relative', height: '100%' }}>
                                                {/* Grid lines */}
                                                {weekTicks.map((t, i) => (
                                                    <div
                                                        key={i}
                                                        style={{
                                                            position: 'absolute',
                                                            left: `${t.left}%`,
                                                            top: 0,
                                                            bottom: 0,
                                                            width: 1,
                                                            background: t.isMajor ? '#e8e8e8' : '#f5f5f5',
                                                        }}
                                                    />
                                                ))}
                                                <div style={{ position: 'relative', top: 6 }}>
                                                    <GanttBar
                                                        item={item}
                                                        totalDays={Math.max(1, schedule.totalDays)}
                                                        isCritical={criticalSet.has(item.stepId)}
                                                        hasData={hasData}
                                                        t={t}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Footer legend */}
                    <div style={{
                        padding: '10px 12px',
                        borderTop: '1px solid #f0f0f0',
                        background: '#fafafa',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        alignItems: 'center',
                    }}>
                        {teams.map(team => (
                            <Tag
                                key={team}
                                style={{
                                    background: TEAM_COLORS[team] ?? '#888',
                                    color: '#fff',
                                    border: 'none',
                                    fontSize: 10,
                                    lineHeight: '18px',
                                    padding: '0 6px',
                                    borderRadius: 3,
                                }}
                            >
                                {team}
                            </Tag>
                        ))}
                        <div style={{ width: 1, height: 16, background: '#f0f0f0', margin: '0 4px' }} />
                        <Tag style={{ fontSize: 10, lineHeight: '18px', padding: '0 6px', borderRadius: 3 }} color="gold">
                            Critical Path
                        </Tag>
                        <span style={{ fontSize: 10, color: '#bfbfbf', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{
                                display: 'inline-block', width: 16, height: 8, borderRadius: 2,
                                background: 'repeating-linear-gradient(45deg, #e8e8e8, #e8e8e8 2px, #f5f5f5 2px, #f5f5f5 4px)',
                                border: '1px dashed #d9d9d9',
                            }} />
                            {t('legendPending')}
                        </span>
                    </div>
                </Card>
            )}

            {/* ── Table View ── */}
            {showTable && (
                <>
                    {/* Mobile Card View for Table Data */}
                    <div className="md:hidden flex flex-col gap-3 mb-4">
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: '#262626', display: 'flex', alignItems: 'center' }}>
                            <CalendarOutlined style={{ marginRight: 8 }} />
                            {t('detailTitle')}
                        </div>
                        {schedule.items.map((item) => {
                            const hasData = !!stepSaves[item.stepId];
                            const isCritical = criticalSet.has(item.stepId);
                            const start = hasData ? startDate.add(item.startDay - 1, 'day').format('DD MMM') : '-';
                            const end = hasData ? startDate.add(item.endDay - 1, 'day').format('DD MMM') : '-';
                            const currentCrews = config.crewOverrides[item.stepId] ?? item.crews;

                            return (
                                <div key={item.stepId} style={{
                                    background: '#fff',
                                    borderRadius: 10,
                                    border: isCritical ? '2px solid #ffc069' : '1px solid #d9d9d9',
                                    padding: '14px',
                                    boxShadow: '0 1px 4px rgba(0,0,0,.05)',
                                    opacity: hasData ? 1 : 0.6
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                            <div style={{
                                                background: hasData ? (TEAM_COLORS[item.team] ?? '#888') : '#d9d9d9',
                                                color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0
                                            }}>
                                                {String(item.stepId).padStart(2, '0')}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1a1a' }}>{item.title}</div>
                                                <div style={{ fontSize: 11, color: '#8c8c8c' }}>{item.titleEn}</div>
                                            </div>
                                        </div>
                                        {isCritical && <Tag color="gold" style={{ border: 'none', margin: 0, padding: '0 6px', fontSize: 10, fontWeight: 600 }}>{t('criticalLabel')}</Tag>}
                                    </div>

                                    <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', background: '#fafafa', padding: '8px', borderRadius: 8 }}>
                                        <Text style={{ fontSize: 12, color: '#595959' }}><TeamOutlined /> {t('teamIcon')}</Text>
                                        <Space.Compact size="small">
                                            <Button disabled={!hasData || currentCrews <= 1} onClick={() => updateCrew(item.stepId, currentCrews - 1)}>-</Button>
                                            <InputNumber disabled={!hasData} value={currentCrews} onChange={(val) => updateCrew(item.stepId, val ?? item.crews)} style={{ width: 45, textAlign: 'center', fontSize: 12 }} />
                                            <Button disabled={!hasData} onClick={() => updateCrew(item.stepId, currentCrews + 1)}>+</Button>
                                        </Space.Compact>
                                        <Tag style={{ margin: 0, background: TEAM_COLORS[item.team] ?? '#888', border: 'none', color: '#fff', fontSize: 11, marginLeft: 'auto' }}>
                                            {item.team}
                                        </Tag>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#595959', background: '#fafafa', padding: '10px', borderRadius: 8, marginBottom: 12 }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: 10, color: '#8c8c8c', marginBottom: 2 }}>{t('startTitle')}</div>
                                            <div style={{ fontWeight: 600, color: '#262626' }}>{start}</div>
                                        </div>
                                        <div style={{ textAlign: 'center', borderLeft: '1px solid #e8e8e8', borderRight: '1px solid #e8e8e8', padding: '0 12px' }}>
                                            <div style={{ fontSize: 10, color: '#8c8c8c', marginBottom: 2 }}>{t('durationTitle')}</div>
                                            <div style={{ fontWeight: 700, color: '#1890ff' }}>{hasData ? t('durationDays', { days: item.days }) : '-'}</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: 10, color: '#8c8c8c', marginBottom: 2 }}>{t('endTitle')}</div>
                                            <div style={{ fontWeight: 600, color: '#262626' }}>{end}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <Card
                        title={t('detailTitle')}
                        size="small"
                        className="hidden md:block"
                        style={{ marginBottom: 16, borderRadius: 10 }}
                    >
                        <div className="table-scroll-wrapper">
                            <Table
                                dataSource={schedule.items}
                                columns={tableCols}
                                rowKey="stepId"
                                pagination={false}
                                size="small"
                                scroll={{ x: 600 }}
                                locale={{ emptyText: <Empty description={t('emptyData')} /> }}
                                rowClassName={(r: ScheduleItem) =>
                                    `${criticalSet.has(r.stepId) ? 'critical-row' : ''} ${!stepSaves[r.stepId] ? 'no-data-row' : ''}`
                                }
                            />
                        </div>
                    </Card>
                </>
            )}

            <div style={{
                background: '#fff',
                border: '1px solid #f0f0f0',
                borderRadius: 10,
                padding: '16px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
                boxShadow: '0 1px 4px rgba(0,0,0,.05)',
                marginBottom: 16,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Text strong style={{ fontSize: 16, color: '#262626' }}>{t('summaryTitle')}</Text>
                    <Tag>{t('summaryItems', { completed: completedCount, total: 34 })}</Tag>
                </div>

                <Space size="large" wrap align="center">
                    <Space size="small">
                        <Text type="secondary" style={{ fontSize: 13 }}>{t('actualDays')}</Text>
                        <Text strong style={{ color: '#fa8c16', fontSize: 16 }}>{t('actualDaysVal', { days: actualTotalDays, months: displayMonths })}</Text>
                    </Space>
                    <div style={{ width: 1, height: 24, background: '#f0f0f0', margin: '0 4px' }} />
                    <Space size="small">
                        <Text type="secondary" style={{ fontSize: 13 }}>{t('crewDays')}</Text>
                        <Text strong style={{ color: '#1890ff', fontSize: 15 }}>{t('crewDaysVal', { days: actualCrewDays })}</Text>
                    </Space>
                    <div style={{ width: 1, height: 24, background: '#f0f0f0', margin: '0 4px' }} />
                    <Space size="small">
                        <Text type="secondary" style={{ fontSize: 13 }}>{t('teamSummary')}</Text>
                        <Text strong style={{ color: '#722ed1', fontSize: 15 }}>{t('teamSummaryVal', { count: teams.length })}</Text>
                    </Space>
                </Space>
            </div>
        </div>
    );
};
