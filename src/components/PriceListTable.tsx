import React, { useState, useMemo, useCallback } from 'react';
import { Table, InputNumber, Typography, Card, Input, Collapse, Space, Tag, Button, App } from 'antd';
import { SearchOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { type PriceItem } from '@/types';
import { useTranslations } from 'next-intl';
import { exportPriceListToExcel, parsePriceListExcel, type PriceImportResult } from '@/lib/excel-io';
import { ExcelImportModal, type DiffRow } from '@/components/ExcelImportModal';

const { Text } = Typography;

interface PriceListTableProps {
    prices: PriceItem[];
    onUpdate: (code: string, field: 'costMaterial' | 'costLabor', value: number) => void;
}

export const PriceListTable: React.FC<PriceListTableProps> = ({ prices, onUpdate }) => {
    const [searchText, setSearchText] = useState('');
    const [activeKeys, setActiveKeys] = useState<string[] | string>([]);
    const [importOpen, setImportOpen] = useState(false);
    const t = useTranslations('priceList');
    const tCat = useTranslations('categories');
    const { message: messageApi } = App.useApp();

    const handleExport = useCallback(() => {
        exportPriceListToExcel(prices);
        messageApi.success('Export สำเร็จ — Price_List.xlsx');
    }, [prices, messageApi]);

    const handleImportConfirm = useCallback((result: PriceImportResult) => {
        for (const row of result.valid) {
            onUpdate(row.code, 'costMaterial', row.costMaterial);
            onUpdate(row.code, 'costLabor', row.costLabor);
        }
        messageApi.success(`อัปเดตราคา ${result.valid.length} รายการสำเร็จ`);
    }, [onUpdate, messageApi]);

    const buildDiffRows = useCallback((result: PriceImportResult): DiffRow[] => {
        const rows: DiffRow[] = [];
        const fmt = (v: number) => v.toLocaleString('th-TH', { maximumFractionDigits: 0 });
        for (const imp of result.valid) {
            const existing = prices.find(p => p.code === imp.code);
            if (!existing) continue;
            const label = `${existing.code} ${existing.name}`;

            if (existing.costMaterial !== imp.costMaterial) {
                rows.push({ key: `${imp.code}-mat`, label, field: 'ค่าวัสดุ', oldValue: fmt(existing.costMaterial), newValue: fmt(imp.costMaterial), changed: true });
            }
            if (existing.costLabor !== imp.costLabor) {
                rows.push({ key: `${imp.code}-lab`, label, field: 'ค่าแรง', oldValue: fmt(existing.costLabor), newValue: fmt(imp.costLabor), changed: true });
            }
        }
        return rows;
    }, [prices]);

    // 1. Filter all prices by search
    const filteredPrices = useMemo(() => {
        if (!searchText) return prices;
        const lower = searchText.toLowerCase();
        return prices.filter(p =>
            p.name.toLowerCase().includes(lower) ||
            p.code.toLowerCase().includes(lower) ||
            // Also search by translated category name
            (tCat.has(p.category) ? tCat(p.category as never).toLowerCase().includes(lower) : false)
        );
    }, [prices, searchText, tCat]);

    // 2. Group by category
    const grouped = useMemo(() => {
        const groups: Record<string, PriceItem[]> = {};
        // Use all prices to maintain category order even if empty during search
        prices.forEach(p => {
            groups[p.category] ??= [];
        });
        
        // Fill matches
        filteredPrices.forEach(p => {
            groups[p.category]?.push(p);
        });

        return groups;
    }, [prices, filteredPrices]);

    // 3. Auto-expand panels when searching
    const prevSearchRef = React.useRef(searchText);
    React.useEffect(() => {
        if (prevSearchRef.current === searchText) return; // skip if only grouped changed
        prevSearchRef.current = searchText;
        if (searchText) {
            setActiveKeys(Object.keys(grouped).filter(k => (grouped[k]?.length ?? 0) > 0));
        } else {
            setActiveKeys([]);
        }
    }, [searchText, grouped]);

    const columns: ColumnsType<PriceItem> = [
        {
            title: t('code'),
            dataIndex: 'code',
            key: 'code',
            width: 100,
            render: (text) => <Text type="secondary" code style={{ fontSize: 12 }}>{text}</Text>
        },
        {
            title: t('itemName'),
            dataIndex: 'name',
            key: 'name',
            render: (text) => <Text style={{ fontSize: 13 }}>{text}</Text>
        },
        {
            title: t('unit'),
            dataIndex: 'uom',
            key: 'uom',
            width: 80,
            align: 'center',
            render: (text) => <Text style={{ fontSize: 13 }}>{text}</Text>
        },
        {
            title: t('material'),
            dataIndex: 'costMaterial',
            key: 'costMaterial',
            width: 140,
            align: 'right',
            render: (value: number, record: PriceItem) => (
                <InputNumber
                    size="small"
                    value={value}
                    min={0}
                    style={{ width: '100%' }}
                    formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={val => val?.replace(/\$\s?|(,*)/g, '') as unknown as number}
                    onChange={(val) => onUpdate(record.code, 'costMaterial', val ?? 0)}
                />
            )
        },
        {
            title: t('labor'),
            dataIndex: 'costLabor',
            key: 'costLabor',
            width: 140,
            align: 'right',
            render: (value: number, record: PriceItem) => (
                <InputNumber
                    size="small"
                    value={value}
                    min={0}
                    style={{ width: '100%' }}
                    formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={val => val?.replace(/\$\s?|(,*)/g, '') as unknown as number}
                    onChange={(val) => onUpdate(record.code, 'costLabor', val ?? 0)}
                />
            )
        },
    ];

    const titleExtra = (
        <Space size="middle" wrap>
            <Input
                placeholder={t('searchPlaceholder')}
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                allowClear
                style={{ width: 250 }}
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

    return (
        <Card title={
            <Space>
                {t('title')}
                <Tag color="blue">{t('itemCount', { count: prices.length })}</Tag>
            </Space>
        } 
              extra={titleExtra}
              style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}
              styles={{ body: { padding: 12, backgroundColor: '#f5f5f5' } }}
        >
            <Collapse 
                activeKey={activeKeys} 
                onChange={(keys) => setActiveKeys(keys)}
                style={{ background: '#fff' }}
                items={Object.entries(grouped)
                    .filter(([_, items]) => !(searchText && items.length === 0))
                    .map(([category, items]) => ({
                        key: category,
                        label: (
                            <Text strong>
                                {tCat.has(category) ? tCat(category as never) : category}
                                {' '}
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    ({items.length} {t('itemCount', { count: items.length }).split(' ').pop()})
                                </Text>
                            </Text>
                        ),
                        children: (
                            <Table
                                dataSource={items}
                                columns={columns}
                                rowKey="code"
                                pagination={false}
                                size="small"
                                scroll={{ x: 600 }}
                            />
                        )
                    }))}
            />

            <ExcelImportModal<PriceImportResult>
                open={importOpen}
                onClose={() => setImportOpen(false)}
                title="นำเข้า Price List จาก Excel"
                parseFile={(file) => parsePriceListExcel(file, prices)}
                getErrors={(r) => r.errors}
                getWarnings={(r) => r.warnings}
                buildDiffRows={buildDiffRows}
                onConfirm={handleImportConfirm}
            />
        </Card>
    );
};
