'use client';

import { useState, useCallback } from 'react';
import { Modal, Upload, Button, Table, Typography, Tag, Alert, Space, Divider, Empty } from 'antd';
import { FileExcelOutlined, CheckCircleFilled, CloseCircleFilled, WarningFilled, SwapOutlined } from '@ant-design/icons';


const { Text } = Typography;
const { Dragger } = Upload;

/* ──────── Types ──────── */

export interface DiffRow {
    key: string;
    label: string;
    field: string;
    oldValue: string | number;
    newValue: string | number;
    changed: boolean;
}

export interface ImportModalProps<TResult> {
    open: boolean;
    onClose: () => void;
    title: string;
    /** Parse the uploaded file, return validated result */
    parseFile: (file: File) => Promise<TResult>;
    /** Extract errors from parse result */
    getErrors: (result: TResult) => { row: number; field: string; message: string }[];
    /** Extract warnings from parse result */
    getWarnings: (result: TResult) => string[];
    /** Build diff rows for preview table */
    buildDiffRows: (result: TResult) => DiffRow[];
    /** Apply the import — called on confirm */
    onConfirm: (result: TResult) => void;
}

/* ──────── Component ──────── */

export function ExcelImportModal<TResult>({
    open, onClose, title,
    parseFile, getErrors, getWarnings, buildDiffRows, onConfirm,
}: ImportModalProps<TResult>) {
    const [step, setStep] = useState<'upload' | 'preview'>('upload');
    const [_loading, setLoading] = useState(false);
    const [parseResult, setParseResult] = useState<TResult | null>(null);
    const [errors, setErrors] = useState<{ row: number; field: string; message: string }[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [diffRows, setDiffRows] = useState<DiffRow[]>([]);
    const [fileName, setFileName] = useState('');

    const reset = useCallback(() => {
        setStep('upload');
        setParseResult(null);
        setErrors([]);
        setWarnings([]);
        setDiffRows([]);
        setFileName('');
        setLoading(false);
    }, []);

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleFile = async (file: File) => {
        setLoading(true);
        setFileName(file.name);
        try {
            const result = await parseFile(file);
            const errs = getErrors(result);
            const warns = getWarnings(result);
            setParseResult(result);
            setErrors(errs);
            setWarnings(warns);

            if (errs.length === 0) {
                setDiffRows(buildDiffRows(result));
            }
            setStep('preview');
        } catch (err) {
            setErrors([{ row: 0, field: '-', message: err instanceof Error ? err.message : 'ไม่สามารถอ่านไฟล์ได้' }]);
            setStep('preview');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        if (parseResult) {
            onConfirm(parseResult);
        }
        handleClose();
    };

    const changedCount = diffRows.filter(r => r.changed).length;
    const hasErrors = errors.length > 0;

    const diffColumns = [
        {
            title: 'รายการ',
            dataIndex: 'label',
            key: 'label',
            width: 200,
            render: (v: string, r: DiffRow) => (
                <Text style={{ fontWeight: r.changed ? 600 : 400, fontSize: 12 }}>{v}</Text>
            ),
        },
        {
            title: 'ช่อง',
            dataIndex: 'field',
            key: 'field',
            width: 120,
            render: (v: string) => <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text>,
        },
        {
            title: 'ค่าเดิม',
            dataIndex: 'oldValue',
            key: 'oldValue',
            width: 100,
            align: 'right' as const,
            render: (v: string | number, r: DiffRow) => (
                <Text style={{
                    fontSize: 12,
                    color: r.changed ? '#ff4d4f' : '#8c8c8c',
                    textDecoration: r.changed ? 'line-through' : 'none',
                }}>
                    {v}
                </Text>
            ),
        },
        {
            title: '',
            key: 'arrow',
            width: 30,
            align: 'center' as const,
            render: (_: unknown, r: DiffRow) => r.changed ?
                <SwapOutlined style={{ color: '#1890ff', fontSize: 11 }} /> : null,
        },
        {
            title: 'ค่าใหม่',
            dataIndex: 'newValue',
            key: 'newValue',
            width: 100,
            align: 'right' as const,
            render: (v: string | number, r: DiffRow) => (
                <Text strong style={{
                    fontSize: 12,
                    color: r.changed ? '#52c41a' : '#8c8c8c',
                    background: r.changed ? '#f6ffed' : 'transparent',
                    padding: r.changed ? '1px 6px' : 0,
                    borderRadius: 4,
                }}>
                    {v}
                </Text>
            ),
        },
    ];

    return (
        <Modal
            open={open}
            onCancel={handleClose}
            title={
                <Space>
                    <FileExcelOutlined style={{ color: '#217346' }} />
                    {title}
                </Space>
            }
            width={720}
            footer={step === 'preview' ? [
                <Button key="back" onClick={reset}>เลือกไฟล์ใหม่</Button>,
                <Button
                    key="confirm"
                    type="primary"
                    disabled={hasErrors || changedCount === 0}
                    onClick={handleConfirm}
                    style={{ background: hasErrors ? undefined : '#217346', borderColor: hasErrors ? undefined : '#217346' }}
                >
                    <CheckCircleFilled /> ยืนยันอัปเดต ({changedCount} รายการ)
                </Button>,
            ] : null}
            styles={{ body: { padding: '16px 24px' } }}
        >
            {step === 'upload' && (
                <Dragger
                    accept=".xlsx,.xls"
                    maxCount={1}
                    showUploadList={false}
                    beforeUpload={(file) => {
                        void handleFile(file as File);
                        return false; // prevent auto upload
                    }}
                    style={{ padding: '32px 16px' }}
                >
                    <p style={{ fontSize: 36, color: '#217346', marginBottom: 12 }}>
                        <FileExcelOutlined />
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                        คลิกหรือลากไฟล์ Excel มาวางที่นี่
                    </p>
                    <p style={{ fontSize: 12, color: '#8c8c8c' }}>
                        รองรับ .xlsx — ใช้ไฟล์ที่ Export จากระบบเป็นแม่แบบ
                    </p>
                </Dragger>
            )}

            {step === 'preview' && (
                <div>
                    {/* File info */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        marginBottom: 12, padding: '8px 12px',
                        background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0',
                    }}>
                        <FileExcelOutlined style={{ color: '#217346' }} />
                        <Text style={{ fontSize: 12 }}>{fileName}</Text>
                        {!hasErrors && <Tag color="green" style={{ margin: 0 }}>Valid</Tag>}
                        {hasErrors && <Tag color="red" style={{ margin: 0 }}>มีข้อผิดพลาด</Tag>}
                    </div>

                    {/* Errors */}
                    {hasErrors && (
                        <Alert
                            type="error"
                            showIcon
                            icon={<CloseCircleFilled />}
                            title={`พบ ${errors.length} ข้อผิดพลาด — ไม่สามารถนำเข้าได้`}
                            description={
                                <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 12 }}>
                                    {errors.slice(0, 10).map((e, i) => (
                                        <li key={i} style={{ marginBottom: 2 }}>
                                            {e.row > 0 && <Text code style={{ fontSize: 10 }}>Row {e.row}</Text>}{' '}
                                            {e.message}
                                        </li>
                                    ))}
                                    {errors.length > 10 && <li>และอีก {errors.length - 10} รายการ...</li>}
                                </ul>
                            }
                            style={{ marginBottom: 12 }}
                        />
                    )}

                    {/* Warnings */}
                    {warnings.length > 0 && (
                        <Alert
                            type="warning"
                            showIcon
                            icon={<WarningFilled />}
                            title={`${warnings.length} รายการที่ไม่อยู่ในไฟล์ (จะใช้ค่าเดิม)`}
                            description={
                                <div style={{ fontSize: 11, color: '#8c8c8c', maxHeight: 80, overflowY: 'auto' }}>
                                    {warnings.slice(0, 5).join(' • ')}
                                    {warnings.length > 5 && ` และอีก ${warnings.length - 5} รายการ`}
                                </div>
                            }
                            style={{ marginBottom: 12 }}
                        />
                    )}

                    {/* Diff Table */}
                    {!hasErrors && (
                        <>
                            <Divider style={{ margin: '8px 0' }} />
                            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text strong style={{ fontSize: 13 }}>
                                    ตรวจสอบก่อนอัปเดต
                                </Text>
                                <Space size="small">
                                    <Tag color={changedCount > 0 ? 'blue' : 'default'}>
                                        {changedCount} รายการเปลี่ยนแปลง
                                    </Tag>
                                    <Tag color="default">
                                        {diffRows.length - changedCount} ไม่เปลี่ยน
                                    </Tag>
                                </Space>
                            </div>

                            {changedCount === 0 ? (
                                <Empty
                                    description="ไม่มีการเปลี่ยนแปลง — ค่าทั้งหมดตรงกันกับข้อมูลปัจจุบัน"
                                    style={{ padding: '24px 0' }}
                                />
                            ) : (
                                <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                                    <Table
                                        dataSource={diffRows.filter(r => r.changed)}
                                        columns={diffColumns}
                                        rowKey="key"
                                        pagination={false}
                                        size="small"
                                        scroll={{ x: 550 }}
                                        rowClassName={(r) => r.changed ? 'diff-changed-row' : ''}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </Modal>
    );
}
