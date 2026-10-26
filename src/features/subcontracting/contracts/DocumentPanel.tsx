'use client';

// ─── Contract document tab: the text (server-sanitised HTML), editing before acceptance, change requests,
// signed scan, and the agreed lines ───
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Empty, Input, Modal, Segmented, Table, Upload } from 'antd';
import { EditOutlined, FilePdfOutlined, PaperClipOutlined, UploadOutlined } from '@ant-design/icons';
import type { SubcontractDto, SubcontractLineDto } from '@/shared/contract';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import type { Permission } from '@/features/cloud/permissions';
import { formatDateTime, spinner } from '@/features/cloud/ui/common';
import { contractsApi, scKeys, useContractDocument, useContractMutation } from './api';
import { fmtQty } from './logic';
import { LoadError, Money } from './ui';
import { uploadFile } from './upload';

export function DocumentPanel({ sc, may }: { sc: SubcontractDto; may: (p: Permission) => boolean }) {
    const doc = useContractDocument(sc.id);
    const [editing, setEditing] = useState(false);
    const pending = sc.status === 'pending_acceptance';
    const canEdit = pending && may('sc.award') && doc.data?.editable === true;
    const openRequests = sc.changeRequests.filter(r => !r.resolved);

    return (
        <div className="flex flex-col gap-4">
            {pending && (
                <Alert type="info" showIcon
                    title={`ส่งฉบับที่ ${String(sc.documentVersion)} ให้ผู้รับจ้างแล้ว รอผู้รับจ้างกดยอมรับเงื่อนไข`}
                    description="แก้ข้อความแล้วผู้รับจ้างต้องยอมรับฉบับใหม่อีกครั้ง" />
            )}

            {sc.changeRequests.length > 0 && (
                <section>
                    <h3 className="text-section font-semibold mb-2">ผู้รับจ้างขอแก้ไข</h3>
                    <ul className="flex flex-col gap-2 m-0 p-0 list-none">
                        {sc.changeRequests.map((r, i) => (
                            <li key={`${r.at}-${String(i)}`}
                                className={`border rounded-control px-3 py-2 ${r.resolved ? 'border-gray-200 text-gray-500' : 'border-amber-300 bg-amber-50'}`}>
                                <div className="whitespace-pre-wrap">{r.text}</div>
                                <div className="text-[12px] text-gray-500 mt-1">{formatDateTime(r.at)}{r.resolved ? ' · แก้แล้ว' : ''}</div>
                            </li>
                        ))}
                    </ul>
                    {openRequests.length > 0 && canEdit && (
                        <div className="text-[12px] text-gray-500 mt-1">แก้ข้อความสัญญาแล้วส่งฉบับใหม่ — คำขอจะถือว่าแก้แล้ว</div>
                    )}
                </section>
            )}

            <section>
                <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-section font-semibold m-0 flex-1">ข้อความสัญญา {doc.data !== undefined && <span className="text-[12px] font-normal text-gray-500">ฉบับที่ {doc.data.version}</span>}</h3>
                    {canEdit && <Button icon={<EditOutlined />} type={openRequests.length > 0 ? 'primary' : 'default'} onClick={() => setEditing(true)}>แก้ข้อความ</Button>}
                </div>
                {doc.isLoading ? spinner : doc.isError ? <LoadError error={doc.error} /> : doc.data !== undefined && (
                    <div className="border border-gray-200 rounded-control p-6 max-h-[640px] overflow-auto bg-white font-document text-[15px] leading-relaxed [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-gray-300 [&_th]:px-2 [&_th]:py-1 [&_p]:my-2 [&_h1]:text-center [&_h2]:text-center"
                        // The server sanitises the contract HTML (GET …/document); it is never built from raw input here.
                        dangerouslySetInnerHTML={{ __html: doc.data.html }} />
                )}
            </section>

            <FilesRow sc={sc} canUpload={may('sc.packages.manage')} />

            <section>
                <h3 className="text-section font-semibold mb-2">รายการงานตามสัญญา</h3>
                <LinesTable sc={sc} />
            </section>

            {editing && doc.data !== undefined && (
                <EditDocumentModal subcontractId={sc.id} html={doc.data.html} onClose={() => setEditing(false)} />
            )}
        </div>
    );
}

function FilesRow({ sc, canUpload }: { sc: SubcontractDto; canUpload: boolean }) {
    const { message } = App.useApp();
    const attach = useContractMutation(sc.id, (fileId: string) => contractsApi.signedScan(sc.id, fileId));
    const [uploading, setUploading] = useState(false);

    const onFile = async (file: File) => {
        setUploading(true);
        try {
            const dto = await uploadFile(file, 'contract_scan');
            await attach.mutateAsync(dto.id);
            void message.success('แนบสัญญาที่ลงนามแล้ว');
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        } finally {
            setUploading(false);
        }
    };

    if (sc.documentPdf === null && sc.signedScan === null && !canUpload) return null;
    return (
        <section className="flex flex-wrap items-center gap-3">
            {sc.documentPdf !== null && (
                <a href={sc.documentPdf.url} target="_blank" rel="noreferrer"><Button icon={<FilePdfOutlined />}>PDF สัญญา</Button></a>
            )}
            {sc.signedScan !== null && (
                <a href={sc.signedScan.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                    <PaperClipOutlined /> สัญญาที่ลงนาม ({sc.signedScan.name})
                </a>
            )}
            {canUpload && (
                <Upload accept="image/*,application/pdf" showUploadList={false}
                    beforeUpload={(file) => { void onFile(file); return false; }}>
                    <Button icon={<UploadOutlined />} loading={uploading}>
                        {sc.signedScan === null ? 'แนบสแกนสัญญาที่ลงนาม' : 'แนบฉบับใหม่'}
                    </Button>
                </Upload>
            )}
        </section>
    );
}

export function LinesTable({ sc }: { sc: SubcontractDto }) {
    const hasMat = sc.lines.some(l => l.matUnitPrice !== null);
    return (
        <Table<SubcontractLineDto>
            size="small"
            rowKey="idx"
            dataSource={sc.lines}
            pagination={false}
            scroll={{ x: 720 }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="เหมารวม" /> }}
            columns={[
                { title: 'ที่', dataIndex: 'idx', width: 56, align: 'center' },
                { title: 'รายการ', dataIndex: 'desc' },
                { title: 'ปริมาณ', dataIndex: 'qty', width: 90, align: 'right', render: (v: number) => <span className="tabular-nums">{fmtQty(v)}</span> },
                { title: 'หน่วย', dataIndex: 'unit', width: 70 },
                ...(hasMat ? [{
                    title: 'ค่าวัสดุ/หน่วย', dataIndex: 'matUnitPrice', width: 120, align: 'right' as const,
                    render: (v: number | null) => (v === null ? '' : <Money value={v} />),
                }] : []),
                {
                    title: 'ค่าแรง/หน่วย', dataIndex: 'unitPrice', width: 120, align: 'right',
                    render: (v: number | null) => (v === null ? '' : <Money value={v} />),
                },
                { title: 'รวม', dataIndex: 'total', width: 130, align: 'right', render: (v: number) => <Money value={v} /> },
            ]}
            summary={() => (
                <>
                    <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={hasMat ? 6 : 5} align="right">ราคาตามที่ตกลง</Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right"><Money value={sc.baseTotal} /></Table.Summary.Cell>
                    </Table.Summary.Row>
                    {sc.variationsTotal !== 0 && (
                        <Table.Summary.Row>
                            <Table.Summary.Cell index={0} colSpan={hasMat ? 6 : 5} align="right">งานเพิ่ม-ลดที่ตกลงแล้ว</Table.Summary.Cell>
                            <Table.Summary.Cell index={1} align="right"><Money value={sc.variationsTotal} /></Table.Summary.Cell>
                        </Table.Summary.Row>
                    )}
                    <Table.Summary.Row className="font-semibold">
                        <Table.Summary.Cell index={0} colSpan={hasMat ? 6 : 5} align="right">มูลค่าสัญญา</Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right"><Money value={sc.total} strong /></Table.Summary.Cell>
                    </Table.Summary.Row>
                </>
            )}
        />
    );
}

function EditDocumentModal({ subcontractId, html, onClose }: { subcontractId: string; html: string; onClose: () => void }) {
    const { message } = App.useApp();
    const qc = useQueryClient();
    const [draft, setDraft] = useState(html);
    const [view, setView] = useState<'edit' | 'preview'>('edit');
    const save = useContractMutation(subcontractId, (body: string) => contractsApi.putDocument(subcontractId, body));
    const empty = draft.trim() === '';

    const submit = async () => {
        try {
            const doc = await save.mutateAsync(draft);
            qc.setQueryData(scKeys.document(subcontractId), doc);
            void message.success(`ส่งฉบับที่ ${String(doc.version)} ให้ผู้รับจ้างแล้ว`);
            onClose();
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };

    return (
        <Modal open width={900} title="แก้ข้อความสัญญา" okText="บันทึกและส่งฉบับใหม่" cancelText="ยกเลิก"
            okButtonProps={{ disabled: empty || draft === html, loading: save.isPending }}
            onOk={() => { void submit(); }} onCancel={onClose}>
            <Segmented className="mb-3" value={view} onChange={v => setView(v === 'preview' ? 'preview' : 'edit')}
                options={[{ value: 'edit', label: 'แก้ไข (HTML)' }, { value: 'preview', label: 'ตัวอย่าง' }]} />
            {view === 'edit' ? (
                <Input.TextArea value={draft} onChange={e => setDraft(e.target.value)} rows={22} maxLength={200_000}
                    className="font-mono text-[12px]" spellCheck={false} />
            ) : (
                // Preview of the user's own draft in a sandbox (no scripts, no same-origin); the server sanitises on save.
                <iframe title="ตัวอย่างสัญญา" sandbox="" srcDoc={previewDoc(draft)} className="w-full h-[520px] border border-gray-200 rounded-control bg-white" />
            )}
        </Modal>
    );
}

function previewDoc(body: string): string {
    return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Sarabun,'TH Sarabun New',Tahoma,sans-serif;font-size:15px;line-height:1.6;padding:24px;color:#111}table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 6px}</style></head><body>${body}</body></html>`;
}
