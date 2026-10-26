'use client';

// ─── /vendor/contracts/[id]: the crew's contract — accept, claim installments, payments, variations, retention ───
import { useState } from 'react';
import { Alert, App, Button, Collapse, Input, Rate, Segmented } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ClaimDto, ContractDocumentDto, FileDto, SubcontractDto, VariationDto } from '@/shared/contract';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { useSession } from '@/features/cloud/auth/session';
import { vendorApi, vk } from '../api';
import { parseAmount } from '../bid-form';
import {
    CLAIM_STATUS_TEXT, INSPECTION_TEXT, INSTALLMENT_STATE_TEXT, claimableInstallment, expectedNet, latestClaims,
    needsNewClaim,
} from '../contract-math';
import {
    PROVIDER_TEXT, PROVISION_LABEL, SUBCONTRACT_STATUS_TEXT, formatBaht, formatDateTime, formatDay, formatMoney, formatPct,
    formatQty, locationText, penaltyText, scheduleText,
} from '../format';
import { useClaims, useContractDocument, useRetentionEntries, useSubcontract, useVariations } from '../hooks';
import { BottomBar, ErrorState, Fact, FileList, PageSpinner, Section, Sheet, SignInPrompt } from '../ui/common';
import { PhotoPicker } from '../ui/PhotoPicker';

const MAX_CLAIM_PHOTOS = 10;

function useOnError() {
    const { message } = App.useApp();
    return (e: unknown) => { void message.error(thaiErrorMessage(e)); };
}

// ── Header ──

function ContractHeader({ sc }: { sc: SubcontractDto }) {
    return (
        <Section>
            <div className="text-secondary text-gray-600">{sc.buyerName} · สัญญา {sc.contractNo}</div>
            <h1 className="m-0 mt-1 text-card-title font-semibold text-gray-900">{sc.title}</h1>
            <div className="mt-1 text-secondary text-gray-700">{SUBCONTRACT_STATUS_TEXT[sc.status]}</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
                <div><div className="text-caption text-gray-600">ค่างานทั้งหมด</div><div className="text-body font-semibold">{formatBaht(sc.total)}</div></div>
                <div><div className="text-caption text-gray-600">ได้รับแล้ว</div><div className="text-body font-semibold">{formatBaht(sc.paidTotal)}</div></div>
                <div><div className="text-caption text-gray-600">เงินประกันค้าง</div><div className="text-body font-semibold">{formatBaht(sc.retentionBalance)}</div></div>
            </div>
        </Section>
    );
}

// ── Contract document (sandboxed: the buyer can edit its HTML) ──

function DocumentFrame({ doc }: { doc: ContractDocumentDto }) {
    return (
        <iframe title={`สัญญา ฉบับที่ ${String(doc.version)}`} sandbox="" srcDoc={doc.html}
            className="w-full border border-gray-200 rounded-control bg-white" style={{ height: '60vh' }} />
    );
}

function ContractDetails({ sc, showDocument }: { sc: SubcontractDto; showDocument: boolean }) {
    const doc = useContractDocument(sc.id, showDocument);
    const t = sc.terms;
    return (
        <div className="flex flex-col gap-3">
            <Section title="รายการงานในสัญญา">
                {sc.lines.map(l => (
                    <div key={l.idx} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-gray-100 last:border-b-0">
                        <span className="text-secondary text-gray-800">{l.desc} <span className="text-gray-500">· {formatQty(l.qty)} {l.unit}</span></span>
                        <span className="shrink-0 text-secondary font-medium">{formatMoney(l.total)}</span>
                    </div>
                ))}
                <Fact label="รวมตามสัญญา">{formatBaht(sc.baseTotal)}</Fact>
                {sc.variationsTotal !== 0 && <Fact label="งานเพิ่ม-ลด">{formatBaht(sc.variationsTotal)}</Fact>}
            </Section>
            <Section title="เงื่อนไข">
                {locationText(sc.location) !== '' && <Fact label="สถานที่">{locationText(sc.location)}{sc.location.address === '' ? '' : ` · ${sc.location.address}`}</Fact>}
                {scheduleText(sc.schedule) !== '' && <Fact label="ช่วงเวลา">{scheduleText(sc.schedule)}</Fact>}
                <Fact label="หักเงินประกันผลงาน">{t.retentionPct > 0 ? `${formatPct(t.retentionPct)} ของแต่ละงวด` : 'ไม่หัก'}</Fact>
                <Fact label="รับประกันผลงาน">{t.warrantyMonths > 0 ? `${String(t.warrantyMonths)} เดือน` : 'ไม่มี'}</Fact>
                <Fact label="ค่าปรับ">{penaltyText(t.penalty)}</Fact>
                {t.whtPct > 0 && <Fact label="หักภาษี ณ ที่จ่าย">{formatPct(t.whtPct)}</Fact>}
                {t.vat && <Fact label="VAT">บวก 7%</Fact>}
                {(Object.keys(PROVISION_LABEL) as (keyof typeof PROVISION_LABEL)[]).map(k => (
                    <Fact key={k} label={PROVISION_LABEL[k]}>{PROVIDER_TEXT[t.provisions[k]]}</Fact>
                ))}
            </Section>
            {showDocument && (
                <Section title={doc.data === undefined ? 'ตัวสัญญา' : `ตัวสัญญา ฉบับที่ ${String(doc.data.version)}`}>
                    {doc.isPending ? <PageSpinner /> : doc.isError ? <ErrorState error={doc.error} onRetry={() => { void doc.refetch(); }} /> : <DocumentFrame doc={doc.data} />}
                    {sc.documentPdf !== null && <div className="mt-3"><FileList files={[sc.documentPdf]} /></div>}
                    {sc.signedScan !== null && <div className="mt-3"><FileList files={[sc.signedScan]} /></div>}
                </Section>
            )}
        </div>
    );
}

// ── Pending acceptance ──

function ChangeRequestForm({ onSubmit, busy }: { onSubmit: (text: string) => void; busy: boolean }) {
    const [text, setText] = useState('');
    return (
        <div className="flex flex-col gap-3">
            <Input.TextArea value={text} onChange={e => setText(e.target.value)} autoSize={{ minRows: 3, maxRows: 8 }} maxLength={2000}
                placeholder="บอกผู้ว่าจ้างว่าอยากแก้ข้อไหน เช่น ขอแบ่งงวดแรกเป็น 40%" />
            <Button type="primary" size="large" block disabled={text.trim() === ''} loading={busy} onClick={() => onSubmit(text.trim())}>ส่งคำขอแก้ไข</Button>
        </div>
    );
}

function PendingAcceptance({ sc }: { sc: SubcontractDto }) {
    const qc = useQueryClient();
    const { message, modal } = App.useApp();
    const onError = useOnError();
    const doc = useContractDocument(sc.id, true);
    const [changeOpen, setChangeOpen] = useState(false);
    const refresh = () => qc.invalidateQueries({ queryKey: vk.all });

    const accept = useMutation({
        mutationFn: (documentVersion: number) => vendorApi.contract.accept(sc.id, { documentVersion }),
        onSuccess: () => { void message.success('ยอมรับเงื่อนไขแล้ว เริ่มงานได้ตามสัญญา'); void refresh(); },
        onError: (e) => { onError(e); void refresh(); },
    });
    const change = useMutation({
        mutationFn: (text: string) => vendorApi.contract.requestChange(sc.id, { text }),
        onSuccess: () => { setChangeOpen(false); void message.success('ส่งคำขอแก้ไขแล้ว'); void refresh(); },
        onError,
    });

    const confirmAccept = () => {
        if (doc.data === undefined) return;
        const version = doc.data.version;
        modal.confirm({
            title: 'ยอมรับเงื่อนไขสัญญานี้?',
            content: `การกดยอมรับเป็นหลักฐานว่าคุณตกลงตามสัญญาฉบับที่ ${String(version)} ยอด ${formatBaht(sc.total)} (ยังลงนามสัญญาตัวจริงกับผู้ว่าจ้างตามปกติ)`,
            okText: 'ยอมรับ', cancelText: 'ยังก่อน',
            onOk: () => accept.mutateAsync(version),
        });
    };

    const openRequests = sc.changeRequests.filter(c => !c.resolved);
    return (
        <>
            <Section tone="highlight">
                <div className="text-section font-medium text-gray-900">อ่านเงื่อนไขแล้วกดยอมรับ</div>
                <div className="mt-1 text-secondary text-gray-600">ถ้ามีข้อไหนไม่ตรงที่คุยกัน กด &quot;ขอแก้ไข&quot; ผู้ว่าจ้างจะส่งฉบับใหม่มาให้</div>
                {openRequests.map(c => (
                    <div key={c.at} className="mt-2 text-secondary text-gray-700">คุณขอแก้ ({formatDateTime(c.at)}): {c.text}</div>
                ))}
            </Section>
            <ContractDetails sc={sc} showDocument />
            <Button type="text" size="large" block onClick={() => setChangeOpen(true)}>ขอแก้ไข</Button>
            <BottomBar>
                <Button type="primary" size="large" block disabled={doc.data === undefined} loading={accept.isPending} onClick={confirmAccept}>ยอมรับเงื่อนไข</Button>
            </BottomBar>
            <Sheet open={changeOpen} onClose={() => setChangeOpen(false)} title="ขอแก้ไขสัญญา">
                <ChangeRequestForm busy={change.isPending} onSubmit={t => change.mutate(t)} />
            </Sheet>
        </>
    );
}

// ── Installments and claims ──

function ClaimInfo({ claim }: { claim: ClaimDto }) {
    const insp = claim.inspection;
    return (
        <div className="mt-2 rounded-control bg-gray-50 px-3 py-2 text-secondary">
            <div className="text-gray-800">{claim.status === 'inspected' && insp !== null ? `ตรวจงานแล้ว: ${INSPECTION_TEXT[insp.result]}` : CLAIM_STATUS_TEXT[claim.status]}</div>
            {insp !== null && insp.fixes.length > 0 && (
                <ul className="m-0 mt-1 pl-4 text-gray-700">
                    {insp.fixes.map(f => <li key={f.text} className={f.done ? 'line-through text-gray-500' : ''}>{f.text}</li>)}
                </ul>
            )}
            {insp !== null && insp.note !== '' && <div className="mt-1 text-gray-600">{insp.byName}: {insp.note}</div>}
            {claim.status === 'rejected' && claim.rejectedReason !== null && <div className="mt-1 text-gray-600">เหตุผล: {claim.rejectedReason}</div>}
            {claim.status === 'paid' && claim.paidAmount !== null && (
                <div className="mt-1 text-green-700">
                    ได้รับ {formatBaht(claim.paidAmount)}{claim.paidAt === null ? '' : ` เมื่อ ${formatDay(claim.paidAt)}`}
                    {claim.paidChannel !== null && claim.paidChannel !== '' ? ` · ${claim.paidChannel}` : ''}
                </div>
            )}
        </div>
    );
}

function ClaimForm({ installmentNo, onSubmit, busy }: {
    installmentNo: number; onSubmit: (photos: FileDto[], note: string) => void; busy: boolean;
}) {
    const [photos, setPhotos] = useState<FileDto[]>([]);
    const [note, setNote] = useState('');
    return (
        <div className="flex flex-col gap-3">
            <div className="text-secondary text-gray-600">แนบรูปงานที่เสร็จอย่างน้อย 1 รูป ผู้ว่าจ้างจะนัดตรวจงานงวด {installmentNo}</div>
            <PhotoPicker photos={photos} max={MAX_CLAIM_PHOTOS} purpose="claim_photo" label="ถ่าย/เลือกรูปงาน"
                onAdd={f => setPhotos(p => (p.some(x => x.id === f.id) || p.length >= MAX_CLAIM_PHOTOS ? p : [...p, f]))}
                onRemove={id => setPhotos(p => p.filter(x => x.id !== id))} />
            <Input.TextArea value={note} onChange={e => setNote(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000}
                placeholder="บอกผู้ว่าจ้างสั้น ๆ (ไม่บังคับ)" />
            <Button type="primary" size="large" block disabled={photos.length === 0} loading={busy} onClick={() => onSubmit(photos, note.trim())}>ส่งขอเบิกงวด {installmentNo}</Button>
        </div>
    );
}

function Installments({ sc, claims, claimable, onClaim }: {
    sc: SubcontractDto; claims: readonly ClaimDto[]; claimable: number | null; onClaim: () => void;
}) {
    const latest = latestClaims(claims);
    return (
        <Section title="งวดงาน">
            <div className="flex flex-col gap-2">
                {sc.installments.map(inst => {
                    const net = expectedNet(inst.amount, sc.terms, sc.lines);
                    const claim = latest.get(inst.no);
                    const isNext = sc.nextInstallment === inst.no;
                    return (
                        <div key={inst.no} className={`rounded-card border px-3 py-3 ${isNext ? 'border-orange-300 bg-orange-50/40' : 'border-gray-200'}`}>
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="text-body font-medium text-gray-900">งวด {inst.no} · {formatPct(inst.pct)}</span>
                                <span className="text-body font-semibold">{formatBaht(inst.amount)}</span>
                            </div>
                            <div className="text-secondary text-gray-700">{inst.condition}</div>
                            <div className="mt-1 flex items-baseline justify-between gap-3 text-caption text-gray-600">
                                <span className={inst.state === 'paid' ? 'text-green-700' : ''}>{INSTALLMENT_STATE_TEXT[inst.state]}</span>
                                {inst.state !== 'paid' && <span>รับสุทธิประมาณ {formatBaht(net.net)}</span>}
                            </div>
                            {claim !== undefined && <ClaimInfo claim={claim} />}
                            {claimable === inst.no && (
                                <Button className="!mt-3" type="primary" size="large" block onClick={onClaim}>
                                    {claim !== undefined && needsNewClaim(claim) ? `ขอเบิกงวด ${String(inst.no)} อีกครั้ง` : `ขอเบิกงวด ${String(inst.no)}`}
                                </Button>
                            )}
                        </div>
                    );
                })}
            </div>
            {sc.terms.retentionPct > 0 || sc.terms.whtPct > 0 || sc.terms.vat ? (
                <div className="mt-2 text-caption text-gray-500">
                    ยอดสุทธิ = ค่างวด{sc.terms.retentionPct > 0 ? ` − เงินประกัน ${formatPct(sc.terms.retentionPct)}` : ''}
                    {sc.terms.whtPct > 0 ? ` − ภาษี ณ ที่จ่าย ${formatPct(sc.terms.whtPct)}` : ''}{sc.terms.vat ? ' + VAT 7%' : ''} (ประมาณ ก่อนผู้ว่าจ้างปรับยอด)
                </div>
            ) : null}
        </Section>
    );
}

function Payments({ claims }: { claims: readonly ClaimDto[] }) {
    const paid = claims.filter(c => c.status === 'paid').sort((a, b) => a.installmentNo - b.installmentNo);
    if (paid.length === 0) return null;
    return (
        <Section title="เงินที่ได้รับแล้ว">
            {paid.map(c => (
                <Fact key={c.id} label={`งวด ${String(c.installmentNo)}${c.paidAt === null ? '' : ` · ${formatDay(c.paidAt)}`}`}>
                    {formatBaht(c.paidAmount ?? c.amounts.net)}
                    {c.paidRef !== null && c.paidRef !== '' && <div className="text-caption text-gray-500">อ้างอิง {c.paidRef}</div>}
                </Fact>
            ))}
        </Section>
    );
}

// ── Retention (what the crew cares about most) ──

function Retention({ sc }: { sc: SubcontractDto }) {
    const entries = useRetentionEntries(sc.id);
    const r = sc.retention;
    if (r.withheld === 0 && r.balance === 0) return null;
    return (
        <Section title="เงินประกันผลงานของคุณ" tone={r.balance > 0 ? 'highlight' : 'default'}>
            <div className="text-caption text-gray-600">ผู้ว่าจ้างยังถือไว้</div>
            <div className="text-figure font-bold text-gray-900">{formatBaht(r.balance)}</div>
            <div className="mt-2">
                <Fact label="หักไว้ทั้งหมด">{formatBaht(r.withheld)}</Fact>
                {r.released > 0 && <Fact label="คืนแล้ว">{formatBaht(r.released)}</Fact>}
                {r.forfeited > 0 && <Fact label="ถูกหักไป (เช่น ค่าปรับ)">{formatBaht(r.forfeited)}</Fact>}
            </div>
            {r.schedule.length > 0 && (
                <div className="mt-3">
                    <div className="text-secondary font-medium text-gray-700 mb-1">กำหนดคืน</div>
                    {r.schedule.map(s => (
                        <Fact key={`${s.label}-${s.dueAt ?? ''}`} label={`${s.label}${s.dueAt === null ? '' : ` · ${formatDay(s.dueAt)}`}`}>{formatBaht(s.amount)}</Fact>
                    ))}
                </div>
            )}
            {entries.data !== undefined && entries.data.length > 0 && (
                <Collapse ghost className="!mt-2 -mx-4" items={[{
                    key: 'entries', label: 'ประวัติการหักและคืน',
                    children: entries.data.map(e => (
                        <Fact key={e.id} label={`${e.kind === 'withheld' ? 'หัก' : e.kind === 'released' ? 'คืน' : 'ถูกหักไป'} · ${formatDateTime(e.at)}`}>
                            {formatBaht(e.amount)}{e.note !== '' && <div className="text-caption text-gray-500">{e.note}</div>}
                        </Fact>
                    )),
                }]} />
            )}
        </Section>
    );
}

// ── Variations (งานเพิ่ม-ลด) ──

interface VarLine { desc: string; unit: string; qty: string; unitPrice: string }

function VariationForm({ onSubmit, busy }: { onSubmit: (lines: VarLine[], sign: 1 | -1, reason: string) => void; busy: boolean }) {
    const [sign, setSign] = useState<1 | -1>(1);
    const [lines, setLines] = useState<VarLine[]>([{ desc: '', unit: '', qty: '', unitPrice: '' }]);
    const [reason, setReason] = useState('');
    const set = (k: number, patch: Partial<VarLine>) => setLines(ls => ls.map((l, i) => (i === k ? { ...l, ...patch } : l)));
    const total = lines.reduce((s, l) => s + (parseAmount(l.qty) ?? 0) * (parseAmount(l.unitPrice) ?? 0), 0) * sign;
    const ok = reason.trim() !== '' && lines.every(l => l.desc.trim() !== '' && l.unit.trim() !== '' && parseAmount(l.qty) !== null && parseAmount(l.unitPrice) !== null);
    return (
        <div className="flex flex-col gap-3">
            <Segmented<1 | -1> block value={sign} onChange={v => setSign(v)} options={[{ value: 1, label: 'งานเพิ่ม' }, { value: -1, label: 'งานลด' }]} />
            {lines.map((l, k) => (
                <div key={k} className="flex flex-col gap-2 border-b border-gray-100 pb-3">
                    <Input value={l.desc} onChange={e => set(k, { desc: e.target.value })} maxLength={300} placeholder="รายการ เช่น ก่อผนังเพิ่มห้องเก็บของ" />
                    <div className="grid grid-cols-3 gap-2">
                        <Input value={l.qty} onChange={e => set(k, { qty: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" placeholder="จำนวน" />
                        <Input value={l.unit} onChange={e => set(k, { unit: e.target.value })} maxLength={20} placeholder="หน่วย" />
                        <Input value={l.unitPrice} onChange={e => set(k, { unitPrice: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" placeholder="บาท/หน่วย" />
                    </div>
                </div>
            ))}
            <Button onClick={() => setLines(ls => [...ls, { desc: '', unit: '', qty: '', unitPrice: '' }])}>เพิ่มรายการ</Button>
            <Input.TextArea value={reason} onChange={e => setReason(e.target.value)} autoSize={{ minRows: 2, maxRows: 5 }} maxLength={1000} placeholder="เหตุผล เช่น ผู้ว่าจ้างขอเพิ่มหน้างาน" />
            <div className="text-right text-body font-semibold">{total >= 0 ? 'เพิ่ม' : 'ลด'} {formatBaht(Math.abs(total))}</div>
            <Button type="primary" size="large" block disabled={!ok} loading={busy} onClick={() => onSubmit(lines, sign, reason.trim())}>ส่งให้ผู้ว่าจ้างพิจารณา</Button>
        </div>
    );
}

const VARIATION_STATUS = { proposed: 'รอตอบ', accepted: 'ตกลงแล้ว', rejected: 'ไม่ตกลง' } as const;

function Variations({ sc, list, readOnly }: { sc: SubcontractDto; list: readonly VariationDto[]; readOnly: boolean }) {
    const qc = useQueryClient();
    const { message } = App.useApp();
    const onError = useOnError();
    const [open, setOpen] = useState(false);
    const refresh = () => qc.invalidateQueries({ queryKey: vk.all });
    const respond = useMutation({
        mutationFn: (v: { id: string; accept: boolean }) => vendorApi.contract.respondVariation(v.id, { accept: v.accept }),
        onSuccess: () => { void message.success('ตอบผู้ว่าจ้างแล้ว'); void refresh(); },
        onError,
    });
    const propose = useMutation({
        mutationFn: (v: { lines: VarLine[]; sign: 1 | -1; reason: string }) => vendorApi.contract.proposeVariation(sc.id, {
            reason: v.reason,
            lines: v.lines.map(l => ({ desc: l.desc.trim(), unit: l.unit.trim(), qty: (parseAmount(l.qty) ?? 0) * v.sign, unitPrice: parseAmount(l.unitPrice) ?? 0 })),
        }),
        onSuccess: () => { setOpen(false); void message.success('ส่งงานเพิ่ม-ลดแล้ว'); void refresh(); },
        onError,
    });
    const canPropose = sc.status === 'active' && !readOnly;
    if (list.length === 0 && !canPropose) return null;
    return (
        <Section title="งานเพิ่ม-ลด" extra={canPropose ? <Button onClick={() => setOpen(true)}>เสนอ</Button> : undefined}>
            {list.length === 0 ? (
                <div className="text-secondary text-gray-500">ยังไม่มี งานที่เพิ่มหรือลดจากสัญญาต้องตกลงกันที่นี่ก่อน</div>
            ) : list.map(v => (
                <div key={v.id} className="py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-baseline justify-between gap-3">
                        <span className="text-body text-gray-900">{v.reason}</span>
                        <span className="shrink-0 text-body font-semibold">{v.amount >= 0 ? '+' : '−'}{formatBaht(Math.abs(v.amount))}</span>
                    </div>
                    <div className="text-caption text-gray-600">
                        {v.proposedBy === 'vendor' ? 'คุณเสนอ' : 'ผู้ว่าจ้างเสนอ'} · {VARIATION_STATUS[v.status]} · {formatDateTime(v.createdAt)}
                    </div>
                    {v.status === 'proposed' && v.proposedBy === 'buyer' && sc.status === 'active' && !readOnly && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <Button size="large" disabled={respond.isPending} onClick={() => respond.mutate({ id: v.id, accept: false })}>ไม่ตกลง</Button>
                            <Button size="large" type="primary" loading={respond.isPending} onClick={() => respond.mutate({ id: v.id, accept: true })}>ตกลง</Button>
                        </div>
                    )}
                </div>
            ))}
            <Sheet open={open} onClose={() => setOpen(false)} title="เสนองานเพิ่ม-ลด">
                <VariationForm busy={propose.isPending} onSubmit={(lines, sign, reason) => propose.mutate({ lines, sign, reason })} />
            </Sheet>
        </Section>
    );
}

// ── Rating the buyer ──

function RateBuyer({ sc }: { sc: SubcontractDto }) {
    const qc = useQueryClient();
    const { message } = App.useApp();
    const onError = useOnError();
    const [payment, setPayment] = useState(0);
    const [communication, setCommunication] = useState(0);
    const [comment, setComment] = useState('');
    const rate = useMutation({
        mutationFn: () => vendorApi.contract.rate(sc.id, { scores: { payment, communication }, comment: comment.trim() }),
        onSuccess: () => { void message.success('ขอบคุณที่ให้คะแนน'); void qc.invalidateQueries({ queryKey: vk.contract(sc.id) }); },
        onError,
    });
    return (
        <Section title={`ให้คะแนน ${sc.buyerName}`}>
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2"><span className="text-body">การจ่ายเงิน</span><Rate value={payment} onChange={setPayment} /></div>
                <div className="flex items-center justify-between gap-2"><span className="text-body">การติดต่อสื่อสาร</span><Rate value={communication} onChange={setCommunication} /></div>
                <Input.TextArea value={comment} onChange={e => setComment(e.target.value)} autoSize={{ minRows: 2, maxRows: 5 }} maxLength={1000} placeholder="ความเห็นเพิ่มเติม (ไม่บังคับ)" />
                <Button type="primary" size="large" block disabled={payment === 0 || communication === 0} loading={rate.isPending} onClick={() => rate.mutate()}>ส่งคะแนน</Button>
            </div>
        </Section>
    );
}

// ── Page ──

function ContractBody({ sc }: { sc: SubcontractDto }) {
    const qc = useQueryClient();
    const { message } = App.useApp();
    const onError = useOnError();
    const claims = useClaims(sc.id);
    const variations = useVariations(sc.id);
    const [claimOpen, setClaimOpen] = useState(false);
    const claimList = claims.data ?? [];
    // The buyer switched subcontracting off: the contract stays readable, every action is hidden.
    const readOnly = !sc.buyerModuleOn;
    const claimable = readOnly ? null : claimableInstallment(sc, claimList);

    const request = useMutation({
        mutationFn: (v: { photos: FileDto[]; note: string }) => vendorApi.contract.requestClaim(sc.id, {
            installmentNo: claimable ?? 0, note: v.note, photoFileIds: v.photos.map(p => p.id),
        }),
        onSuccess: () => { setClaimOpen(false); void message.success('ส่งขอเบิกแล้ว ผู้ว่าจ้างจะได้รับแจ้ง'); void qc.invalidateQueries({ queryKey: vk.all }); },
        onError,
    });

    const readOnlyNote = readOnly ? <div className="px-1 text-secondary text-gray-500">ผู้ว่าจ้างปิดระบบจ้างช่วงชั่วคราว ดูได้อย่างเดียว</div> : null;

    if (sc.status === 'pending_acceptance') {
        return (
            <div className="flex flex-col gap-3">
                <ContractHeader sc={sc} />
                {readOnly ? <>{readOnlyNote}<ContractDetails sc={sc} showDocument /></> : <PendingAcceptance sc={sc} />}
            </div>
        );
    }

    const ended = sc.status === 'completed' || sc.status === 'closed' || sc.status === 'terminated';
    return (
        <div className="flex flex-col gap-3">
            <ContractHeader sc={sc} />
            {readOnlyNote}
            {sc.status === 'cancelled' || sc.status === 'terminated' ? (
                <Alert type="info" showIcon title={sc.status === 'cancelled' ? 'สัญญานี้ถูกยกเลิก' : 'สัญญานี้ถูกเลิกก่อนกำหนด'}
                    description={sc.endReason ?? undefined} />
            ) : null}
            {ended && !sc.myRating.submitted && !readOnly && <RateBuyer sc={sc} />}
            {claims.isError && <ErrorState error={claims.error} onRetry={() => { void claims.refetch(); }} />}
            {sc.status !== 'cancelled' && (
                <Installments sc={sc} claims={claimList} claimable={claimable} onClaim={() => setClaimOpen(true)} />
            )}
            <Retention sc={sc} />
            <Payments claims={claimList} />
            {variations.data !== undefined && <Variations sc={sc} list={variations.data} readOnly={readOnly} />}
            <Collapse className="bg-white" items={[{
                key: 'details', label: 'รายละเอียดสัญญา',
                children: <ContractDetails sc={sc} showDocument />,
            }]} />
            <Sheet open={claimOpen} onClose={() => setClaimOpen(false)} title={claimable === null ? 'ขอเบิกงวด' : `ขอเบิกงวด ${String(claimable)}`}>
                {claimable !== null && (
                    <ClaimForm installmentNo={claimable} busy={request.isPending} onSubmit={(photos, note) => request.mutate({ photos, note })} />
                )}
            </Sheet>
        </div>
    );
}

export function ContractPage({ id }: { id: string }) {
    const status = useSession(s => s.status);
    const q = useSubcontract(id);
    if (status === 'unknown') return <PageSpinner />;
    if (status === 'guest') return <SignInPrompt next={`/vendor/contracts/${id}`} />;
    if (q.isPending) return <PageSpinner />;
    if (q.isError) return <ErrorState error={q.error} onRetry={() => { void q.refetch(); }} />;
    return <ContractBody sc={q.data} />;
}
