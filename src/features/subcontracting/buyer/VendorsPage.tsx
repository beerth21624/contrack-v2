'use client';

// ─── /subcontracting/vendors: ทะเบียนทีมช่าง of the workspace — add, edit, hide, delete, import (plan §4.2) ───
import { useLocale, useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useState } from 'react';
import { Alert, App, Button, Form, Input, Modal, Popconfirm, Select, Switch, Table, Tag, Upload } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import {
    type ImportVendorListResponse, type TradeId, type VendorListEntryDto, formatThaiPhone, phoneSchema,
} from '@/shared/contract';
import { isApiError } from '@/features/cloud/api/errors';
import { can } from '@/features/cloud/permissions';
import { fmtDateTime, num } from './format';
import {
    useBuyerContext, useCreateVendor, useDeleteVendor, useImportVendors, useUpdateVendor, useVendorList,
} from './hooks';
import { provinceOptions } from './provinces';
import { Card, PageHead, ScPage, tradeOptions, TradeChips } from './ui';
import { IMPORT_MAX_ROWS, parseCsv, rowsFromTable, type ParsedImport } from './vendor-import';

export function VendorsPage() {
    return (
        <ScPage next="/subcontracting/vendors">
            <VendorsContent />
        </ScPage>
    );
}

function VendorsContent() {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
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
            onSuccess: () => { void message.success(hidden ? t('buyer.vendors.hid', { displayName: v.displayName }) : t('buyer.vendors.showed', { displayName: v.displayName })); },
            onError: (e) => { void message.error(toText(e)); },
        });
    };
    const onDelete = (v: VendorListEntryDto) => {
        remove.mutate(v.id, {
            onSuccess: () => { void message.success(t('buyer.vendors.deleted', { displayName: v.displayName })); },
            onError: (e) => {
                if (isApiError(e) && e.code === 'conflict') {
                    modal.confirm({
                        title: t('buyer.vendors.cannotDelete', { displayName: v.displayName }),
                        content: t('buyer.vendors.thisCrewHasBeenInvited'),
                        okText: t('buyer.vendors.hideInstead'), cancelText: t('buyer.vendors.cancel'),
                        onOk: () => setHidden(v, true),
                    });
                } else void message.error(toText(e));
            },
        });
    };

    const columns = [
        {
            title: t('buyer.vendors.crew'), key: 'name',
            render: (_: unknown, v: VendorListEntryDto) => (
                <div className="min-w-0">
                    <div className="font-medium text-gray-900">
                        {v.displayName}
                        {v.hidden && <Tag className="!ml-2">{t('buyer.vendors.hidden')}</Tag>}
                    </div>
                    <div className="text-caption text-gray-500 tabular-nums">
                        {formatThaiPhone(v.phone)}{v.lineId !== '' ? ` · LINE ${v.lineId}` : ''}
                    </div>
                    {v.privateNote !== '' && <div className="text-caption text-gray-400 truncate max-w-[320px]">{v.privateNote}</div>}
                </div>
            ),
        },
        { title: t('buyer.vendors.trade'), key: 'trades', render: (_: unknown, v: VendorListEntryDto) => <TradeChips trades={v.trades} /> },
        {
            title: t('buyer.vendors.province'), key: 'province', width: 130, responsive: ['md' as const],
            render: (_: unknown, v: VendorListEntryDto) => (v.province === '' ? <span className="text-gray-400">–</span> : v.province),
        },
        {
            title: t('buyer.vendors.account'), key: 'account', width: 130,
            render: (_: unknown, v: VendorListEntryDto) => (v.hasAccount
                ? (
                    <div>
                        <span className="text-green-600">{t('buyer.vendors.hasAnAccount')}</span>
                        <div className="text-caption text-gray-500">{v.profileComplete ? t('buyer.vendors.profileComplete') : t('buyer.vendors.profileIncomplete')}{v.tier !== null ? ` · ${v.tier}` : ''}</div>
                    </div>
                )
                : <span className="text-gray-400">{t('buyer.vendors.noAccountYet')}</span>),
        },
        {
            title: t('buyer.vendors.workWithUs'), key: 'engaged', width: 150, responsive: ['lg' as const],
            render: (_: unknown, v: VendorListEntryDto) => (
                <div className="text-secondary">
                    {v.lastEngagedAt === null ? <span className="text-gray-400">{t('buyer.vendors.never')}</span> : t('buyer.vendors.latest', { lastEngagedAt: fmtDateTime(v.lastEngagedAt) })}
                    {v.completedWithUs > 0 && <div className="text-caption text-gray-500">{t('buyer.vendors.completed')} {v.completedWithUs} {t('buyer.vendors.jobs')}</div>}
                </div>
            ),
        },
        {
            title: t('buyer.vendors.ourRating'), key: 'rating', width: 110, align: 'right' as const, responsive: ['md' as const],
            render: (_: unknown, v: VendorListEntryDto) => (v.ratingFromUs === null
                ? <span className="text-gray-400">–</span>
                : <span className="tabular-nums">{num(v.ratingFromUs, 1)} / 5</span>),
        },
        ...(mayManage ? [{
            title: '', key: 'actions', width: 190, align: 'right' as const,
            render: (_: unknown, v: VendorListEntryDto) => (
                <span className="flex justify-end gap-1">
                    <Button size="small" type="text" onClick={() => setEditing(v)}>{t('buyer.vendors.edit')}</Button>
                    <Button size="small" type="text" onClick={() => setHidden(v, !v.hidden)}>{v.hidden ? t('buyer.vendors.show') : t('buyer.vendors.hide')}</Button>
                    <Popconfirm title={t('buyer.vendors.removeFromTheRegister', { displayName: v.displayName })} okText={t('buyer.vendors.delete')} cancelText={t('buyer.vendors.cancel')}
                        okButtonProps={{ danger: true }} onConfirm={() => onDelete(v)}>
                        <Button size="small" type="text" danger>{t('buyer.vendors.delete')}</Button>
                    </Popconfirm>
                </span>
            ),
        }] : []),
    ];

    const data = list.data ?? [];
    const filtering = q.trim() !== '' || trade !== undefined;
    return (
        <>
            <PageHead title={t('buyer.vendors.crewRegister')} back={{ href: '/subcontracting', label: t('buyer.vendors.subcontracting') }}
                sub={t('buyer.vendors.crewsYouKnowUsedTo')}
                extra={mayManage ? <>
                    <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>{t('buyer.vendors.importFromExcelCsv')}</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>{t('buyer.vendors.addCrew')}</Button>
                </> : undefined} />
            <Card>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Input.Search allowClear placeholder={t('buyer.vendors.searchByNameOrPhone')} style={{ width: 240 }} onSearch={setQ}
                        onChange={e => { if (e.target.value === '') setQ(''); }} />
                    <Select allowClear placeholder={t('buyer.vendors.allTrades')} style={{ width: 220 }} value={trade} onChange={(v: TradeId | undefined) => setTrade(v)}
                        options={tradeOptions()} />
                    <label className="flex items-center gap-2 text-secondary text-gray-600 ml-auto">
                        <Switch size="small" checked={showHidden} onChange={setShowHidden} /> {t('buyer.vendors.showHidden')}
                    </label>
                </div>
                <Table<VendorListEntryDto> rowKey="id" columns={columns} dataSource={data} loading={list.isLoading}
                    pagination={data.length > 50 ? { pageSize: 50, showSizeChanger: false } : false} size="middle" scroll={{ x: 760 }}
                    rowClassName={v => (v.hidden ? 'text-gray-400' : '')}
                    locale={{
                        emptyText: list.isError ? toText(list.error)
                            : filtering ? t('buyer.vendors.noMatchingCrews')
                                : (
                                    <div className="flex flex-col items-center gap-2 py-6">
                                        <span className="text-gray-600">{t('buyer.vendors.noCrewsInTheRegister')}</span>
                                        {mayManage && <Button type="primary" onClick={() => setEditing('new')}>{t('buyer.vendors.addTheFirstCrew')}</Button>}
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
    const t = useTranslations('subcontracting');
    const locale = useLocale();
    const toText = useErrorMessage();
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
            void message.success(entry === null ? t('buyer.vendors.added', { displayName: saved.displayName }) : t('buyer.vendors.saved'));
            onSaved?.(saved);
            onClose();
        } catch (e) {
            if (isApiError(e) && e.code === 'conflict') setPhoneTaken(true);
            else void message.error(toText(e));
        }
    };

    return (
        <Modal open onCancel={onClose} title={entry === null ? t('buyer.vendors.addCrew') : t('buyer.vendors.edit2', { displayName: entry.displayName })} destroyOnHidden
            okText={t('buyer.vendors.save')} cancelText={t('buyer.vendors.cancel')} confirmLoading={pending} onOk={() => { void submit(); }}>
            <Form form={form} layout="vertical" requiredMark={false} onValuesChange={() => setPhoneTaken(false)}
                initialValues={{
                    displayName: entry?.displayName ?? initial?.displayName ?? '',
                    phone: entry === null ? (initial?.phone ?? '') : formatThaiPhone(entry.phone),
                    trades: entry?.trades ?? initial?.trades ?? [],
                    lineId: entry?.lineId ?? initial?.lineId ?? '',
                    province: entry === null ? initial?.province : (entry.province === '' ? undefined : entry.province),
                    privateNote: entry?.privateNote ?? '',
                }}>
                <Form.Item name="displayName" label={t('buyer.vendors.crewContactName')} rules={[{ required: true, whitespace: true, message: t('buyer.vendors.enterAName') }]}>
                    <Input maxLength={120} autoFocus />
                </Form.Item>
                <Form.Item name="phone" label={t('buyer.vendors.phone')}
                    validateStatus={phoneTaken ? 'error' : undefined}
                    help={phoneTaken ? t('buyer.vendors.thisPhoneNumberIsAlready') : undefined}
                    rules={[{
                        validator: (_r, value: string | undefined) => (phoneSchema.safeParse(value ?? '').success
                            ? Promise.resolve()
                            : Promise.reject(new Error(t('buyer.vendors.invalidPhoneNumber')))),
                    }]}>
                    <Input inputMode="tel" placeholder="081-234-5678" maxLength={20} />
                </Form.Item>
                <Form.Item name="trades" label={t('buyer.vendors.trade')}>
                    <Select mode="multiple" options={tradeOptions()} placeholder={t('buyer.vendors.chooseOneOrMoreTrades')} showSearch={{ optionFilterProp: 'label' }} />
                </Form.Item>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    <Form.Item name="province" label={t('buyer.vendors.province')}>
                        <Select allowClear showSearch={{ optionFilterProp: 'label' }} options={provinceOptions(locale)} />
                    </Form.Item>
                    <Form.Item name="lineId" label="LINE ID">
                        <Input maxLength={60} />
                    </Form.Item>
                </div>
                <Form.Item name="privateNote" label={t('buyer.vendors.noteNotVisibleToThe')} className="!mb-0">
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
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
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
            void message.error(t('buyer.vendors.couldNotReadTheFile'));
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
            void message.error(toText(e));
        }
    };
    const sheetRow = (i: number) => parsed?.sourceRows[i] ?? i + 1;

    return (
        <Modal open onCancel={onClose} title={t('buyer.vendors.importCrewsFromExcelCsv')} destroyOnHidden width={600}
            footer={result !== null
                ? <Button type="primary" onClick={onClose}>{t('buyer.vendors.done')}</Button>
                : <>
                    <Button onClick={onClose}>{t('buyer.vendors.cancel')}</Button>
                    <Button type="primary" disabled={parsed === null || parsed.rows.length === 0} loading={importRows.isPending}
                        onClick={() => { void submit(); }}>
                        {t('buyer.vendors.import')} {parsed?.rows.length ?? 0} {t('buyer.vendors.crews')}
                    </Button>
                </>}>
            {result === null ? (
                <div className="flex flex-col gap-3">
                    <p className="text-secondary text-gray-600 m-0">
                        {t('buyer.vendors.columnsNamePhoneTradeProvince')}
                    </p>
                    <Upload.Dragger accept=".xlsx,.csv" maxCount={1} showUploadList={false} disabled={reading}
                        beforeUpload={(file) => { void onFile(file); return false; }}>
                        <p className="text-gray-900 m-0">{reading ? t('buyer.vendors.readingTheFile') : parsed?.fileName ?? t('buyer.vendors.dragAFileHereOr')}</p>
                        <p className="text-caption text-gray-500 m-0">{t('buyer.vendors.atMost')} {num(IMPORT_MAX_ROWS)} {t('buyer.vendors.rowsPerImport')}</p>
                    </Upload.Dragger>
                    {parsed !== null && (
                        <div className="text-secondary flex flex-col gap-1">
                            <span>{t('buyer.vendors.found')} {parsed.rows.length} {t('buyer.vendors.crewsReadyToImport')}</span>
                            {parsed.incomplete.length > 0 && (
                                <span className="text-amber-600">{t('buyer.vendors.skipped')} {parsed.incomplete.length} {t('buyer.vendors.rowsWithoutANameOr')} {parsed.incomplete.slice(0, 10).join(', ')}{parsed.incomplete.length > 10 ? ' …' : ''})</span>
                            )}
                            {parsed.truncated > 0 && <span className="text-amber-600">{t('buyer.vendors.over')} {IMPORT_MAX_ROWS} {t('buyer.vendors.rows')} {parsed.truncated} {t('buyer.vendors.theLastRowsAreNot')}</span>}
                            {parsed.rows.length > 0 && (
                                <Table size="small" pagination={false} className="mt-1" rowKey={(_r, i) => String(i)}
                                    dataSource={parsed.rows.slice(0, 5)} scroll={{ x: 480 }}
                                    columns={[
                                        { title: t('buyer.vendors.name'), dataIndex: 'displayName', key: 'n' },
                                        { title: t('buyer.vendors.phone2'), dataIndex: 'phone', key: 'p', render: (p: string) => formatThaiPhone(p) },
                                        { title: t('buyer.vendors.trade'), key: 't', render: (_: unknown, r: ParsedImport['rows'][number]) => <TradeChips trades={r.trades} /> },
                                        { title: t('buyer.vendors.province'), dataIndex: 'province', key: 'pv' },
                                    ]} />
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <Alert type="success" showIcon title={t('buyer.vendors.addedToTheRegister', { created: result.created })} />
                    {result.duplicates.length > 0 && (
                        <div className="text-secondary text-gray-600">
                            {t('buyer.vendors.alreadyInTheRegister')} {result.duplicates.length} {t('buyer.vendors.crewsRows')} {result.duplicates.slice(0, 15).map(sheetRow).join(', ')}{result.duplicates.length > 15 ? ' …' : ''})
                        </div>
                    )}
                    {result.invalid.length > 0 && (
                        <div className="text-secondary">
                            <div className="text-red-600">{t('buyer.vendors.couldNotImport')} {result.invalid.length} {t('buyer.vendors.rows2')}</div>
                            <ul className="m-0 pl-5 text-gray-600">
                                {result.invalid.slice(0, 10).map(r => <li key={r.row}>{t('buyer.vendors.row')} {sheetRow(r.row)}: {r.reason}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}
