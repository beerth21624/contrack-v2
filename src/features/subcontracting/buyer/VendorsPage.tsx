'use client';

// ─── /subcontracting/vendors: ทะเบียนทีมช่าง of the workspace — add, edit, hide, delete, import (plan §4.2) ───
import { useState } from 'react';
import { Alert, App, Button, Form, Input, Modal, Popconfirm, Select, Switch, Table, Tag, Upload } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import {
    type ImportVendorListResponse, type TradeId, type VendorListEntryDto, formatThaiPhone, phoneSchema,
} from '@/shared/contract';
import { isApiError, thaiErrorMessage } from '@/features/cloud/api/errors';
import { can } from '@/features/cloud/permissions';
import { fmtDateTime } from './format';
import {
    useBuyerContext, useCreateVendor, useDeleteVendor, useImportVendors, useUpdateVendor, useVendorList,
} from './hooks';
import { PROVINCE_OPTIONS } from './provinces';
import { Card, PageHead, ScPage, TRADE_OPTIONS, TradeChips } from './ui';
import { IMPORT_MAX_ROWS, parseCsv, rowsFromTable, type ParsedImport } from './vendor-import';

export function VendorsPage() {
    return (
        <ScPage next="/subcontracting/vendors">
            <VendorsContent />
        </ScPage>
    );
}

function VendorsContent() {
    const { modal, message } = App.useApp();
    const { workspaceId, role } = useBuyerContext();
    const [q, setQ] = useState('');
    const [trade, setTrade] = useState<TradeId | undefined>(undefined);
    const [showHidden, setShowHidden] = useState(false);
    const [editing, setEditing] = useState<VendorListEntryDto | 'new' | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    const list = useVendorList(workspaceId, { q, trade, hidden: showHidden ? undefined : false });
    const ws = workspaceId ?? '';
    const update = useUpdateVendor(ws);
    const remove = useDeleteVendor(ws);
    const mayManage = can(role, 'sc.vendors.manage');

    const setHidden = (v: VendorListEntryDto, hidden: boolean) => {
        update.mutate({ entryId: v.id, body: { hidden } }, {
            onSuccess: () => { void message.success(hidden ? `ซ่อน ${v.displayName} แล้ว` : `แสดง ${v.displayName} แล้ว`); },
            onError: (e) => { void message.error(thaiErrorMessage(e)); },
        });
    };
    const onDelete = (v: VendorListEntryDto) => {
        remove.mutate(v.id, {
            onSuccess: () => { void message.success(`ลบ ${v.displayName} แล้ว`); },
            onError: (e) => {
                if (isApiError(e) && e.code === 'conflict') {
                    modal.confirm({
                        title: `ลบ ${v.displayName} ไม่ได้`,
                        content: 'ทีมช่างนี้เคยได้รับคำเชิญหรือมีสัญญาแล้ว ซ่อนจากรายชื่อแทนได้ ประวัติยังอยู่ครบ',
                        okText: 'ซ่อนแทน', cancelText: 'ยกเลิก',
                        onOk: () => setHidden(v, true),
                    });
                } else void message.error(thaiErrorMessage(e));
            },
        });
    };

    const columns = [
        {
            title: 'ทีมช่าง', key: 'name',
            render: (_: unknown, v: VendorListEntryDto) => (
                <div className="min-w-0">
                    <div className="font-medium text-gray-900">
                        {v.displayName}
                        {v.hidden && <Tag className="!ml-2">ซ่อนอยู่</Tag>}
                    </div>
                    <div className="text-caption text-gray-500 tabular-nums">
                        {formatThaiPhone(v.phone)}{v.lineId !== '' ? ` · LINE ${v.lineId}` : ''}
                    </div>
                    {v.privateNote !== '' && <div className="text-caption text-gray-400 truncate max-w-[320px]">{v.privateNote}</div>}
                </div>
            ),
        },
        { title: 'ประเภทงาน', key: 'trades', render: (_: unknown, v: VendorListEntryDto) => <TradeChips trades={v.trades} /> },
        {
            title: 'จังหวัด', key: 'province', width: 130, responsive: ['md' as const],
            render: (_: unknown, v: VendorListEntryDto) => (v.province === '' ? <span className="text-gray-400">–</span> : v.province),
        },
        {
            title: 'บัญชี', key: 'account', width: 130,
            render: (_: unknown, v: VendorListEntryDto) => (v.hasAccount
                ? (
                    <div>
                        <span className="text-green-600">มีบัญชีแล้ว ✓</span>
                        <div className="text-caption text-gray-500">{v.profileComplete ? 'โปรไฟล์ครบ' : 'โปรไฟล์ยังไม่ครบ'}{v.tier !== null ? ` · ${v.tier}` : ''}</div>
                    </div>
                )
                : <span className="text-gray-400">ยังไม่มีบัญชี</span>),
        },
        {
            title: 'งานกับเรา', key: 'engaged', width: 150, responsive: ['lg' as const],
            render: (_: unknown, v: VendorListEntryDto) => (
                <div className="text-secondary">
                    {v.lastEngagedAt === null ? <span className="text-gray-400">ยังไม่เคย</span> : `ล่าสุด ${fmtDateTime(v.lastEngagedAt)}`}
                    {v.completedWithUs > 0 && <div className="text-caption text-gray-500">เสร็จแล้ว {v.completedWithUs} งาน</div>}
                </div>
            ),
        },
        {
            title: 'คะแนนจากเรา', key: 'rating', width: 110, align: 'right' as const, responsive: ['md' as const],
            render: (_: unknown, v: VendorListEntryDto) => (v.ratingFromUs === null
                ? <span className="text-gray-400">–</span>
                : <span className="tabular-nums">{v.ratingFromUs.toLocaleString('th-TH', { maximumFractionDigits: 1 })} / 5</span>),
        },
        ...(mayManage ? [{
            title: '', key: 'actions', width: 190, align: 'right' as const,
            render: (_: unknown, v: VendorListEntryDto) => (
                <span className="flex justify-end gap-1">
                    <Button size="small" type="text" onClick={() => setEditing(v)}>แก้ไข</Button>
                    <Button size="small" type="text" onClick={() => setHidden(v, !v.hidden)}>{v.hidden ? 'แสดง' : 'ซ่อน'}</Button>
                    <Popconfirm title={`ลบ ${v.displayName} ออกจากทะเบียน?`} okText="ลบ" cancelText="ยกเลิก"
                        okButtonProps={{ danger: true }} onConfirm={() => onDelete(v)}>
                        <Button size="small" type="text" danger>ลบ</Button>
                    </Popconfirm>
                </span>
            ),
        }] : []),
    ];

    const data = list.data ?? [];
    const filtering = q.trim() !== '' || trade !== undefined;
    return (
        <>
            <PageHead title="ทะเบียนทีมช่าง" back={{ href: '/subcontracting', label: 'จ้างช่วง' }}
                sub="ทีมช่างที่รู้จัก ใช้เลือกผู้รับคำเชิญ หมายเหตุเห็นเฉพาะทีมเรา"
                extra={mayManage ? <>
                    <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>นำเข้าจาก Excel/CSV</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>เพิ่มทีมช่าง</Button>
                </> : undefined} />
            <Card>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Input.Search allowClear placeholder="ค้นหาชื่อหรือเบอร์" style={{ width: 240 }} onSearch={setQ}
                        onChange={e => { if (e.target.value === '') setQ(''); }} />
                    <Select allowClear placeholder="ทุกประเภทงาน" style={{ width: 220 }} value={trade} onChange={(v: TradeId | undefined) => setTrade(v)}
                        options={TRADE_OPTIONS} />
                    <label className="flex items-center gap-2 text-secondary text-gray-600 ml-auto">
                        <Switch size="small" checked={showHidden} onChange={setShowHidden} /> แสดงที่ซ่อนไว้
                    </label>
                </div>
                <Table<VendorListEntryDto> rowKey="id" columns={columns} dataSource={data} loading={list.isLoading}
                    pagination={data.length > 50 ? { pageSize: 50, showSizeChanger: false } : false} size="middle" scroll={{ x: 760 }}
                    rowClassName={v => (v.hidden ? 'text-gray-400' : '')}
                    locale={{
                        emptyText: list.isError ? thaiErrorMessage(list.error)
                            : filtering ? 'ไม่พบทีมช่างที่ตรงกัน'
                                : (
                                    <div className="flex flex-col items-center gap-2 py-6">
                                        <span className="text-gray-600">ยังไม่มีทีมช่างในทะเบียน</span>
                                        {mayManage && <Button type="primary" onClick={() => setEditing('new')}>เพิ่มทีมช่างคนแรก</Button>}
                                    </div>
                                ),
                    }} />
            </Card>
            {editing !== null && workspaceId !== undefined && (
                <VendorFormModal workspaceId={workspaceId} entry={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
            )}
            {importOpen && workspaceId !== undefined && <ImportModal workspaceId={workspaceId} onClose={() => setImportOpen(false)} />}
        </>
    );
}

interface VendorForm {
    displayName: string;
    phone: string;
    trades: TradeId[];
    lineId: string;
    province: string | undefined;
    privateNote: string;
}

/** Add or edit one entry. Phone in any common Thai form; the same phone twice in the list → 409. */
export function VendorFormModal({ workspaceId, entry, onClose, onSaved, initial }: {
    workspaceId: string;
    entry: VendorListEntryDto | null;
    onClose: () => void;
    onSaved?: (v: VendorListEntryDto) => void;
    initial?: Partial<VendorForm>;
}) {
    const { message } = App.useApp();
    const [form] = Form.useForm<VendorForm>();
    const create = useCreateVendor(workspaceId);
    const update = useUpdateVendor(workspaceId);
    const pending = create.isPending || update.isPending;
    const [phoneTaken, setPhoneTaken] = useState(false);

    const submit = async () => {
        const v = await form.validateFields();
        const body = {
            displayName: v.displayName.trim(),
            phone: v.phone,
            trades: v.trades,
            lineId: v.lineId.trim(),
            province: v.province ?? '',
            privateNote: v.privateNote.trim(),
        };
        try {
            const saved = entry === null
                ? await create.mutateAsync(body)
                : await update.mutateAsync({ entryId: entry.id, body });
            void message.success(entry === null ? `เพิ่ม ${saved.displayName} แล้ว` : 'บันทึกแล้ว');
            onSaved?.(saved);
            onClose();
        } catch (e) {
            if (isApiError(e) && e.code === 'conflict') setPhoneTaken(true);
            else void message.error(thaiErrorMessage(e));
        }
    };

    return (
        <Modal open onCancel={onClose} title={entry === null ? 'เพิ่มทีมช่าง' : `แก้ไข ${entry.displayName}`} destroyOnHidden
            okText="บันทึก" cancelText="ยกเลิก" confirmLoading={pending} onOk={() => { void submit(); }}>
            <Form form={form} layout="vertical" requiredMark={false} onValuesChange={() => setPhoneTaken(false)}
                initialValues={{
                    displayName: entry?.displayName ?? initial?.displayName ?? '',
                    phone: entry === null ? (initial?.phone ?? '') : formatThaiPhone(entry.phone),
                    trades: entry?.trades ?? initial?.trades ?? [],
                    lineId: entry?.lineId ?? initial?.lineId ?? '',
                    province: entry === null ? initial?.province : (entry.province === '' ? undefined : entry.province),
                    privateNote: entry?.privateNote ?? '',
                }}>
                <Form.Item name="displayName" label="ชื่อทีม / ผู้ติดต่อ" rules={[{ required: true, whitespace: true, message: 'ใส่ชื่อ' }]}>
                    <Input maxLength={120} autoFocus />
                </Form.Item>
                <Form.Item name="phone" label="เบอร์โทร"
                    validateStatus={phoneTaken ? 'error' : undefined}
                    help={phoneTaken ? 'เบอร์นี้อยู่ในทะเบียนแล้ว' : undefined}
                    rules={[{
                        validator: (_r, value: string | undefined) => (phoneSchema.safeParse(value ?? '').success
                            ? Promise.resolve()
                            : Promise.reject(new Error('เบอร์โทรไม่ถูกต้อง'))),
                    }]}>
                    <Input inputMode="tel" placeholder="081-234-5678" maxLength={20} />
                </Form.Item>
                <Form.Item name="trades" label="ประเภทงาน">
                    <Select mode="multiple" options={TRADE_OPTIONS} placeholder="เลือกได้หลายประเภท" showSearch={{ optionFilterProp: 'label' }} />
                </Form.Item>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    <Form.Item name="province" label="จังหวัด">
                        <Select allowClear showSearch={{ optionFilterProp: 'label' }} options={PROVINCE_OPTIONS} />
                    </Form.Item>
                    <Form.Item name="lineId" label="LINE ID">
                        <Input maxLength={60} />
                    </Form.Item>
                </div>
                <Form.Item name="privateNote" label="หมายเหตุ (ทีมช่างไม่เห็น)" className="!mb-0">
                    <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} maxLength={1000} />
                </Form.Item>
            </Form>
        </Modal>
    );
}

/** Reads the first sheet of an .xlsx, or a .csv, as rows of text cells. */
async function readTable(file: File): Promise<string[][]> {
    if (/\.csv$/i.test(file.name) || file.type === 'text/csv') return parseCsv(await file.text());
    const { default: lib } = await import('exceljs');
    const wb = new lib.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    if (ws === undefined) return [];
    const rows: string[][] = [];
    for (let r = 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const cells: string[] = [];
        for (let c = 1; c <= ws.columnCount; c++) cells.push(row.getCell(c).text);
        rows.push(cells);
    }
    return rows;
}

function ImportModal({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
    const { message } = App.useApp();
    const importRows = useImportVendors(workspaceId);
    const [parsed, setParsed] = useState<(ParsedImport & { fileName: string }) | null>(null);
    const [reading, setReading] = useState(false);
    const [result, setResult] = useState<ImportVendorListResponse | null>(null);

    const onFile = async (file: File) => {
        setReading(true);
        setResult(null);
        try {
            setParsed({ ...rowsFromTable(await readTable(file)), fileName: file.name });
        } catch {
            void message.error('อ่านไฟล์ไม่ได้ ใช้ไฟล์ .xlsx หรือ .csv');
            setParsed(null);
        } finally {
            setReading(false);
        }
    };
    const submit = async () => {
        if (parsed === null || parsed.rows.length === 0) return;
        try {
            setResult(await importRows.mutateAsync({ rows: parsed.rows }));
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };
    const sheetRow = (i: number) => parsed?.sourceRows[i] ?? i + 1;

    return (
        <Modal open onCancel={onClose} title="นำเข้าทีมช่างจาก Excel/CSV" destroyOnHidden width={600}
            footer={result !== null
                ? <Button type="primary" onClick={onClose}>เสร็จแล้ว</Button>
                : <>
                    <Button onClick={onClose}>ยกเลิก</Button>
                    <Button type="primary" disabled={parsed === null || parsed.rows.length === 0} loading={importRows.isPending}
                        onClick={() => { void submit(); }}>
                        นำเข้า {parsed?.rows.length ?? 0} ราย
                    </Button>
                </>}>
            {result === null ? (
                <div className="flex flex-col gap-3">
                    <p className="text-secondary text-gray-600 m-0">
                        คอลัมน์ ชื่อ, เบอร์, ประเภทงาน, จังหวัด (แถวแรกเป็นหัวคอลัมน์) ประเภทงานหลายอย่างคั่นด้วยจุลภาค
                    </p>
                    <Upload.Dragger accept=".xlsx,.csv" maxCount={1} showUploadList={false} disabled={reading}
                        beforeUpload={(file) => { void onFile(file); return false; }}>
                        <p className="text-gray-900 m-0">{reading ? 'กำลังอ่านไฟล์…' : parsed?.fileName ?? 'ลากไฟล์มาวาง หรือคลิกเพื่อเลือก'}</p>
                        <p className="text-caption text-gray-500 m-0">ไม่เกิน {IMPORT_MAX_ROWS.toLocaleString('th-TH')} แถวต่อครั้ง</p>
                    </Upload.Dragger>
                    {parsed !== null && (
                        <div className="text-secondary flex flex-col gap-1">
                            <span>พบ {parsed.rows.length} ราย พร้อมนำเข้า</span>
                            {parsed.incomplete.length > 0 && (
                                <span className="text-amber-600">ข้าม {parsed.incomplete.length} แถวที่ไม่มีชื่อหรือเบอร์ (แถว {parsed.incomplete.slice(0, 10).join(', ')}{parsed.incomplete.length > 10 ? ' …' : ''})</span>
                            )}
                            {parsed.truncated > 0 && <span className="text-amber-600">เกิน {IMPORT_MAX_ROWS} แถว: {parsed.truncated} แถวท้ายยังไม่นำเข้า</span>}
                            {parsed.rows.length > 0 && (
                                <Table size="small" pagination={false} className="mt-1" rowKey={(_r, i) => String(i)}
                                    dataSource={parsed.rows.slice(0, 5)} scroll={{ x: 480 }}
                                    columns={[
                                        { title: 'ชื่อ', dataIndex: 'displayName', key: 'n' },
                                        { title: 'เบอร์', dataIndex: 'phone', key: 'p', render: (p: string) => formatThaiPhone(p) },
                                        { title: 'ประเภทงาน', key: 't', render: (_: unknown, r: ParsedImport['rows'][number]) => <TradeChips trades={r.trades} /> },
                                        { title: 'จังหวัด', dataIndex: 'province', key: 'pv' },
                                    ]} />
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <Alert type="success" showIcon title={`เพิ่มเข้าทะเบียน ${result.created} ราย`} />
                    {result.duplicates.length > 0 && (
                        <div className="text-secondary text-gray-600">
                            มีอยู่แล้ว {result.duplicates.length} ราย (แถว {result.duplicates.slice(0, 15).map(sheetRow).join(', ')}{result.duplicates.length > 15 ? ' …' : ''})
                        </div>
                    )}
                    {result.invalid.length > 0 && (
                        <div className="text-secondary">
                            <div className="text-red-600">นำเข้าไม่ได้ {result.invalid.length} แถว</div>
                            <ul className="m-0 pl-5 text-gray-600">
                                {result.invalid.slice(0, 10).map(r => <li key={r.row}>แถว {sheetRow(r.row)}: {r.reason}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}
