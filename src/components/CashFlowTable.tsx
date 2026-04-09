'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Table, Card, Typography, InputNumber, Divider, Tag, Tooltip, Collapse, Space, Button, Input, Popconfirm, App, Popover, Grid } from 'antd';
import {
    DollarOutlined, BankOutlined,
    WarningOutlined, CheckCircleFilled, PlusOutlined, DeleteOutlined,
    UndoOutlined, FilePdfOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
    buildCashFlow,
    DEFAULT_CASHFLOW_CONFIG,
    type CashFlowConfig,
    type CashFlowResult,
    type WeeklyCashFlow,
    type Installment,
} from '@/lib/cashflow-engine';
import type { StepSchedule } from '@/data/schedule-data';
import type { StepResult, PriceItem } from '@/types';
import { useAppStore } from '@/lib/store';
import { useTranslations } from 'next-intl';
import { useAppLocale } from '@/i18n/LocaleProvider';

const { Text } = Typography;

const fmt = (v: number) => v.toLocaleString('th-TH', { maximumFractionDigits: 0 });
const fmtPct = (v: number) => `${v.toFixed(0)}%`;

interface CashFlowTableProps {
    stepSaves: Record<number, { inp?: unknown; res: StepResult } | undefined>;
    priceList: PriceItem[];
    scheduleData: StepSchedule[];
}

export const CashFlowTable: React.FC<CashFlowTableProps> = ({ stepSaves, priceList, scheduleData }) => {
    const { message: messageApi } = App.useApp();
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.md;
    const scheduleConfig = useAppStore(state => state.scheduleConfig);
    const financialConfig = useAppStore(state => state.financialConfig);
    const [config, setConfig] = useState<CashFlowConfig>({ ...DEFAULT_CASHFLOW_CONFIG });
    const t = useTranslations('schedule');
    const { locale } = useAppLocale();

    const [downloading, setDownloading] = useState(false);

    const result: CashFlowResult = useMemo(
        () => buildCashFlow(stepSaves as Record<number, { inp?: unknown; res: StepResult } | undefined>, priceList, scheduleData, config, scheduleConfig, financialConfig),
        [stepSaves, priceList, scheduleData, config, scheduleConfig, financialConfig],
    );

    const updateInstallment = (idx: number, field: keyof Installment, value: number | string) => {
        const safeValue = typeof value === 'number' && isNaN(value) ? 0 : value;
        setConfig(prev => {
            const newInst = [...prev.installments];
            newInst[idx] = { ...newInst[idx], [field]: safeValue } as Installment;
            return { ...prev, installments: newInst };
        });
    };

    /* ── Installment management ── */
    const addInstallment = () => {
        setConfig(prev => {
            const lastWeek = prev.installments.length > 0
                ? Math.max(...prev.installments.map(i => i.triggerWeek))
                : 0;
            return {
                ...prev,
                installments: [
                    ...prev.installments,
                    { label: t('cfInstLabel', { idx: prev.installments.length }), percent: 0.05, triggerWeek: lastWeek + 2 },
                ],
            };
        });
    };

    const removeInstallment = (idx: number) => {
        setConfig(prev => ({
            ...prev,
            installments: prev.installments.filter((_, i) => i !== idx),
        }));
    };

    const resetInstallments = () => {
        setConfig(prev => ({
            ...prev,
            installments: [...DEFAULT_CASHFLOW_CONFIG.installments],
            creditTermDays: DEFAULT_CASHFLOW_CONFIG.creditTermDays
        }));
    };

    const installmentTotalPercent = config.installments.reduce((s, i) => s + i.percent, 0);
    const isPercentValid = Math.abs(installmentTotalPercent - 1.0) < 0.005;

    /* ── Quotation PDF download ── */
    const handleDownloadQuotationPdf = useCallback(async () => {
        if (typeof window === 'undefined') return;
        setDownloading(true);
        const hide = messageApi.loading(t('cfPdfLoading'), 0);
        try {
            const response = await fetch('/api/cashflow/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    result: {
                        totalConstructionCost: result.totalConstructionCost,
                        quotationPrice: result.quotationPrice,
                        totalProfit: result.totalProfit,
                        totalOperating: result.totalOperating,
                        totalCashIn: result.totalCashIn,
                        totalCashOut: result.totalCashOut,
                        minCashBalance: result.minCashBalance,
                        minCashWeek: result.minCashWeek,
                    },
                    config,
                    weeks: result.weeks,
                    financialConfig,
                    locale,
                }),
            });

            const contentType = response.headers.get('content-type') ?? '';
            if (!response.ok || !contentType.includes('application/pdf')) {
                let errorMessage = t('cfPdfError');
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
            link.download = 'Quotation-CashFlow.pdf';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            messageApi.success(t('cfPdfSuccess'));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t('cfPdfFail');
            messageApi.error(errorMessage);
        } finally {
            hide();
            setDownloading(false);
        }
    }, [result, config, messageApi, financialConfig, locale, t]);

    // Chart bar max
    const maxVal = Math.max(
        ...result.weeks.map(w => Math.max(Math.abs(w.cashIn), Math.abs(w.cashOut), Math.abs(w.cumulative))),
        1,
    );

    /* ── Columns ── */
    const columns: ColumnsType<WeeklyCashFlow> = [
        {
            title: t('cfColWeek'),
            dataIndex: 'weekNumber',
            key: 'week',
            width: 75,
            align: 'center',
            fixed: 'left',
            render: (v: number) => <Text strong style={{ fontSize: 12 }}>W{v}</Text>,
        },
        {
            title: <span style={{ color: '#52c41a' }}>{t('cfColCashIn')}</span>,
            dataIndex: 'cashIn',
            key: 'cashIn',
            width: 130,
            align: 'right',
            render: (v: number, r: WeeklyCashFlow) => (
                v > 0 ? (
                    <Tooltip title={r.cashInItems.join(', ')}>
                        <Text strong style={{ color: '#52c41a' }}>+฿{fmt(v)}</Text>
                    </Tooltip>
                ) : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
            ),
        },
        {
            title: t('cfColInstallment'),
            key: 'items',
            width: 110,
            responsive: ['md'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[],
            render: (_: unknown, r: WeeklyCashFlow) => (
                r.cashInItems.length > 0 ? (
                    <Tag color="green" style={{ fontSize: 10, margin: 0 }}>{r.cashInItems.join(', ')}</Tag>
                ) : null
            ),
        },
        {
            title: <span style={{ color: '#ff4d4f' }}>{t('cfColCashOut')}</span>,
            dataIndex: 'cashOut',
            key: 'cashOut',
            width: 130,
            align: 'right',
            render: (v: number, r: WeeklyCashFlow) => {
                if (v <= 0) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
                const content = (
                    <div style={{ fontSize: 12 }}>
                        {r.stepBreakdown.map((s, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                                <span>{s.title}</span>
                                <strong>฿{fmt(s.cost)}</strong>
                            </div>
                        ))}
                        <Divider style={{ margin: '4px 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: '#8c8c8c' }}>
                            <span>{t('cfColOperating')}</span>
                            <strong>฿{fmt(r.operatingCost)}</strong>
                        </div>
                    </div>
                );
                return (
                    <Popover title={<span style={{ fontSize: 13 }}>{t('cfTtOutDetail') || 'รายละเอียดรายจ่าย'}</span>} content={content} trigger="hover" placement="bottomRight" styles={{ root: { maxWidth: 320 } }}>
                        <Text style={{ color: '#ff4d4f', cursor: 'pointer', borderBottom: '1px dashed #ff4d4f' }}>-฿{fmt(v)}</Text>
                    </Popover>
                );
            },
        },
        {
            title: t('cfColCost'),
            dataIndex: 'constructionCost',
            key: 'constr',
            width: 110,
            align: 'right',
            responsive: ['lg'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[],
            render: (v: number) => v > 0 ? <Text style={{ fontSize: 11 }}>฿{fmt(v)}</Text> : <Text type="secondary">—</Text>,
        },
        {
            title: t('cfColOperating'),
            dataIndex: 'operatingCost',
            key: 'oper',
            width: 100,
            align: 'right',
            responsive: ['lg'] as ('xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')[],
            render: (v: number) => v > 0 ? <Text style={{ fontSize: 11, color: '#8c8c8c' }}>฿{fmt(v)}</Text> : <Text type="secondary">—</Text>,
        },
        {
            title: t('cfColNet'),
            dataIndex: 'netWeekly',
            key: 'net',
            width: 120,
            align: 'right',
            render: (v: number) => (
                v === 0 ? <Text type="secondary">—</Text> :
                <Text strong style={{ color: v > 0 ? '#52c41a' : '#ff4d4f', fontSize: 12 }}>
                    {v > 0 ? '+' : ''}฿{fmt(v)}
                </Text>
            ),
        },
        {
            title: <span style={{ color: '#1890ff', fontWeight: 700 }}>{t('cfColCumulative')}</span>,
            dataIndex: 'cumulative',
            key: 'cumul',
            width: 150,
            align: 'right',
            render: (v: number, record: WeeklyCashFlow) => {
                // If week is inactive, just show dash and empty bar
                if (record.cashIn === 0 && record.cashOut === 0) {
                    return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                            <Text type="secondary" style={{ fontSize: 13 }}>—</Text>
                            <div style={{ width: 40, height: 10 }} />
                        </div>
                    );
                }
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                        <Text strong style={{ color: v >= 0 ? '#1890ff' : '#ff4d4f', fontSize: 13 }}>
                            ฿{fmt(v)}
                        </Text>
                        {/* Mini bar */}
                        <div style={{
                            width: 40,
                            height: 10,
                            background: '#f0f0f0',
                            borderRadius: 2,
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                width: `${Math.min(Math.abs(v) / maxVal * 100, 100)}%`,
                                height: '100%',
                                background: v >= 0 ? '#1890ff' : '#ff4d4f',
                                borderRadius: 2,
                            }} />
                        </div>
                    </div>
                );
            },
        },
    ];

    return (
        <div style={{ width: '100%', margin: '0 auto' }}>
            {/* ── Config Panel ── */}
            <Collapse
                size="small"
                style={{ marginBottom: 16, borderRadius: 10 }}
                items={[{
                    key: 'config',
                    label: <span><BankOutlined /> {t('cfConfigTitle')}</span>,
                    children: (
                        <div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
                                <div style={{ background: '#f5f5f5', padding: '10px 16px', borderRadius: 8, flex: '1 1 300px', border: '1px solid #e8e8e8' }}>
                                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                                        {t('cfConfigParams')}
                                    </Text>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px' }}>
                                        <Text strong>{t('cfConfigOverhead', { pct: financialConfig.overheadPercent })}</Text>
                                        <Text strong>{t('cfConfigProfit', { pct: financialConfig.profitPercent })}</Text>
                                        <Text strong style={{ color: '#1890ff' }}>
                                            {t('cfConfigMarkup', { pct: financialConfig.overheadPercent + financialConfig.profitPercent })}
                                        </Text>
                                    </div>
                                </div>

                                <div style={{ background: '#fffbe6', padding: '10px 16px', borderRadius: 8, flex: '1 1 300px', border: '1px solid #ffe58f' }}>
                                    <Text type="warning" strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                                        {t('cfConfigCreditTitle')}
                                    </Text>
                                    <Space size="middle" align="center" wrap>
                                        <Text>{t('cfConfigCreditAvg')}</Text>
                                        <InputNumber
                                            min={0} max={365}
                                            value={config.creditTermDays}
                                            onChange={(v) => setConfig(prev => ({ ...prev, creditTermDays: v ?? 0 }))}
                                            size="small"
                                            style={{ width: 80 }}
                                        />
                                        <Tooltip title={t('cfConfigCreditTip')}>
                                            <span style={{ cursor: 'help', color: '#fa8c16' }}>ℹ️</span>
                                        </Tooltip>
                                    </Space>
                                </div>
                            </div>

                            <Divider style={{ margin: '8px 0' }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Text strong style={{ fontSize: 13 }}>{t('cfInstallmentTable')}</Text>
                                <Space size="small">
                                    <Button
                                        size="small"
                                        icon={<UndoOutlined />}
                                        onClick={resetInstallments}
                                        style={{ fontSize: 11 }}
                                    >
                                        {t('cfResetBtn')}
                                    </Button>
                                    <Button
                                        size="small"
                                        type="dashed"
                                        icon={<PlusOutlined />}
                                        onClick={addInstallment}
                                        style={{ fontSize: 11 }}
                                    >
                                        {t('cfAddBtn')}
                                    </Button>
                                </Space>
                            </div>

                            {/* Installment % validation bar */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                marginBottom: 8,
                                padding: '6px 10px',
                                borderRadius: 6,
                                background: isPercentValid ? '#f6ffed' : '#fff2f0',
                                border: `1px solid ${isPercentValid ? '#b7eb8f' : '#ffccc7'}`,
                                fontSize: 12,
                            }}>
                                {isPercentValid
                                    ? <CheckCircleFilled style={{ color: '#52c41a' }} />
                                    : <WarningOutlined style={{ color: '#ff4d4f' }} />
                                }
                                <span style={{ color: isPercentValid ? '#389e0d' : '#cf1322' }}>
                                    {t('cfTotalPercent')}<strong>{(installmentTotalPercent * 100).toFixed(0)}%</strong>
                                    {!isPercentValid && <span>{t('cfPercentWarning')}</span>}
                                </span>
                            </div>

                            <div className="table-scroll-wrapper" style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 500 }}>
                                    <thead>
                                        <tr style={{ background: '#fafafa', borderBottom: '1px solid #e8e8e8' }}>
                                            <th style={{ padding: '6px 8px', textAlign: 'left', width: '30%' }}>{t('cfInstName')}</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'center' }}>{t('cfInstPct')}</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'center' }}>{t('cfInstWeek')}</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'right' }}>{t('cfInstAmt')}</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'center', width: 50 }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {config.installments.map((inst, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                                                <td style={{ padding: '4px 8px' }}>
                                                    <Input
                                                        value={inst.label}
                                                        size="small"
                                                        style={{ width: '100%', fontSize: 13, height: 30 }}
                                                        onChange={(e) => updateInstallment(i, 'label', e.target.value)}
                                                    />
                                                </td>
                                                <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                                    <InputNumber
                                                        value={inst.percent * 100}
                                                        min={0} max={100} step={5} size="small"
                                                        style={{ width: 70, fontSize: 13, height: 30 }}
                                                        formatter={(v) => `${v}%`}
                                                        parser={(v) => Number(v?.replace('%', '') ?? 0)}
                                                        onChange={(v) => updateInstallment(i, 'percent', (v ?? 0) / 100)}
                                                    />
                                                </td>
                                                <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                                    <InputNumber
                                                        value={inst.triggerWeek}
                                                        min={1} max={52} size="small"
                                                        style={{ width: 60, fontSize: 13, height: 30 }}
                                                        onChange={(v) => updateInstallment(i, 'triggerWeek', v ?? 1)}
                                                    />
                                                </td>
                                                <td style={{ padding: '4px 8px', textAlign: 'right', color: '#389e0d', fontWeight: 600 }}>
                                                    ฿{fmt(result.quotationPrice * inst.percent)}
                                                </td>
                                                <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                                    {config.installments.length > 1 && (
                                                        <Popconfirm
                                                            title={t('cfInstDelTitle')}
                                                            onConfirm={() => removeInstallment(i)}
                                                            okText={t('cfInstDelBtn')}
                                                            cancelText={t('cfInstCancelBtn')}
                                                            okButtonProps={{ danger: true }}
                                                        >
                                                            <Button
                                                                type="text"
                                                                size="small"
                                                                danger
                                                                icon={<DeleteOutlined />}
                                                                style={{ padding: '0 4px' }}
                                                            />
                                                        </Popconfirm>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ),
                }]}
            />

            {/* ── Action Bar ── */}
            <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginBottom: 16,
            }}>
                <Button
                    type="primary"
                    icon={<FilePdfOutlined />}
                    onClick={handleDownloadQuotationPdf}
                    loading={downloading}
                    style={{
                        background: '#1a1a2e',
                        borderColor: '#1a1a2e',
                        fontWeight: 600,
                        borderRadius: 8,
                    }}
                >
                    {t('cfDownloadPdfBtn')}
                </Button>
            </div>


            {/* ── Visual Chart (SVG S-Curve) ── */}
            <Card
                size="small"
                style={{ marginBottom: 16, borderRadius: 10, overflow: 'hidden' }}
                styles={{ header: { background: '#262626', borderBottom: 'none' }, body: { padding: '12px', background: '#fafafa' } }}
                title={
                    <div style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <DollarOutlined />
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{t('cfChartSCurve')}</span>
                    </div>
                }
            >
                <div style={{ display: 'flex', gap: 16, marginBottom: 12, justifyContent: 'center' }}>
                    <span style={{ fontSize: 11, color: '#595959', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 12, height: 12, background: '#ff4d4f', borderRadius: 2 }} /> {t('cfChartOut')}
                    </span>
                    <span style={{ fontSize: 11, color: '#595959', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 12, height: 12, background: '#52c41a', borderRadius: 2 }} /> {t('cfChartIn')}
                    </span>
                    <span style={{ fontSize: 11, color: '#595959', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 16, height: 3, background: '#1890ff' }} /> {t('cfChartCumul')}
                    </span>
                </div>

                <div className="table-scroll-wrapper" style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8 }}>
                    {(() => {
                        const CHART_HEIGHT = 220;
                        const CHART_MARGIN = { top: 20, right: 30, bottom: 20, left: 30 };
                        const innerHeight = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;

                        const cumulValues = result.weeks.map(w => w.cumulative);
                        const cashInValues = result.weeks.map(w => w.cashIn);
                        const cashOutValues = result.weeks.map(w => -w.cashOut);

                        const dataMax = Math.max(...cumulValues, ...cashInValues, 100);
                        const dataMin = Math.min(...cumulValues, ...cashOutValues, 0);

                        // Prevent Zero division
                        const domainRangeRaw = dataMax - dataMin;
                        const domainRangeSafe = domainRangeRaw === 0 ? 100 : domainRangeRaw;

                        const domainMax = dataMax + domainRangeSafe * 0.1;
                        const domainMin = dataMin - domainRangeSafe * 0.1;
                        const domainRange = domainMax - domainMin;

                        const scaleY = (val: number) => CHART_HEIGHT - CHART_MARGIN.bottom - ((val - domainMin) / domainRange) * innerHeight;
                        const zeroY = scaleY(0);

                        const colWidth = 44; // Give enough width for tooltips
                        const minChartWidth = result.weeks.length * colWidth + CHART_MARGIN.left + CHART_MARGIN.right;

                        const cumulativePoints = result.weeks.map((w, i) => {
                            const cx = CHART_MARGIN.left + i * colWidth + colWidth / 2;
                            const cy = scaleY(w.cumulative);
                            return `${cx},${cy}`;
                        }).join(' ');

                        return (
                            <div style={{ position: 'relative', minWidth: Math.max(600, minChartWidth), height: CHART_HEIGHT }}>
                                <svg width="100%" height="100%">
                                    {/* Negative Zone Background (Cash Flow Gap) */}
                                    {zeroY < CHART_HEIGHT - CHART_MARGIN.bottom && (
                                        <rect
                                            x={0}
                                            y={zeroY}
                                            width="100%"
                                            height={CHART_HEIGHT - CHART_MARGIN.bottom - zeroY}
                                            fill="#fff1f0"
                                        />
                                    )}
                                    {/* Y=0 Baseline */}
                                    <line x1={0} y1={zeroY} x2="100%" y2={zeroY} stroke={zeroY < CHART_HEIGHT - CHART_MARGIN.bottom ? "#ffa39e" : "#d9d9d9"} strokeWidth={2} strokeDasharray="4 4" />

                                    {/* Draw Bars First (Background) */}
                                    {result.weeks.map((w, i) => {
                                        const x = CHART_MARGIN.left + i * colWidth;
                                        const cx = x + colWidth / 2;

                                        const inYRaw = scaleY(w.cashIn);
                                        const inHRaw = Math.max(0, zeroY - inYRaw);
                                        const inH = w.cashIn > 0 ? Math.max(2, inHRaw) : 0;
                                        const inY = w.cashIn > 0 ? zeroY - inH : inYRaw;

                                        const outY = zeroY;
                                        const outHRaw = Math.max(0, scaleY(-w.cashOut) - zeroY);
                                        const outH = w.cashOut > 0 ? Math.max(2, outHRaw) : 0;

                                        return (
                                            <g key={`bars-${w.weekNumber}`}>
                                                {/* Labels at bottom */}
                                                <text x={cx} y={CHART_HEIGHT - 4} fontSize={9} fill="#8c8c8c" textAnchor="middle">
                                                    W{w.weekNumber}
                                                </text>

                                                {/* Bar IN */}
                                                {w.cashIn > 0 && <rect x={cx - 10} y={inY} width={20} height={inH} fill="#52c41a" opacity={0.6} rx={inH > 4 ? 2 : 0} />}
                                                {/* Bar OUT */}
                                                {w.cashOut > 0 && <rect x={cx - 10} y={outY} width={20} height={outH} fill="#ff4d4f" opacity={0.5} rx={outH > 4 ? 2 : 0} />}
                                            </g>
                                        );
                                    })}

                                    {/* S-Curve Line */}
                                    <polyline points={cumulativePoints} fill="none" stroke="#1890ff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

                                    {/* S-Curve Nodes */}
                                    {result.weeks.map((w, i) => {
                                        const cx = CHART_MARGIN.left + i * colWidth + colWidth / 2;
                                        const cy = scaleY(w.cumulative);
                                        return (
                                            <circle key={`dot-${w.weekNumber}`} cx={cx} cy={cy} r={4} fill={w.cumulative >= 0 ? '#1890ff' : '#ff4d4f'} stroke="#fff" strokeWidth={2} />
                                        );
                                    })}

                                    {/* Hover interaction layer with fully restored Tooltips */}
                                    {result.weeks.map((w, i) => {
                                        const x = CHART_MARGIN.left + i * colWidth;
                                        return (
                                            <Tooltip
                                                key={`tt-${w.weekNumber}`}
                                                styles={{ root: { maxWidth: 280 } }}
                                                trigger={isMobile ? [] : ['hover']}
                                                title={
                                                    <div style={{ fontSize: 11, minWidth: 150 }}>
                                                        <div style={{ fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: 4, marginBottom: 4 }}>{w.weekLabel}</div>
                                                        {w.cashIn > 0 && <div style={{ color: '#b7eb8f', fontWeight: 600 }}>IN: +฿{fmt(w.cashIn)}</div>}
                                                        {w.cashOut > 0 && (
                                                            <div style={{ color: '#ffa39e', fontWeight: 600, marginTop: 4 }}>
                                                                OUT: -฿{fmt(w.cashOut)}
                                                                <div style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 400, marginTop: 2, paddingLeft: 8 }}>
                                                                    {w.stepBreakdown.slice(0, 3).map((s, idx) => (
                                                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>{s.title}</span>
                                                                            <span>฿{fmt(s.cost)}</span>
                                                                        </div>
                                                                    ))}
                                                                    {w.stepBreakdown.length > 3 && (
                                                                        <div style={{ fontSize: 10, fontStyle: 'italic' }}>{t('cfTtMore', { count: w.stepBreakdown.length - 3 })}</div>
                                                                    )}
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                                                        <span>{t('cfTtOper')}</span>
                                                                        <span>฿{fmt(w.operatingCost)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div style={{ color: '#91d5ff', fontWeight: 700, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 4, marginTop: 4 }}>
                                                            {t('cfTtCumul')} ฿{fmt(w.cumulative)}
                                                        </div>
                                                    </div>
                                                }
                                            >
                                                <rect x={x} y={0} width={colWidth} height={CHART_HEIGHT} fill="transparent" style={{ cursor: isMobile ? 'default' : 'pointer' }} />
                                            </Tooltip>
                                        );
                                    })}
                                </svg>
                            </div>
                        );
                    })()}
                </div>
            </Card>

            {/* ── Weekly Table ── */}
            <Card
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <DollarOutlined />
                        <span>{t('cfWeeklyDetails')}</span>
                    </div>
                }
                size="small"
                style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}
            >
                <>
                    {/* Mobile Card View */}
                    <div className="md:hidden flex flex-col gap-3 p-3">
                        {result.weeks.map(w => (
                            <div key={w.weekNumber} style={{
                                background: '#fff',
                                borderRadius: 8,
                                border: '1px solid #e8e8e8',
                                padding: '12px',
                                boxShadow: '0 1px 2px rgba(0,0,0,.05)',
                                opacity: w.netWeekly < 0 ? 0.9 : 1
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>W{w.weekNumber}</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: w.netWeekly >= 0 ? '#52c41a' : '#ff4d4f' }}>
                                        {t('cfWeeklyNet')} {w.netWeekly >= 0 ? '+' : ''}฿{fmt(w.netWeekly)}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                                    <div>{t('cfWeeklyIn')} <span style={{ color: '#52c41a', fontWeight: 600 }}>{w.cashIn > 0 ? `+฿${fmt(w.cashIn)}` : '—'}</span></div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        {t('cfWeeklyOut')}
                                        {w.cashOut > 0 ? (
                                            <Popover
                                                title={<span style={{ fontSize: 13 }}>{t('cfPopDetailWeek', { week: w.weekNumber })}</span>}
                                                trigger="click"
                                                placement="bottomRight"
                                                styles={{ root: { maxWidth: 300 } }}
                                                content={
                                                    <div style={{ fontSize: 12 }}>
                                                        {w.stepBreakdown.map((s, idx) => (
                                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                                                                <span>{s.title}</span>
                                                                <strong>฿{fmt(s.cost)}</strong>
                                                            </div>
                                                        ))}
                                                        <Divider style={{ margin: '4px 0' }} />
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: '#8c8c8c' }}>
                                                            <span>{t('cfPopOper')}</span>
                                                            <strong>฿{fmt(w.operatingCost)}</strong>
                                                        </div>
                                                    </div>
                                                }
                                            >
                                                <span style={{ color: '#ff4d4f', fontWeight: 600, cursor: 'pointer', borderBottom: '1px dashed #ff4d4f' }}>
                                                    -฿{fmt(w.cashOut)}
                                                </span>
                                            </Popover>
                                        ) : (
                                            <span style={{ color: '#ff4d4f', fontWeight: 600 }}>—</span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 11, color: '#8c8c8c' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        {t('cfColInstallment')}: {w.cashInItems.length > 0 ? <Tag color="green" style={{ fontSize: 9, margin: 0, padding: '0 4px', lineHeight: '18px' }}>{w.cashInItems.join(', ')}</Tag> : '—'}
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div>{t('cfCostCap')} {w.constructionCost > 0 ? `฿${fmt(w.constructionCost)}` : '—'}</div>
                                        <div>{t('cfOperCap')} {w.operatingCost > 0 ? `฿${fmt(w.operatingCost)}` : '—'}</div>
                                    </div>
                                </div>

                                <div style={{ background: '#fafafa', padding: '8px 12px', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: 11, color: '#595959', fontWeight: 600 }}>{t('cfColCumulative')}</div>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: w.cumulative >= 0 ? '#1890ff' : '#ff4d4f' }}>
                                        ฿{fmt(w.cumulative)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="hidden md:block table-scroll-wrapper" style={{ overflowX: 'auto' }}>
                        <Table
                            dataSource={result.weeks}
                            columns={columns}
                            rowKey="weekNumber"
                            pagination={false}
                            size="small"
                            bordered
                            scroll={{ x: 900 }}
                            rowClassName={(r: WeeklyCashFlow) => r.netWeekly < 0 ? 'cashflow-negative' : ''}
                            summary={() => (
                                <Table.Summary fixed>
                                    <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 700 }}>
                                        <Table.Summary.Cell index={0} align="center">
                                            <Text strong>{t('cfSumAll')}</Text>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={1} align="right">
                                            <Text strong style={{ color: '#52c41a' }}>+฿{fmt(result.totalCashIn)}</Text>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={2}></Table.Summary.Cell>
                                        <Table.Summary.Cell index={3} align="right">
                                            <Text strong style={{ color: '#ff4d4f' }}>-฿{fmt(result.totalCashOut)}</Text>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={4} align="right">
                                            <Text style={{ fontSize: 11 }}>฿{fmt(result.totalConstructionCost)}</Text>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={5} align="right">
                                            <Text style={{ fontSize: 11 }}>฿{fmt(result.totalOperating)}</Text>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={6} align="right">
                                            <Text strong style={{ color: result.totalProfit >= 0 ? '#52c41a' : '#ff4d4f' }}>
                                                ฿{fmt(result.totalCashIn - result.totalCashOut)}
                                            </Text>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={7} align="right">
                                            <Text strong style={{ color: '#1890ff' }}>
                                                ฿{fmt(result.weeks.length > 0 ? (result.weeks[result.weeks.length - 1]?.cumulative ?? 0) : 0)}
                                            </Text>
                                        </Table.Summary.Cell>
                                    </Table.Summary.Row>
                                </Table.Summary>
                            )}
                        />
                    </div>
                </>
            </Card>
            {/* ── Simple Footer Summary Layer ── */}
            <div style={{
                background: '#fff',
                border: '1px solid #f0f0f0',
                borderRadius: 10,
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
                boxShadow: '0 1px 4px rgba(0,0,0,.05)',
                marginTop: 16,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Text strong style={{ fontSize: 16, color: '#262626' }}>{t('cfSummaryTitle')}</Text>
                </div>

                <div style={{ display: 'flex', gap: '16px 24px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>{t('cfSumCost')}</Text>
                        <Text strong style={{ color: '#fa8c16', fontSize: 15 }}>฿{fmt(result.totalConstructionCost)}</Text>
                    </div>
                    {result.totalContingency > 0 && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <Text type="secondary" style={{ fontSize: 13 }}>{locale === 'en' ? 'Contingency' : 'เงินสำรอง'}</Text>
                            <Text strong style={{ color: '#faad14', fontSize: 15 }}>฿{fmt(result.totalContingency)}</Text>
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>{t('cfSumQuote')}</Text>
                        <Text strong style={{ color: '#1890ff', fontSize: 15 }}>฿{fmt(result.quotationPrice)}</Text>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>{t('cfSumProfit', { pct: fmtPct(financialConfig.profitPercent) })}</Text>
                        <Text strong style={{ color: '#52c41a', fontSize: 15 }}>฿{fmt(result.totalProfit)}</Text>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>{t('cfSumMinCash', { week: result.minCashWeek })}</Text>
                        <Text strong style={{ color: result.minCashBalance >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 18 }}>
                            {result.minCashBalance >= 0 ? '+' : '-'}฿{fmt(Math.abs(result.minCashBalance))}
                        </Text>
                    </div>
                </div>
            </div>

        </div>
    );
};
