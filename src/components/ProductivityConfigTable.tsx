'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Table, InputNumber, Typography, Card, Tag, Input, Select, Space, Collapse, Button, App } from 'antd';
import { SearchOutlined, FilterOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { StepSchedule } from '@/data/schedule-data';
import { TEAM_COLORS, SCHEDULE_DATA as INITIAL_SCHEDULE_DATA } from '@/data/schedule-data';
import { exportScheduleToExcel, parseScheduleExcel, type ScheduleImportResult } from '@/lib/excel-io';
import { ExcelImportModal, type DiffRow } from '@/components/ExcelImportModal';

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

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const handleExport = useCallback(() => {
        exportScheduleToExcel(scheduleData);
        messageApi.success('Export สำเร็จ — Productivity_Config.xlsx');
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
        const uniqueTeams = Array.from(new Set(scheduleData.map(s => s.team)));
        return uniqueTeams.map(t => ({ label: t, value: t }));
    }, [scheduleData]);

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
            title: 'รายการงาน (Task)',
            key: 'title',
            width: 200,
            fixed: 'left',
            render: (_: unknown, r: StepSchedule) => (
                <div>
                    <Text strong style={{ fontSize: 13 }}>{r.title}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>{r.titleEn}</Text>
                </div>
            ),
        },
        // Removed Team column since it's now grouped by team
        {
            title: 'ระยะเวลา (วัน)',
            dataIndex: 'defaultDays',
            key: 'defaultDays',
            width: 120,
            align: 'right',
            render: (value: number, record: StepSchedule) => (
                <InputNumber
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
            title: 'จำนวนทีม (Crews)',
            dataIndex: 'crews',
            key: 'crews',
            width: 110,
            align: 'right',
            render: (value: number, record: StepSchedule) => (
                <InputNumber
                    size="small"
                    value={value}
                    min={1}
                    style={{ width: '100%' }}
                    onChange={(val) => onUpdate(record.stepId, 'crews', val ?? 1)}
                />
            ),
        },
        {
            title: 'ทีมประกอบด้วย',
            dataIndex: 'crewSetup',
            key: 'crewSetup',
            width: 160,
            render: (v: string, record: StepSchedule) => <Text type="secondary" style={{ fontSize: 12 }}>{v || INITIAL_SCHEDULE_DATA.find(s => s.stepId === record.stepId)?.crewSetup}</Text>,
        },
        {
            title: 'Productivity Rate',
            dataIndex: 'productivityRate',
            key: 'productivityRate',
            width: 140,
            align: 'right',
            render: (value: number | null, record: StepSchedule) => (
                value !== null ? (
                    <InputNumber
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
            title: 'หน่วย (Unit)',
            dataIndex: 'productivityUnit',
            key: 'productivityUnit',
            width: 100,
            render: (v: string) => v ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>,
        },
        {
            title: 'Productivity (รายละเอียด)',
            dataIndex: 'productivity',
            key: 'productivity',
            width: 180,
            render: (v: string) => <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text>,
        },
    ];

    const titleExtra = (
        <Space size="middle" wrap>
            <Input
                placeholder="ค้นหารายการงาน..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                allowClear
                style={{ width: 200 }}
            />
            <Select
                placeholder={<><FilterOutlined /> ทุกทีม (All Teams)</>}
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
                Export Excel
            </Button>
            <Button
                icon={<UploadOutlined />}
                onClick={() => setImportOpen(true)}
                style={{ fontSize: 12 }}
                size="small"
                type="dashed"
            >
                Import Excel
            </Button>
        </Space>
    );

    if (!mounted) return null;

    return (
        <Card
            title={
                <Space>
                    ตั้งค่า Productivity Rate
                    <Tag color="cyan">{scheduleData.length} รายการงาน</Tag>
                </Space>
            }
            extra={titleExtra}
            style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}
            styles={{ body: { padding: 12, backgroundColor: '#f5f5f5' } }}
        >
            <div style={{ marginBottom: 16, fontSize: 12, color: '#8c8c8c', background: '#fff', padding: '8px 12px', border: '1px solid #f0f0f0', borderRadius: 6 }}>
                ปรับระยะเวลา, จำนวนคนงาน, และ Productivity Rate สำหรับแต่ละรายการ — ข้อมูลเริ่มต้นอ้างอิงจาก คู่มือ 4 (บ้าน คสล. 1 ชั้น 128 ตร.ม.)
            </div>
            <Collapse 
                activeKey={activeKeys} 
                onChange={(keys) => setActiveKeys(keys)}
                style={{ background: '#fff' }}
                items={Object.entries(grouped)
                    .filter(([_, items]) => !(searchText && items.length === 0))
                    .map(([team, items]) => ({
                        key: team,
                        label: (
                            <Space>
                                <Tag color={TEAM_COLORS[team] ?? '#888'} style={{ border: 'none', margin: 0, fontSize: 12 }}>
                                    {team}
                                </Tag>
                                <Text type="secondary" style={{ fontSize: 12 }}>({items.length} รายการ)</Text>
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
                                                    <Text strong style={{ fontSize: 13 }}>{item.title}</Text>
                                                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>{item.titleEn}</div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', background: '#fafbfc', padding: 10, borderRadius: 6, marginBottom: 8 }}>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <Text type="secondary" style={{ fontSize: 10, marginBottom: 4 }}>ระยะเวลา</Text>
                                                    <InputNumber 
                                                        size="small" 
                                                        value={item.defaultDays} 
                                                        min={0.5} step={0.5} 
                                                        onChange={v => onUpdate(item.stepId, 'defaultDays', v ?? 1)} 
                                                        style={{ width: 65 }} 
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <Text type="secondary" style={{ fontSize: 10, marginBottom: 4 }}>จำนวนทีม</Text>
                                                    <InputNumber 
                                                        size="small" 
                                                        value={item.crews} 
                                                        min={1} 
                                                        onChange={v => onUpdate(item.stepId, 'crews', v ?? 1)} 
                                                        style={{ width: 65 }} 
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <Text type="secondary" style={{ fontSize: 10, marginBottom: 4 }}>Prod. Rate</Text>
                                                    {item.productivityRate !== null ? (
                                                        <InputNumber 
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
                                                <Tag style={{ margin: 0, fontSize: 10, padding: '0 4px', border: 'none', background: '#f0f0f0' }}>Details</Tag>
                                                {item.productivity} {item.productivityUnit ? `(${item.productivityUnit})` : ''}
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
                    }))}
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
