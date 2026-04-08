'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Table, Card, Typography, Tag, Collapse, Empty, App, Button } from 'antd';
import { FieldTimeOutlined, DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { StepSchedule } from '@/data/schedule-data';
import { TEAM_COLORS } from '@/data/schedule-data';
import type { StepResult } from '@/types';
import { useTranslations } from 'next-intl';
import { useAppLocale } from '@/i18n/LocaleProvider';

const { Text } = Typography;

interface ManDayTableProps {
    scheduleData: StepSchedule[];
    stepSaves: Record<number, { inp?: unknown; res: StepResult } | undefined>;
}

interface ManDayRow {
    key: number;
    stepId: number;
    title: string;
    titleEn: string;
    team: string;
    skilled: number;       // ช่าง
    laborers: number;      // คนงาน
    days: number;
    manDays: number;       // คน × วัน
    hasData: boolean;
    boqItemCount: number;
}

function parseWorkerDetail(detail: string | undefined | null): { skilled: number; laborers: number } {
    if (!detail) {
        return { skilled: 0, laborers: 0 };
    }
    const skilledMatch = /ช่าง\s*(\d+)/.exec(detail);
    const laborerMatch = /คนงาน\s*(\d+)/.exec(detail);
    return {
        skilled: skilledMatch ? parseInt(skilledMatch[1] ?? '0') : 0,
        laborers: laborerMatch ? parseInt(laborerMatch[1] ?? '0') : 0,
    };
}

export const ManDayTable: React.FC<ManDayTableProps> = ({ scheduleData, stepSaves }) => {
    const [activeKeys, setActiveKeys] = useState<string[] | string>([]);
    const { message } = App.useApp();
    const t = useTranslations('schedule');
    const { locale } = useAppLocale();
    const [downloading, setDownloading] = useState(false);

    const rows: ManDayRow[] = useMemo(() => {
        return scheduleData.map((sched) => {
            const { skilled, laborers } = parseWorkerDetail(sched.crewSetup);
            const save = stepSaves[sched.stepId];
            const hasData = !!save;
            const boqItemCount = save ? Object.keys(save.res.quantities).length : 0;
            const crews = sched.crews;
            const days = sched.defaultDays;

            return {
                key: sched.stepId,
                stepId: sched.stepId,
                title: sched.title,
                titleEn: sched.titleEn,
                team: sched.team,
                skilled,
                laborers,
                days,
                manDays: crews * Math.max(1, (skilled + laborers)) * days,
                hasData,
                boqItemCount,
            };
        });
    }, [scheduleData, stepSaves]);

    // Group by team for Collapse
    const grouped = useMemo(() => {
        const groups: Record<string, ManDayRow[]> = {};
        
        // Ensure order of teams as they appear in scheduleData
        scheduleData.forEach(s => {
            groups[s.team] ??= [];
        });

        rows.forEach(r => {
            groups[r.team]?.push(r);
        });

        return groups;
    }, [scheduleData, rows]);

    // Summaries
    const totalManDays = rows.reduce((s, r) => s + r.manDays, 0);
    const totalSkilledDays = rows.reduce((s, r) => s + (r.skilled * r.days), 0);
    const totalLaborerDays = rows.reduce((s, r) => s + (r.laborers * r.days), 0);
    const completedCount = rows.filter(r => r.hasData).length;

    const handleDownloadPdf = useCallback(async () => {
        if (typeof window === 'undefined') return;
        setDownloading(true);
        const hide = message.loading('กำลังสร้าง PDF...', 0);
        try {
            const payload = {
                rows,
                grouped,
                totalManDays,
                totalSkilledDays,
                totalLaborerDays,
                completedCount,
                locale
            };
            const response = await fetch('/api/manday/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
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
            link.download = 'ManDay-Report.pdf';
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
    }, [rows, grouped, totalManDays, totalSkilledDays, totalLaborerDays, completedCount, locale, message]);

    const columns: ColumnsType<ManDayRow> = [
        {
            title: '#',
            dataIndex: 'stepId',
            key: 'stepId',
            width: 40,
            align: 'center',
            fixed: 'left',
            render: (v: number, r: ManDayRow) => (
                <Text style={{ fontSize: 11, fontWeight: 600, color: r.hasData ? '#1a1a1a' : '#bfbfbf' }}>
                    {String(v).padStart(2, '0')}
                </Text>
            ),
        },
        {
            title: t('mdColTask'),
            key: 'title',
            width: 250,
            fixed: 'left',
            render: (_: unknown, r: ManDayRow) => (
                <div style={{ opacity: r.hasData ? 1 : 0.45 }}>
                    <Text strong style={{ fontSize: 13 }}>{r.title}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>{r.titleEn}</Text>
                </div>
            ),
        },
        {
            title: t('mdColSkilled'),
            dataIndex: 'skilled',
            key: 'skilled',
            width: 100,
            align: 'center',
            render: (v: number) => <Text style={{ color: '#1890ff', fontWeight: 600 }}>{v || '—'}</Text>,
        },
        {
            title: t('mdColLaborers'),
            dataIndex: 'laborers',
            key: 'laborers',
            width: 120,
            align: 'center',
            render: (v: number) => <Text style={{ color: '#722ed1', fontWeight: 600 }}>{v || '—'}</Text>,
        },
        {
            title: t('mdColDays'),
            dataIndex: 'days',
            key: 'days',
            width: 120,
            align: 'center',
            render: (v: number) => <Text>{v}</Text>,
        },
        {
            title: <span style={{ color: '#fa8c16', fontWeight: 700 }}>Man-Day</span>,
            dataIndex: 'manDays',
            key: 'manDays',
            width: 100,
            align: 'center',
            render: (v: number) => <Text strong style={{ color: '#fa8c16', fontSize: 14 }}>{v}</Text>,
        },
        {
            title: t('mdColBoq'),
            dataIndex: 'boqItemCount',
            key: 'boq',
            width: 120,
            align: 'center',
            render: (v: number, r: ManDayRow) => (
                r.hasData
                    ? <Tag color="green" style={{ fontSize: 11, margin: 0 }}>{t('mdStatusEvaluated', { count: v })}</Tag>
                    : <Text type="secondary" style={{ fontSize: 11 }}>{t('mdStatusUnevaluated')}</Text>
            ),
        },
    ];

    return (
        <div style={{ width: '100%', margin: '0 auto' }}>
            {/* Main Table using Collapse grouped by Team */}
            <Card
                title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FieldTimeOutlined style={{ color: '#1890ff' }} />
                            <span style={{ fontSize: 16, fontWeight: 600 }}>{t('mdMainTitle')}</span>
                        </div>
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
                    </div>
                }
                style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,.05)', marginBottom: 16 }}
                styles={{ header: { padding: '16px', display: 'flex', flexDirection: 'column' }, body: { padding: 12, backgroundColor: '#f5f5f5' } }}
            >
                <Collapse 
                    activeKey={activeKeys} 
                    onChange={(keys) => setActiveKeys(keys)}
                    style={{ background: '#fff' }}
                    items={Object.entries(grouped)
                        .filter(([_, items]) => items.length > 0)
                        .map(([team, items]) => {
                            const teamManDays = items.reduce((s, r) => s + r.manDays, 0);
                            return {
                                key: team,
                                label: (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 8, paddingRight: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <Tag color={TEAM_COLORS[team] ?? '#888'} style={{ border: 'none', margin: 0, fontSize: 13, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                                                {team}
                                            </Tag>
                                            <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{t('mdItemsCount', { count: items.length })}</Text>
                                        </div>
                                        <Text strong style={{ color: '#fa8c16', whiteSpace: 'nowrap' }}>{t('mdTotalManDay', { manDays: teamManDays })}</Text>
                                    </div>
                                ),
                                children: (
                                    <>
                                        {/* Mobile Card View */}
                                        <div className="md:hidden flex flex-col gap-3">
                                            {items.map(r => (
                                                <div key={r.stepId} style={{
                                                    background: '#fff',
                                                    borderRadius: 8,
                                                    border: '1px solid #e8e8e8',
                                                    padding: '12px',
                                                    opacity: r.hasData ? 1 : 0.6
                                                }}>
                                                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                                                        <div style={{
                                                            background: r.hasData ? '#1a1a2e' : '#d9d9d9',
                                                            color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0
                                                        }}>
                                                            {String(r.stepId).padStart(2, '0')}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, fontSize: 13, color: '#262626' }}>{r.title}</div>
                                                            <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.titleEn}</div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', background: '#fafafa', padding: '8px', borderRadius: 6, marginBottom: 8 }}>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <div style={{ fontSize: 10, color: '#8c8c8c' }}>{t('mdSkilled')}</div>
                                                            <div style={{ fontWeight: 600, color: '#1890ff' }}>{r.skilled || '—'} <span style={{fontSize: 10, fontWeight: 400}}>{t('mdPersonUnit')}</span></div>
                                                        </div>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <div style={{ fontSize: 10, color: '#8c8c8c' }}>{t('mdLaborers')}</div>
                                                            <div style={{ fontWeight: 600, color: '#722ed1' }}>{r.laborers || '—'} <span style={{fontSize: 10, fontWeight: 400}}>{t('mdPersonUnit')}</span></div>
                                                        </div>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <div style={{ fontSize: 10, color: '#8c8c8c' }}>{t('mdDuration')}</div>
                                                            <div style={{ fontWeight: 600 }}>{r.days} <span style={{fontSize: 10, fontWeight: 400}}>{t('mdDayUnit')}</span></div>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Tag color="orange" style={{ margin: 0, fontWeight: 700, border: 'none' }}>
                                                            {r.manDays} Man-Day
                                                        </Tag>
                                                        {r.hasData ? (
                                                            <Tag color="green" style={{ fontSize: 10, margin: 0, border: 'none' }}>{t('mdStatusEvaluated', { count: r.boqItemCount })}</Tag>
                                                        ) : (
                                                            <span style={{ fontSize: 10, color: '#bfbfbf' }}>{t('mdStatusUnevaluated')}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Desktop Table View */}
                                        <div className="hidden md:block table-scroll-wrapper" style={{ overflowX: 'auto' }}>
                                            <Table
                                                dataSource={items}
                                                columns={columns}
                                                rowKey="stepId"
                                                pagination={false}
                                                size="small"
                                                scroll={{ x: 850 }}
                                                locale={{ emptyText: <Empty description={t('emptyData')} /> }}
                                                rowClassName={(r: ManDayRow) => r.hasData ? '' : 'no-data-row'}
                                            />
                                        </div>
                                    </>
                                )
                            };
                        })}
                />
            </Card>

            {/* Simple Footer Summary Layer */}
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
                boxShadow: '0 1px 4px rgba(0,0,0,.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Text strong style={{ fontSize: 16, color: '#262626' }}>{t('mdSummaryTitle')}</Text>
                    <Tag>{t('mdSummaryItems', { completed: completedCount, total: 34 })}</Tag>
                </div>
                
                <div style={{ display: 'flex', gap: '16px 24px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>{t('mdSummarySkilled')}</Text>
                        <Text strong style={{ color: '#1890ff', fontSize: 14 }}>{t('mdSummarySkilledVal', { days: totalSkilledDays })}</Text>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>{t('mdSummaryLaborers')}</Text>
                        <Text strong style={{ color: '#722ed1', fontSize: 14 }}>{t('mdSummaryLaborersVal', { days: totalLaborerDays })}</Text>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>{t('mdSummaryTotal')}</Text>
                        <Text strong style={{ color: '#fa8c16', fontSize: 16 }}>{t('mdSummaryTotalVal', { manDays: totalManDays })}</Text>
                    </div>
                </div>
            </div>
        </div>
    );
};
