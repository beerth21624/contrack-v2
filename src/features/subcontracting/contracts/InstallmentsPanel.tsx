'use client';

// ─── Installments tab: งวด · เงื่อนไขส่งมอบ · % · จำนวนเงิน · สถานะ, and the claim flow of each installment ───
// One primary action per row (the next step of its claim); the claim's photos, inspection and amounts fold open below.
import { useState } from 'react';
import { Button, Empty, Image, Table, Tag, Tooltip } from 'antd';
import type { ClaimDto, SubcontractDto } from '@/shared/contract';
import type { Permission } from '@/features/cloud/permissions';
import { formatDateTime } from '@/features/cloud/ui/common';
import { useClaims, useScSettings } from './api';
import { AmountsTable, ApproveModal, InspectModal, PayModal, RejectModal, RequestClaimModal } from './ClaimModals';
import {
    CLAIM_STATUS_LABEL, INSPECTION_RESULT_LABEL, INSTALLMENT_STATE_COLOR, INSTALLMENT_STATE_LABEL, claimOfInstallment,
    fmtDate, fmtPct, openFixesBefore,
} from './logic';
import { LoadError, Money } from './ui';

type Installment = SubcontractDto['installments'][number];
type Dialog =
    | { kind: 'request'; installmentNo: number }
    | { kind: 'inspect' | 'approve' | 'pay' | 'reject'; claim: ClaimDto };

export function InstallmentsPanel({ sc, may }: { sc: SubcontractDto; may: (p: Permission) => boolean }) {
    const claims = useClaims(sc.id);
    const settings = useScSettings(sc.buyerWorkspaceId);
    const [dialog, setDialog] = useState<Dialog | null>(null);
    const list = claims.data ?? [];
    const active = sc.status === 'active';
    const fixesBlock = settings.data?.fixesBlockNextClaim ?? true;

    if (claims.isError) return <LoadError error={claims.error} />;
    if (sc.status === 'pending_acceptance') {
        return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="เริ่มเบิกงวดได้หลังผู้รับจ้างยอมรับสัญญา" />;
    }

    const action = (inst: Installment): React.ReactNode => {
        if (!active) return null;
        const claim = claimOfInstallment(list, inst);
        if (claim === undefined) {
            if (inst.state !== 'not_started' || !may('sc.claims.inspect')) return null;
            return <Button size="small" onClick={() => setDialog({ kind: 'request', installmentNo: inst.no })}>ขอเบิกแทน</Button>;
        }
        if (claim.status === 'requested' && may('sc.claims.inspect')) {
            return <Button size="small" type="primary" onClick={() => setDialog({ kind: 'inspect', claim })}>ตรวจรับ</Button>;
        }
        if (claim.status === 'inspected') {
            const passed = claim.inspection !== null && claim.inspection.result !== 'fail';
            if (!passed) {
                return may('sc.claims.inspect')
                    ? <Button size="small" onClick={() => setDialog({ kind: 'inspect', claim })}>ตรวจใหม่</Button>
                    : null;
            }
            if (!may('sc.claims.approve')) return null;
            const blocking = fixesBlock ? openFixesBefore(list, claim.installmentNo) : 0;
            const button = (
                <Button size="small" type="primary" disabled={blocking > 0} onClick={() => setDialog({ kind: 'approve', claim })}>อนุมัติ</Button>
            );
            return blocking > 0 ? <Tooltip title={`ต้องปิดรายการแก้ของงวดก่อนหน้า ${String(blocking)} รายการก่อน`}>{button}</Tooltip> : button;
        }
        if (claim.status === 'approved' && may('sc.payments.record')) {
            return <Button size="small" type="primary" onClick={() => setDialog({ kind: 'pay', claim })}>บันทึกจ่าย</Button>;
        }
        return null;
    };

    return (
        <>
            <Table<Installment>
                rowKey="no"
                size="middle"
                loading={claims.isLoading}
                dataSource={sc.installments}
                pagination={false}
                scroll={{ x: 760 }}
                expandable={{
                    rowExpandable: inst => list.some(c => c.installmentNo === inst.no),
                    expandedRowRender: inst => (
                        <ClaimDetails
                            claims={list.filter(c => c.installmentNo === inst.no)}
                            current={claimOfInstallment(list, inst)}
                            retentionPct={sc.terms.retentionPct}
                            onFixes={active && may('sc.claims.inspect') ? (claim) => setDialog({ kind: 'inspect', claim }) : undefined}
                            onReject={active && may('sc.claims.inspect') ? (claim) => setDialog({ kind: 'reject', claim }) : undefined}
                        />
                    ),
                }}
                columns={[
                    { title: 'งวด', dataIndex: 'no', width: 64, align: 'center' },
                    { title: 'เงื่อนไขส่งมอบ', dataIndex: 'condition' },
                    { title: '%', dataIndex: 'pct', width: 72, align: 'right', render: (v: number) => <span className="tabular-nums">{fmtPct(v)}</span> },
                    { title: 'จำนวนเงิน', dataIndex: 'amount', width: 130, align: 'right', render: (v: number) => <Money value={v} /> },
                    {
                        title: 'สถานะ', dataIndex: 'state', width: 120,
                        render: (_v, inst) => <Tag color={INSTALLMENT_STATE_COLOR[inst.state]} className="!m-0">{INSTALLMENT_STATE_LABEL[inst.state]}</Tag>,
                    },
                    { title: '', width: 120, align: 'right', render: (_v, inst) => action(inst) },
                ]}
            />
            {dialog?.kind === 'request' && <RequestClaimModal sc={sc} installmentNo={dialog.installmentNo} onClose={() => setDialog(null)} />}
            {dialog?.kind === 'inspect' && <InspectModal sc={sc} claim={dialog.claim} onClose={() => setDialog(null)} />}
            {dialog?.kind === 'approve' && <ApproveModal sc={sc} claim={dialog.claim} onClose={() => setDialog(null)} />}
            {dialog?.kind === 'pay' && <PayModal sc={sc} claim={dialog.claim} onClose={() => setDialog(null)} />}
            {dialog?.kind === 'reject' && <RejectModal sc={sc} claim={dialog.claim} onClose={() => setDialog(null)} />}
        </>
    );
}

function ClaimDetails({ claims, current, retentionPct, onFixes, onReject }: {
    claims: ClaimDto[];
    current: ClaimDto | undefined;
    retentionPct: number;
    onFixes?: (c: ClaimDto) => void;
    onReject?: (c: ClaimDto) => void;
}) {
    const rejected = claims.filter(c => c.status === 'rejected');
    return (
        <div className="flex flex-col gap-4 py-2">
            {current !== undefined && <ClaimCard claim={current} retentionPct={retentionPct} onFixes={onFixes} onReject={onReject} />}
            {rejected.length > 0 && (
                <div className="text-[12px] text-gray-500 flex flex-col gap-1">
                    {rejected.map(c => (
                        <div key={c.id}>ใบเบิกที่ไม่อนุมัติ {formatDateTime(c.requestedAt)}{c.rejectedReason !== null ? ` — ${c.rejectedReason}` : ''}</div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ClaimCard({ claim, retentionPct, onFixes, onReject }: {
    claim: ClaimDto;
    retentionPct: number;
    onFixes?: (c: ClaimDto) => void;
    onReject?: (c: ClaimDto) => void;
}) {
    const insp = claim.inspection;
    const openFixes = insp?.fixes.filter(f => !f.done).length ?? 0;
    const canReject = claim.status === 'requested' || claim.status === 'inspected';
    return (
        <div className="grid md:grid-cols-[1fr_320px] gap-6">
            <div className="flex flex-col gap-3 min-w-0">
                <div className="text-secondary text-gray-600">
                    {CLAIM_STATUS_LABEL[claim.status]} · ขอเบิกโดย{claim.requestedBy === 'buyer' ? 'ผู้ว่าจ้าง (แทน)' : 'ผู้รับจ้าง'} {formatDateTime(claim.requestedAt)}
                </div>
                {claim.note !== '' && <div className="whitespace-pre-wrap">{claim.note}</div>}
                {claim.photos.length > 0 && (
                    <Image.PreviewGroup>
                        <div className="flex flex-wrap gap-2">
                            {claim.photos.map(p => (
                                <Image key={p.id} src={p.url} alt={p.name} width={88} height={88} className="object-cover rounded-control" />
                            ))}
                        </div>
                    </Image.PreviewGroup>
                )}
                {insp !== null && (
                    <div className="flex flex-col gap-1">
                        <div>
                            ผลตรวจ: <span className={insp.result === 'fail' ? 'text-red-600 font-medium' : 'font-medium'}>{INSPECTION_RESULT_LABEL[insp.result]}</span>
                            <span className="text-[12px] text-gray-500"> · {insp.byName} {formatDateTime(insp.at)}</span>
                        </div>
                        {insp.checklist.length > 0 && (
                            <ul className="m-0 pl-5 text-secondary text-gray-700">
                                {insp.checklist.map(c => <li key={c.item} className={c.ok ? '' : 'text-red-600'}>{c.ok ? '✓' : '✗'} {c.item}</li>)}
                            </ul>
                        )}
                        {insp.fixes.length > 0 && (
                            <div>
                                <div className="text-secondary font-medium">รายการแก้ {openFixes > 0 ? <span className="text-amber-600">(ค้าง {openFixes})</span> : <span className="text-green-600">(ครบแล้ว)</span>}</div>
                                <ul className="m-0 pl-5 text-secondary">
                                    {insp.fixes.map((f, i) => <li key={`${f.text}-${String(i)}`} className={f.done ? 'text-gray-400 line-through' : ''}>{f.text}</li>)}
                                </ul>
                            </div>
                        )}
                        {insp.note !== '' && <div className="text-secondary text-gray-600 whitespace-pre-wrap">{insp.note}</div>}
                    </div>
                )}
                {claim.paidAt !== null && (
                    <div className="text-secondary text-green-700">
                        จ่ายแล้ว {fmtDate(claim.paidAt)} · <Money value={claim.paidAmount} /> บาท
                        {claim.paidChannel !== null && claim.paidChannel !== '' ? ` · ${claim.paidChannel}` : ''}
                        {claim.paidRef !== null && claim.paidRef !== '' ? ` · ${claim.paidRef}` : ''}
                    </div>
                )}
                <div className="flex flex-wrap gap-2">
                    {onFixes !== undefined && openFixes > 0 && claim.status !== 'requested' && (
                        <Button size="small" onClick={() => onFixes(claim)}>อัปเดตรายการแก้</Button>
                    )}
                    {onReject !== undefined && canReject && (
                        <Button size="small" type="text" danger onClick={() => onReject(claim)}>ไม่อนุมัติใบเบิก</Button>
                    )}
                </div>
            </div>
            <AmountsTable amounts={claim.amounts} retentionPct={retentionPct} />
        </div>
    );
}
