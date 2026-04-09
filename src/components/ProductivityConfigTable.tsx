'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Table, InputNumber, Typography, Card, Tag, Input, Select, Space, Collapse, Button, App, Grid } from 'antd';
import { SearchOutlined, FilterOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { StepSchedule } from '@/data/schedule-data';
import { TEAM_COLORS, SCHEDULE_DATA as INITIAL_SCHEDULE_DATA } from '@/data/schedule-data';
import { exportScheduleToExcel, parseScheduleExcel, type ScheduleImportResult } from '@/lib/excel-io';
import { ExcelImportModal, type DiffRow } from '@/components/ExcelImportModal';

import { useTranslations, useLocale } from 'next-intl';

const { Text } = Typography;

interface ProductivityConfigTableProps {
    scheduleData: StepSchedule[];
    onUpdate: (stepId: number, field: 'defaultDays' | 'crews' | 'productivityRate', value: number) => void;
}

export const ProductivityConfigTable: React.FC<ProductivityConfigTableProps> = ({ scheduleData, onUpdate }) => {
    const [searchText, setSearchText] = useState('');
    const [selectedTeam, setSelectedTeam] = useState<string | undefined>(undefined);
    const [activeKeys, setActiveKeys] = useState<string[] | string>([]);
    const [mounted, setMounted] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const { message: messageApi } = App.useApp();
    const screens = Grid.useBreakpoint();
    const isMobile = screens.md === false;
    const t = useTranslations('schedule');
    const locale = useLocale();

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const handleExport = useCallback(async () => {
        try {
            await exportScheduleToExcel(scheduleData);
            messageApi.success('Export สำเร็จ — Productivity_Config.xlsx');
        } catch (error) {
            messageApi.error('เกิดข้อผิดพลาดในการ Export Excel');
            console.error(error);
        }
    }, [scheduleData, messageApi]);

    const handleImportConfirm = useCallback((result: ScheduleImportResult) => {
        for (const row of result.valid) {
            onUpdate(row.stepId, 'defaultDays', row.defaultDays);
            onUpdate(row.stepId, 'crews', row.crews);
            if (row.productivityRate !== null) {
                onUpdate(row.stepId, 'productivityRate', row.productivityRate);
            }
        }
        messageApi.success(`อัปเดต ${result.valid.length} รายการสำเร็จ`);
    }, [onUpdate, messageApi]);

    const buildDiffRows = useCallback((result: ScheduleImportResult): DiffRow[] => {
        const rows: DiffRow[] = [];
        for (const imp of result.valid) {
            const existing = scheduleData.find(s => s.stepId === imp.stepId);
            if (!existing) continue;
            const label = `${String(imp.stepId).padStart(2, '0')} ${existing.title}`;

            if (existing.defaultDays !== imp.defaultDays) {
                rows.push({ key: `${imp.stepId}-days`, label, field: 'ระยะเวลา', oldValue: existing.defaultDays, newValue: imp.defaultDays, changed: true });
            }
            const oldCrews = existing.crews;
            if (oldCrews !== imp.crews) {
                rows.push({ key: `${imp.stepId}-crews`, label, field: 'จำนวนทีม', oldValue: oldCrews, newValue: imp.crews, changed: true });
            }
            if (imp.productivityRate !== null && existing.productivityRate !== imp.productivityRate) {
                rows.push({ key: `${imp.stepId}-rate`, label, field: 'Prod. Rate', oldValue: existing.productivityRate ?? '—', newValue: imp.productivityRate, changed: true });
            }
        }
        return rows;
    }, [scheduleData]);

    const teams = useMemo(() => {
        // Collect unique team keys and grab their localized name from the active dataset
        const teamMap = new Map<string, string>();
        scheduleData.forEach(s => {
            const teamLabel = locale === 'en' && s.teamEn ? s.teamEn : s.team;
            if (!teamMap.has(s.team)) {
                teamMap.set(s.team, teamLabel);
            }
        });
        return Array.from(teamMap.entries()).map(([k, label]) => ({ label, value: k }));
    }, [scheduleData, locale]);

    const filteredData = useMemo(() => {
        return scheduleData.filter(s => {
            const matchSearch = String(s.stepId).includes(searchText) || 
                                s.title.toLowerCase().includes(searchText.toLowerCase()) || 
                                s.titleEn.toLowerCase().includes(searchText.toLowerCase());
            const matchTeam = selectedTeam ? s.team === selectedTeam : true;
            return matchSearch && matchTeam;
        });
    }, [scheduleData, searchText, selectedTeam]);

    // Group by team
    const grouped = useMemo(() => {
        const groups: Record<string, StepSchedule[]> = {};
        
        // Ensure order of teams as they appear in scheduleData
        scheduleData.forEach(s => {
            groups[s.team] ??= [];
        });

        // Populate with filtered matches
        filteredData.forEach(s => {
            groups[s.team]?.push(s);
        });

        return groups;
    }, [scheduleData, filteredData]);

    const searchRef = React.useRef({ text: searchText, team: selectedTeam });

    // Auto-expand panels when searching, but ONLY if search criteria actually changed
    React.useEffect(() => {
        const changed = searchRef.current.text !== searchText || searchRef.current.team !== selectedTeam;
        if (changed) {
            if (searchText || selectedTeam) {
                setActiveKeys(Object.keys(grouped).filter(k => (grouped[k]?.length ?? 0) > 0));
            } else {
                setActiveKeys([]);
            }
            searchRef.current = { text: searchText, team: selectedTeam };
        }
    }, [searchText, selectedTeam, grouped]);

    const columns: ColumnsType<StepSchedule> = [
        {
            title: '#',
            dataIndex: 'stepId',
            key: 'stepId',
            width: 50,
            align: 'center',
            fixed: 'left',
            render: (v: number) => <Text type="secondary" style={{ fontSize: 12 }}>{String(v).padStart(2, '0')}</Text>,
        },
        {
            title: t('prodTask'),
            key: 'title',
            width: 200,
            fixed: 'left',
            render: (_: unknown, r: StepSchedule) => (
                <div>
                    <Text strong style={{ fontSize: 13 }}>
                        {locale === 'en' && r.titleEn ? r.titleEn : r.title}
                    </Text>
                    {locale !== 'en' && (
                        <>
                            <br />
                            <Text type="secondary" style={{ fontSize: 11 }}>{r.titleEn}</Text>
                        </>
                    )}
                </div>
            ),
        },
        // Removed Team column since it's now grouped by team
        {
            title: t('prodDuration'),
            dataIndex: 'defaultDays',
            key: 'defaultDays',
            width: 120,
            align: 'right',
            render: (value: number, record: StepSchedule) => (
                <InputNumber onFocus={(e) => e.target.select()}
                    size="small"
                    value={value}
                    min={0.5}
                    step={0.5}
                    style={{ width: '100%' }}
                    onChange={(val) => onUpdate(record.stepId, 'defaultDays', val ?? 1)}
                />
            ),
        },
        {
            title: t('prodCrews'),
            dataIndex: 'crews',
            key: 'crews',
            width: 110,
            align: 'right',
            render: (value: number, record: StepSchedule) => (
                <InputNumber onFocus={(e) => e.target.select()}
                    size="small"
                    value={value}
                    min={1}
                    style={{ width: '100%' }}
                    onChange={(val) => onUpdate(record.stepId, 'crews', val ?? 1)}
                />
            ),
        },
        {
            title: t('prodCrewSetup'),
            dataIndex: 'crewSetup',
            key: 'crewSetup',
            width: 160,
            render: (v: string, record: StepSchedule) => {
                const initial = INITIAL_SCHEDULE_DATA.find(s => s.stepId === record.stepId);
                const setup = locale === 'en' && record.crewSetupEn ? record.crewSetupEn : (v || initial?.crewSetup);
                return <Text type="secondary" style={{ fontSize: 12 }}>{setup}</Text>;
            },
        },
        {
            title: t('prodRate'),
            dataIndex: 'productivityRate',
            key: 'productivityRate',
            width: 140,
            align: 'right',
            render: (value: number | null, record: StepSchedule) => (
                value !== null ? (
                    <InputNumber onFocus={(e) => e.target.select()}
                        size="small"
                        value={value}
                        min={0.1}
                        step={0.5}
                        style={{ width: '100%' }}
                        onChange={(val) => onUpdate(record.stepId, 'productivityRate', val ?? 1)}
                    />
                ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
                )
            ),
        },
        {
            title: t('prodUnit'),
            dataIndex: 'productivityUnit',
            key: 'productivityUnit',
            width: 100,
            render: (v: string, record: StepSchedule) => {
                const unit = locale === 'en' && record.productivityUnitEn ? record.productivityUnitEn : v;
                return unit ? <Text style={{ fontSize: 12 }}>{unit}</Text> : <Text type="secondary">—</Text>;
            },
        },
        {
            title: t('prodDetails'),
            dataIndex: 'productivity',
            key: 'productivity',
            width: 180,
            render: (v: string, record: StepSchedule) => {
                const desc = locale === 'en' && record.productivityEn ? record.productivityEn : v;
                return <Text type="secondary" style={{ fontSize: 11 }}>{desc}</Text>;
            },
        },
    ];

    const desktopExtra = !isMobile && (
        <Space size="middle">
            <Input
                placeholder={t('prodSearch')}
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                allowClear
                style={{ width: 200 }}
            />
            <Select
                placeholder={<><FilterOutlined /> {t('prodAllTeams')}</>}
                options={teams}
                value={selectedTeam}
                onChange={setSelectedTeam}
                style={{ width: 170 }}
                allowClear
                showSearch
            />
            <Button
                icon={<DownloadOutlined />}
                onClick={handleExport}
                style={{ fontSize: 12, borderColor: '#217346', color: '#217346' }}
                size="small"
            >
                {t('prodExport')}
            </Button>
            <Button
                icon={<UploadOutlined />}
                onClick={() => setImportOpen(true)}
                style={{ fontSize: 12 }}
                size="small"
                type="dashed"
            >
                {t('prodImport')}
            </Button>
        </Space>
    );

    const mobileHeaderActions = isMobile && (
        <div style={{ paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input
                placeholder={t('prodSearch')}
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                allowClear
                size="large"
                style={{ width: '100%', borderRadius: 8 }}
            />
            <Select
                placeholder={<><FilterOutlined /> {t('prodAllTeams')}</>}
                options={teams}
                value={selectedTeam}
                onChange={setSelectedTeam}
                size="large"
                style={{ width: '100%' }}
                allowClear
                showSearch
            />
            <div style={{ display: 'flex', gap: 8 }}>
                <Button
                    icon={<DownloadOutlined />}
                    onClick={handleExport}
                    style={{ flex: 1, borderColor: '#217346', color: '#217346', fontWeight: 500, borderRadius: 8 }}
                >
                    {t('prodExport')}
                </Button>
                <Button
                    icon={<UploadOutlined />}
                    onClick={() => setImportOpen(true)}
                    type="dashed"
                    style={{ flex: 1, fontWeight: 500, borderRadius: 8 }}
                >
                    {t('prodImport')}
                </Button>
            </div>
        </div>
    );

    if (!mounted) return null;

    return (
        <Card
            title={
                <Space>
                    {t('prodTitle')}
                    <Tag color="cyan">{t('prodItems', { count: scheduleData.length })}</Tag>
                </Space>
            }
            extra={desktopExtra}
            style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}
            styles={{ body: { padding: 12, backgroundColor: '#f5f5f5' } }}
        >
            {mobileHeaderActions}
            <div style={{ marginBottom: 16, fontSize: 12, color: '#8c8c8c', background: '#fff', padding: '8px 12px', border: '1px solid #f0f0f0', borderRadius: 6 }}>
                {t('prodInfoBox')}
            </div>
            <Collapse 
                activeKey={activeKeys} 
                onChange={(keys) => setActiveKeys(keys)}
                style={{ background: '#fff' }}
                items={Object.entries(grouped)
                    .filter(([_, items]) => !(searchText && items.length === 0))
                    .map(([team, items]) => {
                        const teamLabel = locale === 'en' && items[0]?.teamEn ? items[0].teamEn : team;
                        return {
                        key: team,
                        label: (
                            <Space>
                                <Tag color={TEAM_COLORS[team] ?? '#888'} style={{ border: 'none', margin: 0, fontSize: 12 }}>
                                    {teamLabel}
                                </Tag>
                                <Text type="secondary" style={{ fontSize: 12 }}>({t('prodItems', { count: items.length })})</Text>
                            </Space>
                        ),
                        children: (
                            <>
                                {/* Mobile View */}
                                <div className="md:hidden flex flex-col gap-3">
                                    {items.map(item => (
                                        <div key={item.stepId} style={{ background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0', padding: 12 }}>
                                            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-start' }}>
                                                <div style={{ background: TEAM_COLORS[team] ?? '#888', color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                                                    {String(item.stepId).padStart(2, '0')}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <Text strong style={{ fontSize: 13 }}>
                                                        {locale === 'en' && item.titleEn ? item.titleEn : item.title}
                                                    </Text>
                                                    {locale !== 'en' && <div style={{ fontSize: 11, color: '#8c8c8c' }}>{item.titleEn}</div>}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', background: '#fafbfc', padding: 10, borderRadius: 6, marginBottom: 8 }}>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <Text type="secondary" style={{ fontSize: 10, marginBottom: 4 }}>{t('prodDurationShort')}</Text>
                                                    <InputNumber onFocus={(e) => e.target.select()} 
                                                        size="small" 
                                                        value={item.defaultDays} 
                                                        min={0.5} step={0.5} 
                                                        onChange={v => onUpdate(item.stepId, 'defaultDays', v ?? 1)} 
                                                        style={{ width: 65 }} 
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <Text type="secondary" style={{ fontSize: 10, marginBottom: 4 }}>{t('prodCrewsShort')}</Text>
                                                    <InputNumber onFocus={(e) => e.target.select()} 
                                                        size="small" 
                                                        value={item.crews} 
                                                        min={1} 
                                                        onChange={v => onUpdate(item.stepId, 'crews', v ?? 1)} 
                                                        style={{ width: 65 }} 
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <Text type="secondary" style={{ fontSize: 10, marginBottom: 4 }}>{t('prodRateShort')}</Text>
                                                    {item.productivityRate !== null ? (
                                                        <InputNumber onFocus={(e) => e.target.select()} 
                                                            size="small" 
                                                            value={item.productivityRate} 
                                                            min={0.1} step={0.5} 
                                                            onChange={v => onUpdate(item.stepId, 'productivityRate', v ?? 1)} 
                                                            style={{ width: 70 }} 
                                                        />
                                                    ) : <Text type="secondary" style={{ padding: '0 8px' }}>—</Text>}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 11, color: '#595959', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Tag style={{ margin: 0, fontSize: 10, padding: '0 4px', border: 'none', background: '#f0f0f0' }}>{t('prodDetailsTag')}</Tag>
                                                {locale === 'en' && item.productivityEn ? item.productivityEn : item.productivity} {
                                                    (locale === 'en' && item.productivityUnitEn) 
                                                        ? `(${item.productivityUnitEn})` 
                                                        : (item.productivityUnit ? `(${item.productivityUnit})` : '')
                                                }
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Desktop View */}
                                <div className="hidden md:block">
                                    <Table
                                        dataSource={items}
                                        columns={columns}
                                        rowKey="stepId"
                                        pagination={false}
                                        size="small"
                                        scroll={{ x: 900 }}
                                    />
                                </div>
                            </>
                        )
                    };
                })}
            />

            <ExcelImportModal<ScheduleImportResult>
                open={importOpen}
                onClose={() => setImportOpen(false)}
                title="นำเข้า Productivity Config จาก Excel"
                parseFile={(file) => parseScheduleExcel(file, scheduleData)}
                getErrors={(r) => r.errors}
                getWarnings={(r) => r.warnings}
                buildDiffRows={buildDiffRows}
                onConfirm={handleImportConfirm}
            />
        </Card>
    );
};
