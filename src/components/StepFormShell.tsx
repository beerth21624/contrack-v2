'use client';

import React, { useState } from 'react';
import {
    Button, Divider, Table, Collapse, Typography, Tag, Space,
} from 'antd';
import {
    ArrowLeftOutlined, WarningOutlined,
    CheckCircleOutlined, CaretRightOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { type StepResult } from '@/types';
import { useAppStore } from '@/lib/store';
import { buildBOQSections, type SectionRow } from '@/lib/boq-mapper';
import { useTranslations, useLocale } from 'next-intl';

const { Title, Text } = Typography;

interface QuantityRow {
    key: string;
    label: string;
    qty: string;
    uom: string;
}

interface StepFormShellProps {
    stepId: number;
    title: string;
    titleEn: string;
    result: StepResult | null;
    onSave: () => void;
    onCalculate?: () => Promise<void> | void;
    onBack?: () => void;
    children: React.ReactNode;
    optionalChildren?: React.ReactNode;
}

export const StepFormShell: React.FC<StepFormShellProps> = ({
    stepId, title, titleEn, result, onSave, onBack, children, optionalChildren,
}) => {
    const [optOpen, setOptOpen] = useState<string[]>([]);
    const t = useTranslations('common.stepForm');
    const tQty = useTranslations('quantities');
    const tItems = useTranslations('boqItems');
    const locale = useLocale();

    const isEn = locale === 'en';
    const mainTitle = isEn ? titleEn : title;
    const subTitle = isEn ? title : titleEn;

    const qtyColumns: ColumnsType<QuantityRow> = [
        { title: t('colDesc'), dataIndex: 'label', key: 'label', ellipsis: true },
        { title: t('colQty'), dataIndex: 'qty', key: 'qty', align: 'right', width: 100 },
        { title: t('colUnit'), dataIndex: 'uom', key: 'uom', align: 'center', width: 60 },
    ];

    const qtyRows: QuantityRow[] = result
        ? Object.entries(result.quantities).map(([k, v]) => ({
            key: k,
            label: tQty.has(k) ? tQty(k) : v.label,
            qty: v.qty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            uom: v.uom,
        }))
        : [];

    const priceList = useAppStore(state => state.priceList);
    const boqSections = result ? buildBOQSections({ [stepId]: { res: result } }, priceList) : [];
    const boqSection = boqSections.find(s => s.stepNo === stepId) ?? null;
    const priceRows = boqSection?.rows ?? [];
    const stepTotal = boqSection?.sectionTotal ?? 0;

    const priceColumns: ColumnsType<SectionRow> = [
        { 
            title: t('colItem'), dataIndex: 'name', key: 'name', ellipsis: true,
            render: (v: string, r: SectionRow) => tItems.has(r.code) ? tItems(r.code) : v
        },
        { title: t('colTotal'), dataIndex: 'total', key: 'total', align: 'right', width: 100, render: (v: number | null) => v ? v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-' },
    ];

    return (
        <div style={{ width: '100%', margin: '0 auto' }}>

            {/* ── Header ── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
                background: '#fff', border: '1px solid #e8e8e8',
                borderLeft: '3px solid transparent',
                borderImage: 'linear-gradient(to bottom, #fa8c16, #ffa940) 1',
                borderImageSlice: 1,
                borderRadius: 0, padding: '16px 20px',
                boxShadow: '0 2px 8px rgba(0,0,0,.06)',
                flexWrap: 'wrap',
            }}>
                <Button icon={<ArrowLeftOutlined />} onClick={onBack} size="middle" style={{ borderRadius: 6 }} />
                <div style={{ lineHeight: 1.3, minWidth: 0, flex: 1 }}>
                    <span style={{
                        fontSize: 12, fontWeight: 700, letterSpacing: 1,
                        color: '#fa8c16', textTransform: 'uppercase',
                    }}>
                        {t('stepLabel')} {String(stepId).padStart(2, '0')}
                    </span>
                    <Title level={4} style={{ margin: 0, color: '#1f1f1f' }}>{mainTitle}</Title>
                    <Text type="secondary" style={{ fontSize: 13 }}>{subTitle}</Text>
                </div>
            </div>

            {/* ── Body: 1-col on mobile, 12-col grid on lg+ ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* Left: Inputs (50% on large screens) */}
                <div className="lg:col-span-6 flex flex-col gap-4">
                    <div style={{
                        background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12,
                        padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,.03)',
                    }}>
                        <Text strong style={{ fontSize: 14, color: '#262626' }}>
                            {t('requiredInfo')} <Tag color="red" style={{ fontSize: 11, marginLeft: 8 }}>{t('requiredTag')}</Tag>
                        </Text>
                        <Divider style={{ margin: '14px 0' }} />
                        <Space orientation="vertical" style={{ width: '100%' }} size={16}>
                            {children}
                        </Space>
                    </div>

                    {/* Optional inputs accordion */}
                    {optionalChildren && (
                        <Collapse
                            activeKey={optOpen}
                            onChange={(k) => setOptOpen(k)}
                            expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
                            ghost
                            style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,.03)' }}
                            items={[
                                {
                                    key: 'opt',
                                    label: (
                                        <Text strong style={{ fontSize: 14, color: '#595959' }}>
                                            {t('optionalInfo')}
                                        </Text>
                                    ),
                                    children: (
                                        <div style={{ padding: '0 8px 8px' }}>
                                            <Space orientation="vertical" style={{ width: '100%' }} size={16}>
                                                {optionalChildren}
                                            </Space>
                                        </div>
                                    )
                                }
                            ]}
                        />
                    )}
                </div>

                {/* Right: Live Results (50% on large screens) */}
                <div className="lg:col-span-6" style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 24 }}>

                    {/* Quantity Preview */}
                    <div style={{
                        background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10,
                        padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,.05)',
                    }}>
                        <Text strong style={{ fontSize: 13, color: '#595959' }}>{t('previewQty')}</Text>
                        <Divider style={{ margin: '8px 0' }} />
                        {result ? (
                            <div className="table-scroll-wrapper" style={{ overflowX: 'auto' }}>
                                <Table
                                    dataSource={qtyRows}
                                    columns={qtyColumns}
                                    pagination={false}
                                    size="small"
                                    bordered={false}
                                    style={{ fontSize: 13 }}
                                    scroll={{ x: 'max-content' }}
                                />
                            </div>
                        ) : (
                            <Text type="secondary" style={{ fontSize: 13 }}>{t('fillLeft')}</Text>
                        )}
                    </div>

                    {/* Price Preview */}
                    {priceRows.length > 0 && (
                        <div style={{
                            background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10,
                            padding: '16px 18px', boxShadow: '0 1px 6px rgba(0,0,0,.05)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <Text strong style={{ fontSize: 13, color: '#595959' }}>{t('previewCost')}</Text>
                                <Text strong style={{ fontSize: 15, color: '#fa8c16' }}>฿ {stepTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                            </div>
                            <Divider style={{ margin: '8px 0' }} />
                            <div className="table-scroll-wrapper" style={{ overflowX: 'auto' }}>
                                <Table
                                    dataSource={priceRows}
                                    columns={priceColumns}
                                    pagination={false}
                                    size="small"
                                    bordered={false}
                                    style={{ fontSize: 13 }}
                                    scroll={{ x: 'max-content' }}
                                />
                            </div>
                        </div>
                    )}

                    {/* QC Flags (Removed as per user request to focus on input/qty) */}

                    {/* Warnings */}
                    {result && result.warnings.length > 0 && (
                        <div style={{
                            background: '#fffbf0',
                            border: '1px solid #ffe58f',
                            borderLeft: '4px solid #faad14',
                            borderRadius: '6px',
                            padding: '14px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <WarningOutlined style={{ color: '#faad14', fontSize: 16 }} />
                                <Text strong style={{ color: '#d48806', fontSize: 14 }}>
                                    {t('warnings')}
                                </Text>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 2 }}>
                                {result.warnings.map((w, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                        <div style={{ 
                                            width: 5, height: 5, 
                                            borderRadius: '50%', 
                                            background: '#faad14', 
                                            marginTop: 7,
                                            flexShrink: 0
                                        }} />
                                        <Text style={{ fontSize: 13, color: '#875d04', lineHeight: '1.5' }}>
                                            {w}
                                        </Text>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Save button */}
                    <Button
                        type="primary"
                        size="large"
                        icon={<CheckCircleOutlined />}
                        disabled={!result}
                        onClick={onSave}
                        style={{ width: '100%', fontWeight: 600 }}
                    >
                        {t('saveToBoq')}
                    </Button>
                </div>
            </div>
        </div>
    );
};
