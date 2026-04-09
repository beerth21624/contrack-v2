'use client';

import React, { useState } from 'react';
import { Calendar, Popover, Typography, Button } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import type { ScheduleItem } from '@/lib/schedule-engine';
import { TEAM_COLORS } from '@/data/schedule-data';
import type { StepResult } from '@/types';

const { Text } = Typography;

interface Props {
    items: ScheduleItem[];
    startDate: Dayjs;
    stepSaves: Record<number, { res: StepResult } | undefined>;
    locale?: "en" | "th";
}

export const ScheduleCalendar: React.FC<Props> = ({ items, startDate, stepSaves, locale }) => {
    const [viewDate, setViewDate] = useState(() => startDate.clone());

    // Determine the active tasks for a specific date
    const getListData = (value: Dayjs) => {
        const listData: ScheduleItem[] = [];
        const currentTarget = value.startOf('day');

        items.forEach(item => {
            const hasData = !!stepSaves[item.stepId];
            if (!hasData) return; // Only show tasks with actual boq data

            const itemStart = startDate.add(item.startDay - 1, 'day').startOf('day').valueOf();
            const itemEnd = startDate.add(item.endDay - 1, 'day').startOf('day').valueOf();
            const currentV = currentTarget.valueOf();

            if (currentV >= itemStart && currentV <= itemEnd) {
                listData.push(item);
            }
        });
        return listData;
    };

    const dateCellRender = (value: Dayjs) => {
        const listData = getListData(value);
        if (listData.length === 0) return null;

        // If many tasks, just show the first 3 and "+ X more"
        const displayList = listData.slice(0, 3);
        const hiddenCount = listData.length - 3;

        const popoverContent = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 300 }}>
                {listData.map(item => (
                    <div key={item.stepId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                            background: TEAM_COLORS[item.team] ?? '#1890ff'
                        }} />
                        <Text style={{ fontSize: 12 }}>
                            {String(item.stepId).padStart(2, '0')} - {locale === 'en' ? item.titleEn : item.title}
                        </Text>
                    </div>
                ))}
            </div>
        );

        return (
            <Popover content={popoverContent} title="Tasks for the day" trigger="hover" placement="right">
                <ul className="events" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {displayList.map((item) => (
                        <li key={item.stepId} style={{ marginBottom: 2 }}>
                            <div style={{
                                fontSize: '10px',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                background: `${TEAM_COLORS[item.team] ?? '#1890ff'}22`,
                                borderLeft: `2px solid ${TEAM_COLORS[item.team] ?? '#1890ff'}`,
                                color: '#333',
                                padding: '0 4px',
                                borderRadius: '2px',
                                lineHeight: '16px'
                            }}>
                                <b>{String(item.stepId).padStart(2, '0')}</b> {locale === 'en' ? item.titleEn : item.title}
                            </div>
                        </li>
                    ))}
                    {hiddenCount > 0 && (
                        <li style={{ fontSize: 10, color: '#8c8c8c', textAlign: 'center' }}>
                            + {hiddenCount} more
                        </li>
                    )}
                </ul>
            </Popover>
        );
    };

    const cellRender = (current: Dayjs, info: { type: string; originNode: React.ReactNode }) => {
        if (info.type === 'date') return dateCellRender(current);
        return info.originNode;
    };

    const headerRender = () => {
        const monthName = viewDate.format('MMMM YYYY');
        
        const goPrevMonth = () => setViewDate(prev => prev.clone().subtract(1, 'month'));
        const goNextMonth = () => setViewDate(prev => prev.clone().add(1, 'month'));

        return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', borderRadius: '10px 10px 0 0' }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a1a' }}>{monthName}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button icon={<LeftOutlined />} onClick={goPrevMonth} />
                    <Button icon={<RightOutlined />} onClick={goNextMonth} />
                </div>
            </div>
        );
    };

    return (
        <div className="schedule-cal-wrapper" style={{ background: '#fff', borderRadius: 10, border: '1px solid #f0f0f0', boxShadow: '0 1px 4px rgba(0,0,0,.05)', overflow: 'hidden' }}>
            <style>{`
                .schedule-cal-wrapper .ant-picker-cell-selected .ant-picker-calendar-date {
                    background: transparent !important;
                }
                .schedule-cal-wrapper .ant-picker-cell-selected .ant-picker-calendar-date-value {
                    color: inherit !important;
                    background: transparent !important;
                }
            `}</style>
            {headerRender()}
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px' }}>
                <div style={{ minWidth: 800 }}>
                    <Calendar mode="month" value={viewDate} headerRender={() => null} cellRender={cellRender} />
                </div>
            </div>
        </div>
    );
};
