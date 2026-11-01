'use client';

// ─── /vendor/contracts/[id]: the crew's contract — accept, claim installments, payments, variations, retention ───
import { useState } from 'react';
import { Alert, App, Button, Collapse, Input, Rate, Segmented } from 'antd';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ClaimDto, ContractDocumentDto, FileDto, SubcontractDto, VariationDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useSession } from '@/features/cloud/auth/session';
import { vendorApi, vk } from '../api';
import { parseAmount } from '../bid-form';
import {
    claimStatusText, claimableInstallment, expectedNet, inspectionText, installmentStateText, latestClaims,
    needsNewClaim,
} from '../contract-math';
import {
    formatBaht, formatDateTime, formatDay, formatMoney, formatPct, formatQty, locationText, penaltyText, providerText,
    provisionLabel, scheduleText, subcontractStatusText,
} from '../format';
import { useClaims, useContractDocument, useRetentionEntries, useSubcontract, useVariations } from '../hooks';
import { BottomBar, ErrorState, Fact, FileList, PageSpinner, Section, Sheet, SignInPrompt } from '../ui/common';
import { PhotoPicker } from '../ui/PhotoPicker';

const MAX_CLAIM_PHOTOS = 10;

function useOnError() {
    const { message } = App.useApp();
    const toText = useErrorMessage();
    return (e: unknown) => { void message.error(toText(e)); };
}

// ── Header ──

function ContractHeader({ sc }: { sc: SubcontractDto }) {
    const t = useTranslations('vendor');
    return (
        <Section>
            <div className="text-secondary text-gray-600">{sc.buyerName} · {t('inbox.contractNo', { no: sc.contractNo })}</div>
            <h1 className="m-0 mt-1 text-card-title font-semibold text-gray-900">{sc.title}</h1>
            <div className="mt-1 text-secondary text-gray-700">{subcontractStatusText(sc.status, t)}</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
                <div><div className="text-caption text-gray-600">{t('contract.totalValue')}</div><div className="text-body font-semibold">{formatBaht(sc.total)}</div></div>
                <div><div className="text-caption text-gray-600">{t('inbox.received')}</div><div className="text-body font-semibold">{formatBaht(sc.paidTotal)}</div></div>
                <div><div className="text-caption text-gray-600">{t('inbox.retentionHeld')}</div><div className="text-body font-semibold">{formatBaht(sc.retentionBalance)}</div></div>
            </div>
        </Section>
    );
}

// ── Contract document (sandboxed: the buyer can edit its HTML) ──

function DocumentFrame({ doc }: { doc: ContractDocumentDto }) {
    const t = useTranslations('vendor');
    return (
        <iframe title={t('contract.docFrameTitle', { version: doc.version })} sandbox="" srcDoc={doc.html}
            className="w-full border border-gray-200 rounded-control bg-white" style={{ height: '60vh' }} />
    );
}

function ContractDetails({ sc, showDocument }: { sc: SubcontractDto; showDocument: boolean }) {
    const doc = useContractDocument(sc.id, showDocument);
    const t = useTranslations('vendor');
    const terms = sc.terms;
    return (
        <div className="flex flex-col gap-3">
            <Section title={t('contract.items')}>
                {sc.lines.map(l => (
                    <div key={l.idx} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-gray-100 last:border-b-0">
                        <span className="text-secondary text-gray-800">{l.desc} <span className="text-gray-500">· {formatQty(l.qty)} {l.unit}</span></span>
                        <span className="shrink-0 text-secondary font-medium">{formatMoney(l.total)}</span>
                    </div>
                ))}
                <Fact label={t('contract.baseTotal')}>{formatBaht(sc.baseTotal)}</Fact>
                {sc.variationsTotal !== 0 && <Fact label={t('contract.variations')}>{formatBaht(sc.variationsTotal)}</Fact>}
            </Section>
            <Section title={t('package.terms')}>
                {locationText(sc.location, t) !== '' && <Fact label={t('package.place')}>{locationText(sc.location, t)}{sc.location.address === '' ? '' : ` · ${sc.location.address}`}</Fact>}
                {scheduleText(sc.schedule, t) !== '' && <Fact label={t('package.period')}>{scheduleText(sc.schedule, t)}</Fact>}
                <Fact label={t('package.retention')}>{terms.retentionPct > 0 ? t('package.retentionPerInstallment', { pct: formatPct(terms.retentionPct) }) : t('package.noRetention')}</Fact>
                <Fact label={t('package.warranty')}>{terms.warrantyMonths > 0 ? t('package.warrantyMonths', { n: terms.warrantyMonths }) : t('package.noWarranty')}</Fact>
                <Fact label={t('package.penalty')}>{penaltyText(terms.penalty, t)}</Fact>
                {terms.whtPct > 0 && <Fact label={t('contract.wht')}>{formatPct(terms.whtPct)}</Fact>}
                {terms.vat && <Fact label="VAT">{t('contract.vatPlus')}</Fact>}
                {(['water', 'power', 'lodging', 'scaffolding'] as const).map(k => (
                    <Fact key={k} label={provisionLabel(k, t)}>{providerText(terms.provisions[k], t)}</Fact>
                ))}
            </Section>
            {showDocument && (
                <Section title={doc.data === undefined ? t('contract.document') : t('contract.documentVersion', { version: doc.data.version })}>
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
    const t = useTranslations('vendor');
    const [text, setText] = useState('');
    return (
        <div className="flex flex-col gap-3">
            <Input.TextArea value={text} onChange={e => setText(e.target.value)} autoSize={{ minRows: 3, maxRows: 8 }} maxLength={2000}
                placeholder={t('contract.changePlaceholder')} />
            <Button type="primary" size="large" block disabled={text.trim() === ''} loading={busy} onClick={() => onSubmit(text.trim())}>{t('contract.sendChange')}</Button>
        </div>
    );
}

function PendingAcceptance({ sc }: { sc: SubcontractDto }) {
    const t = useTranslations('vendor');
    const qc = useQueryClient();
    const { message, modal } = App.useApp();
    const onError = useOnError();
    const doc = useContractDocument(sc.id, true);
    const [changeOpen, setChangeOpen] = useState(false);
    const refresh = () => qc.invalidateQueries({ queryKey: vk.all });

    const accept = useMutation({
        mutationFn: (documentVersion: number) => vendorApi.contract.accept(sc.id, { documentVersion }),
        onSuccess: () => { void message.success(t('contract.accepted')); void refresh(); },
        onError: (e) => { onError(e); void refresh(); },
    });
    const change = useMutation({
        mutationFn: (text: string) => vendorApi.contract.requestChange(sc.id, { text }),
        onSuccess: () => { setChangeOpen(false); void message.success(t('contract.changeSent')); void refresh(); },
        onError,
    });

    const confirmAccept = () => {
        if (doc.data === undefined) return;
        const version = doc.data.version;
        modal.confirm({
            title: t('contract.acceptTitle'),
            content: t('contract.acceptContent', { version, total: formatBaht(sc.total) }),
            okText: t('contract.accept'), cancelText: t('contract.notYet'),
            onOk: () => accept.mutateAsync(version),
        });
    };

    const openRequests = sc.changeRequests.filter(c => !c.resolved);
    return (
        <>
            <Section tone="highlight">
                <div className="text-section font-medium text-gray-900">{t('contract.readAndAccept')}</div>
                <div className="mt-1 text-secondary text-gray-600">{t('contract.requestHint')}</div>
                {openRequests.map(c => (
                    <div key={c.at} className="mt-2 text-secondary text-gray-700">{t('contract.youRequested', { date: formatDateTime(c.at), text: c.text })}</div>
                ))}
            </Section>
            <ContractDetails sc={sc} showDocument />
            <Button type="text" size="large" block onClick={() => setChangeOpen(true)}>{t('contract.requestChange')}</Button>
            <BottomBar>
                <Button type="primary" size="large" block disabled={doc.data === undefined} loading={accept.isPending} onClick={confirmAccept}>{t('contract.acceptTerms')}</Button>
            </BottomBar>
            <Sheet open={changeOpen} onClose={() => setChangeOpen(false)} title={t('contract.changeTitle')}>
                <ChangeRequestForm busy={change.isPending} onSubmit={text => change.mutate(text)} />
            </Sheet>
        </>
    );
}

// ── Installments and claims ──

function ClaimInfo({ claim }: { claim: ClaimDto }) {
    const t = useTranslations('vendor');
    const insp = claim.inspection;
    return (
        <div className="mt-2 rounded-control bg-gray-50 px-3 py-2 text-secondary">
            <div className="text-gray-800">{claim.status === 'inspected' && insp !== null ? t('contract.inspectedResult', { result: inspectionText(insp.result, t) }) : claimStatusText(claim.status, t)}</div>
            {insp !== null && insp.fixes.length > 0 && (
                <ul className="m-0 mt-1 pl-4 text-gray-700">
                    {insp.fixes.map(f => <li key={f.text} className={f.done ? 'line-through text-gray-500' : ''}>{f.text}</li>)}
                </ul>
            )}
            {insp !== null && insp.note !== '' && <div className="mt-1 text-gray-600">{insp.byName}: {insp.note}</div>}
            {claim.status === 'rejected' && claim.rejectedReason !== null && <div className="mt-1 text-gray-600">{t('contract.reason', { text: claim.rejectedReason })}</div>}
            {claim.status === 'paid' && claim.paidAmount !== null && (
                <div className="mt-1 text-green-700">
                    {t('contract.received', { amount: formatBaht(claim.paidAmount) })}{claim.paidAt === null ? '' : ` ${t('contract.onDate', { date: formatDay(claim.paidAt) })}`}
                    {claim.paidChannel !== null && claim.paidChannel !== '' ? ` · ${claim.paidChannel}` : ''}
                </div>
            )}
        </div>
    );
}

function ClaimForm({ installmentNo, onSubmit, busy }: {
    installmentNo: number; onSubmit: (photos: FileDto[], note: string) => void; busy: boolean;
}) {
    const t = useTranslations('vendor');
    const [photos, setPhotos] = useState<FileDto[]>([]);
    const [note, setNote] = useState('');
    return (
        <div className="flex flex-col gap-3">
            <div className="text-secondary text-gray-600">{t('contract.claimHint', { no: installmentNo })}</div>
            <PhotoPicker photos={photos} max={MAX_CLAIM_PHOTOS} purpose="claim_photo" label={t('contract.pickPhotos')}
                onAdd={f => setPhotos(p => (p.some(x => x.id === f.id) || p.length >= MAX_CLAIM_PHOTOS ? p : [...p, f]))}
                onRemove={id => setPhotos(p => p.filter(x => x.id !== id))} />
            <Input.TextArea value={note} onChange={e => setNote(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000}
                placeholder={t('package.declineNote')} />
            <Button type="primary" size="large" block disabled={photos.length === 0} loading={busy} onClick={() => onSubmit(photos, note.trim())}>{t('contract.sendClaim', { no: installmentNo })}</Button>
        </div>
    );
}

function Installments({ sc, claims, claimable, onClaim }: {
    sc: SubcontractDto; claims: readonly ClaimDto[]; claimable: number | null; onClaim: () => void;
}) {
    const t = useTranslations('vendor');
    const latest = latestClaims(claims);
    return (
        <Section title={t('contract.installments')}>
            <div className="flex flex-col gap-2">
                {sc.installments.map(inst => {
                    const net = expectedNet(inst.amount, sc.terms, sc.lines);
                    const claim = latest.get(inst.no);
                    const isNext = sc.nextInstallment === inst.no;
                    return (
                        <div key={inst.no} className={`rounded-card border px-3 py-3 ${isNext ? 'border-orange-300 bg-orange-50/40' : 'border-gray-200'}`}>
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="text-body font-medium text-gray-900">{t('package.installmentLabel', { no: inst.no, pct: formatPct(inst.pct) })}</span>
                                <span className="text-body font-semibold">{formatBaht(inst.amount)}</span>
                            </div>
                            <div className="text-secondary text-gray-700">{inst.condition}</div>
                            <div className="mt-1 flex items-baseline justify-between gap-3 text-caption text-gray-600">
                                <span className={inst.state === 'paid' ? 'text-green-700' : ''}>{installmentStateText(inst.state, t)}</span>
                                {inst.state !== 'paid' && <span>{t('contract.expectedNet', { amount: formatBaht(net.net) })}</span>}
                            </div>
                            {claim !== undefined && <ClaimInfo claim={claim} />}
                            {claimable === inst.no && (
                                <Button className="!mt-3" type="primary" size="large" block onClick={onClaim}>
                                    {claim !== undefined && needsNewClaim(claim) ? t('contract.claimAgain', { no: inst.no }) : t('contract.claim', { no: inst.no })}
                                </Button>
                            )}
                        </div>
                    );
                })}
            </div>
            {sc.terms.retentionPct > 0 || sc.terms.whtPct > 0 || sc.terms.vat ? (
                <div className="mt-2 text-caption text-gray-500">
                    {t('contract.netBase')}
                    {sc.terms.retentionPct > 0 ? t('contract.netRetention', { pct: formatPct(sc.terms.retentionPct) }) : ''}
                    {sc.terms.whtPct > 0 ? t('contract.netWht', { pct: formatPct(sc.terms.whtPct) }) : ''}
                    {sc.terms.vat ? t('contract.netVat') : ''}
                    {t('contract.netNote')}
                </div>
            ) : null}
        </Section>
    );
}

function Payments({ claims }: { claims: readonly ClaimDto[] }) {
    const t = useTranslations('vendor');
    const paid = claims.filter(c => c.status === 'paid').sort((a, b) => a.installmentNo - b.installmentNo);
    if (paid.length === 0) return null;
    return (
        <Section title={t('contract.paymentsReceived')}>
            {paid.map(c => (
                <Fact key={c.id} label={`${t('bid.installmentN', { n: c.installmentNo })}${c.paidAt === null ? '' : ` · ${formatDay(c.paidAt)}`}`}>
                    {formatBaht(c.paidAmount ?? c.amounts.net)}
                    {c.paidRef !== null && c.paidRef !== '' && <div className="text-caption text-gray-500">{t('contract.reference', { ref: c.paidRef })}</div>}
                </Fact>
            ))}
        </Section>
    );
}

// ── Retention (what the crew cares about most) ──

function Retention({ sc }: { sc: SubcontractDto }) {
    const t = useTranslations('vendor');
    const entries = useRetentionEntries(sc.id);
    const r = sc.retention;
    if (r.withheld === 0 && r.balance === 0) return null;
    return (
        <Section title={t('contract.yourRetention')} tone={r.balance > 0 ? 'highlight' : 'default'}>
            <div className="text-caption text-gray-600">{t('contract.stillHeld')}</div>
            <div className="text-figure font-bold text-gray-900">{formatBaht(r.balance)}</div>
            <div className="mt-2">
                <Fact label={t('contract.totalWithheld')}>{formatBaht(r.withheld)}</Fact>
                {r.released > 0 && <Fact label={t('contract.returned')}>{formatBaht(r.released)}</Fact>}
                {r.forfeited > 0 && <Fact label={t('contract.forfeited')}>{formatBaht(r.forfeited)}</Fact>}
            </div>
            {r.schedule.length > 0 && (
                <div className="mt-3">
                    <div className="text-secondary font-medium text-gray-700 mb-1">{t('contract.returnSchedule')}</div>
                    {r.schedule.map(s => (
                        <Fact key={`${s.label}-${s.dueAt ?? ''}`} label={`${s.label}${s.dueAt === null ? '' : ` · ${formatDay(s.dueAt)}`}`}>{formatBaht(s.amount)}</Fact>
                    ))}
                </div>
            )}
            {entries.data !== undefined && entries.data.length > 0 && (
                <Collapse ghost className="!mt-2 -mx-4" items={[{
                    key: 'entries', label: t('contract.retentionHistory'),
                    children: entries.data.map(e => (
                        <Fact key={e.id} label={`${e.kind === 'withheld' ? t('contract.kindWithheld') : e.kind === 'released' ? t('contract.kindReleased') : t('contract.kindForfeited')} · ${formatDateTime(e.at)}`}>
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
    const t = useTranslations('vendor');
    const [sign, setSign] = useState<1 | -1>(1);
    const [lines, setLines] = useState<VarLine[]>([{ desc: '', unit: '', qty: '', unitPrice: '' }]);
    const [reason, setReason] = useState('');
    const set = (k: number, patch: Partial<VarLine>) => setLines(ls => ls.map((l, i) => (i === k ? { ...l, ...patch } : l)));
    const total = lines.reduce((s, l) => s + (parseAmount(l.qty) ?? 0) * (parseAmount(l.unitPrice) ?? 0), 0) * sign;
    const ok = reason.trim() !== '' && lines.every(l => l.desc.trim() !== '' && l.unit.trim() !== '' && parseAmount(l.qty) !== null && parseAmount(l.unitPrice) !== null);
    return (
        <div className="flex flex-col gap-3">
            <Segmented<1 | -1> block value={sign} onChange={v => setSign(v)} options={[{ value: 1, label: t('contract.addWork') }, { value: -1, label: t('contract.omitWork') }]} />
            {lines.map((l, k) => (
                <div key={k} className="flex flex-col gap-2 border-b border-gray-100 pb-3">
                    <Input value={l.desc} onChange={e => set(k, { desc: e.target.value })} maxLength={300} placeholder={t('contract.varItemPlaceholder')} />
                    <div className="grid grid-cols-3 gap-2">
                        <Input value={l.qty} onChange={e => set(k, { qty: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" placeholder={t('contract.qty')} />
                        <Input value={l.unit} onChange={e => set(k, { unit: e.target.value })} maxLength={20} placeholder={t('contract.unit')} />
                        <Input value={l.unitPrice} onChange={e => set(k, { unitPrice: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" placeholder={t('contract.pricePerUnit')} />
                    </div>
                </div>
            ))}
            <Button onClick={() => setLines(ls => [...ls, { desc: '', unit: '', qty: '', unitPrice: '' }])}>{t('contract.addItem')}</Button>
            <Input.TextArea value={reason} onChange={e => setReason(e.target.value)} autoSize={{ minRows: 2, maxRows: 5 }} maxLength={1000} placeholder={t('contract.varReasonPlaceholder')} />
            <div className="text-right text-body font-semibold">{total >= 0 ? t('contract.increase') : t('contract.decrease')} {formatBaht(Math.abs(total))}</div>
            <Button type="primary" size="large" block disabled={!ok} loading={busy} onClick={() => onSubmit(lines, sign, reason.trim())}>{t('contract.sendForReview')}</Button>
        </div>
    );
}

function Variations({ sc, list, readOnly }: { sc: SubcontractDto; list: readonly VariationDto[]; readOnly: boolean }) {
    const t = useTranslations('vendor');
    const qc = useQueryClient();
    const { message } = App.useApp();
    const onError = useOnError();
    const [open, setOpen] = useState(false);
    const refresh = () => qc.invalidateQueries({ queryKey: vk.all });
    const respond = useMutation({
        mutationFn: (v: { id: string; accept: boolean }) => vendorApi.contract.respondVariation(v.id, { accept: v.accept }),
        onSuccess: () => { void message.success(t('contract.replied')); void refresh(); },
        onError,
    });
    const propose = useMutation({
        mutationFn: (v: { lines: VarLine[]; sign: 1 | -1; reason: string }) => vendorApi.contract.proposeVariation(sc.id, {
            reason: v.reason,
            lines: v.lines.map(l => ({ desc: l.desc.trim(), unit: l.unit.trim(), qty: (parseAmount(l.qty) ?? 0) * v.sign, unitPrice: parseAmount(l.unitPrice) ?? 0 })),
        }),
        onSuccess: () => { setOpen(false); void message.success(t('contract.varSent')); void refresh(); },
        onError,
    });
    const canPropose = sc.status === 'active' && !readOnly;
    if (list.length === 0 && !canPropose) return null;
    return (
        <Section title={t('contract.variations')} extra={canPropose ? <Button onClick={() => setOpen(true)}>{t('contract.propose')}</Button> : undefined}>
            {list.length === 0 ? (
                <div className="text-secondary text-gray-500">{t('contract.noVariations')}</div>
            ) : list.map(v => (
                <div key={v.id} className="py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-baseline justify-between gap-3">
                        <span className="text-body text-gray-900">{v.reason}</span>
                        <span className="shrink-0 text-body font-semibold">{v.amount >= 0 ? '+' : '−'}{formatBaht(Math.abs(v.amount))}</span>
                    </div>
                    <div className="text-caption text-gray-600">
                        {v.proposedBy === 'vendor' ? t('contract.youProposed') : t('contract.clientProposed')} · {t(`contract.varStatus.${v.status}`)} · {formatDateTime(v.createdAt)}
                    </div>
                    {v.status === 'proposed' && v.proposedBy === 'buyer' && sc.status === 'active' && !readOnly && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <Button size="large" disabled={respond.isPending} onClick={() => respond.mutate({ id: v.id, accept: false })}>{t('contract.varStatus.rejected')}</Button>
                            <Button size="large" type="primary" loading={respond.isPending} onClick={() => respond.mutate({ id: v.id, accept: true })}>{t('contract.agree')}</Button>
                        </div>
                    )}
                </div>
            ))}
            <Sheet open={open} onClose={() => setOpen(false)} title={t('contract.proposeTitle')}>
                <VariationForm busy={propose.isPending} onSubmit={(lines, sign, reason) => propose.mutate({ lines, sign, reason })} />
            </Sheet>
        </Section>
    );
}

// ── Rating the buyer ──

function RateBuyer({ sc }: { sc: SubcontractDto }) {
    const t = useTranslations('vendor');
    const qc = useQueryClient();
    const { message } = App.useApp();
    const onError = useOnError();
    const [payment, setPayment] = useState(0);
    const [communication, setCommunication] = useState(0);
    const [comment, setComment] = useState('');
    const rate = useMutation({
        mutationFn: () => vendorApi.contract.rate(sc.id, { scores: { payment, communication }, comment: comment.trim() }),
        onSuccess: () => { void message.success(t('contract.thanksRating')); void qc.invalidateQueries({ queryKey: vk.contract(sc.id) }); },
        onError,
    });
    return (
        <Section title={t('contract.rate', { name: sc.buyerName })}>
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2"><span className="text-body">{t('contract.ratePayment')}</span><Rate value={payment} onChange={setPayment} /></div>
                <div className="flex items-center justify-between gap-2"><span className="text-body">{t('contract.rateCommunication')}</span><Rate value={communication} onChange={setCommunication} /></div>
                <Input.TextArea value={comment} onChange={e => setComment(e.target.value)} autoSize={{ minRows: 2, maxRows: 5 }} maxLength={1000} placeholder={t('contract.rateComment')} />
                <Button type="primary" size="large" block disabled={payment === 0 || communication === 0} loading={rate.isPending} onClick={() => rate.mutate()}>{t('contract.sendRating')}</Button>
            </div>
        </Section>
    );
}

// ── Page ──

function ContractBody({ sc }: { sc: SubcontractDto }) {
    const t = useTranslations('vendor');
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
        onSuccess: () => { setClaimOpen(false); void message.success(t('contract.claimSent')); void qc.invalidateQueries({ queryKey: vk.all }); },
        onError,
    });

    const readOnlyNote = readOnly ? <div className="px-1 text-secondary text-gray-500">{t('contract.readOnly')}</div> : null;

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
                <Alert type="info" showIcon title={sc.status === 'cancelled' ? t('contract.cancelled') : t('contract.terminated')}
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
                key: 'details', label: t('contract.details'),
                children: <ContractDetails sc={sc} showDocument />,
            }]} />
            <Sheet open={claimOpen} onClose={() => setClaimOpen(false)} title={claimable === null ? t('contract.claimTitle') : t('contract.claim', { no: claimable })}>
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
