'use client';

// ─── The bid form (unit prices per line or one lump sum, then time, crew, installments, answers, photos) ───
// Autosaves the draft 1.5 s after the last change; submit goes through a confirmation sheet showing the total.
import { useEffect, useReducer, useState } from 'react';
import { Alert, App, Button, Checkbox, Input, Radio, Segmented } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BidDto, BidMode, GuestPackageDto, MyBidStateDto, PackageLineDto, SaveBidDraftRequest } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { vendorApi, vk } from '../api';
import {
    MAX_BID_PHOTOS, bidFormReducer, bidTotal, checkBid, initBidForm, installmentsPctSum, lineTotal, pairLines,
    toDraftRequest, toSubmitRequest, type BidFormAction, type LineDraft,
} from '../bid-form';
import { formatBaht, formatMoney, formatPct, formatQty } from '../format';
import { BottomBar, Fact, Section, Sheet } from './common';
import { groupLines } from './PackageView';
import { PhotoPicker } from './PhotoPicker';

const AUTOSAVE_MS = 1500;

/** Keeps only what a money / count field can hold while typing. */
const amountChars = (v: string) => v.replace(/[^\d.,]/g, '');

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
    return (
        <span className="flex flex-col">
            <span className="text-secondary font-medium text-gray-700">{children}</span>
            {hint !== undefined && <span className="text-caption text-gray-500">{hint}</span>}
        </span>
    );
}

function MoneyInput({ value, onChange, suffix, placeholder, invalid, ariaLabel }: {
    value: string; onChange: (v: string) => void; suffix?: string; placeholder?: string; invalid?: boolean; ariaLabel: string;
}) {
    return (
        <Input value={value} onChange={e => onChange(amountChars(e.target.value))} inputMode="decimal" placeholder={placeholder ?? '0'}
            suffix={suffix === undefined ? undefined : <span className="text-caption text-gray-500">{suffix}</span>}
            status={invalid === true ? 'error' : undefined} aria-label={ariaLabel} styles={{ input: { textAlign: 'right' } }} />
    );
}

function LineEditor({ line, d, dispatch, flagged }: {
    line: PackageLineDto; d: LineDraft; dispatch: React.Dispatch<BidFormAction>; flagged: boolean;
}) {
    const t = useTranslations('vendor');
    const vendorMat = line.materialBy === 'vendor';
    const set = (patch: Partial<Omit<LineDraft, 'idx'>>) => dispatch({ type: 'line', idx: line.idx, patch });
    return (
        <div id={`line-${String(line.idx)}`} className={`py-3 border-b border-gray-100 last:border-b-0 ${flagged ? 'bg-red-50 -mx-2 px-2 rounded-control' : ''}`}>
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-body text-gray-900">{line.desc}</span>
                <span className="shrink-0 whitespace-nowrap text-body font-medium">{formatQty(line.qtyPriced)} <span className="font-normal text-gray-600">{line.unit}</span></span>
            </div>
            {d.excluded ? (
                <Input className="!mt-2" value={d.reason} onChange={e => set({ reason: e.target.value })} maxLength={300}
                    placeholder={t('bid.excludeReason')} status={flagged && d.reason.trim() === '' ? 'error' : undefined} />
            ) : (
                <div className={`mt-2 grid gap-2 ${vendorMat ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <MoneyInput value={d.unitPrice} onChange={v => set({ unitPrice: v })} suffix={t('bid.perUnit', { unit: line.unit })}
                        ariaLabel={vendorMat ? t('bid.labourPer', { unit: line.unit }) : t('bid.pricePer', { unit: line.unit })}
                        placeholder={vendorMat ? t('bid.labour') : t('bid.unitPrice')} invalid={flagged && d.unitPrice === ''} />
                    {vendorMat && (
                        <MoneyInput value={d.matUnitPrice} onChange={v => set({ matUnitPrice: v })} suffix={t('bid.perUnit', { unit: line.unit })}
                            ariaLabel={t('bid.materialPer', { unit: line.unit })} placeholder={t('bid.material')} />
                    )}
                </div>
            )}
            {vendorMat && !d.excluded && line.qtyMaterial !== line.qtyPriced && (
                <div className="mt-1 text-caption text-gray-500">{t('bid.materialQty', { qty: formatQty(line.qtyMaterial), unit: line.unit })}</div>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
                <Checkbox checked={d.excluded} onChange={e => set({ excluded: e.target.checked })}>{t('bid.excludeItem')}</Checkbox>
                {!d.excluded && <span className="text-secondary text-gray-700">{t('bid.lineTotal')} <span className="font-medium text-gray-900">{formatMoney(lineTotal(line, d))}</span></span>}
            </div>
        </div>
    );
}

function SaveStatus({ state }: { state: 'idle' | 'pending' | 'success' | 'error' }) {
    const t = useTranslations('vendor');
    if (state === 'idle') return null;
    const text = state === 'pending' ? t('bid.saving') : state === 'success' ? t('bid.saved') : t('bid.saveFailed');
    return <span className={`text-caption ${state === 'error' ? 'text-amber-600' : 'text-gray-500'}`}>{text}</span>;
}

export function BidForm({ pkg, invitationId, from, onSubmitted, onCancel }: {
    pkg: GuestPackageDto;
    invitationId: string;
    /** Saved draft, else the latest submitted version (a new version starts from it), else null. */
    from: BidDto | null;
    onSubmitted: () => void;
    /** Leave the form (only when a submitted version exists). */
    onCancel?: () => void;
}) {
    const t = useTranslations('vendor');
    const toText = useErrorMessage();
    const qc = useQueryClient();
    const { message } = App.useApp();
    const [state, dispatch] = useReducer(bidFormReducer, null, () => initBidForm(pkg, from));
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [showIssues, setShowIssues] = useState(false);

    const save = useMutation({
        mutationFn: (body: SaveBidDraftRequest) => vendorApi.invitation.saveDraft(invitationId, body),
        onSuccess: (draft) => {
            // Keep the cache in step, so the form reopens with the latest draft (e.g. after an addendum).
            qc.setQueryData<MyBidStateDto>(vk.bid(invitationId), old => (old === undefined ? old : { ...old, draft }));
        },
    });
    const saveDraft = save.mutate;
    useEffect(() => {
        if (state.rev === 0) return undefined;
        const timer = setTimeout(() => { saveDraft(toDraftRequest(pkg, state)); }, AUTOSAVE_MS);
        return () => { clearTimeout(timer); };
    }, [state, pkg, saveDraft]);

    const submit = useMutation({
        mutationFn: () => vendorApi.invitation.submit(invitationId, toSubmitRequest(pkg, state)),
        onSuccess: async () => {
            setConfirmOpen(false);
            void message.success(t('bid.sent'));
            await qc.invalidateQueries({ queryKey: vk.all });
            onSubmitted();
        },
        onError: (e) => { void message.error(toText(e)); },
    });

    const total = bidTotal(pkg, state);
    const check = checkBid(pkg, state, t);
    const flagged = new Set(showIssues ? check.lineIdx : []);
    const pairs = new Map(pairLines(pkg, state).map(p => [p.line.idx, p.d]));
    const field = (f: Extract<BidFormAction, { type: 'field' }>['field']) => (v: string) => dispatch({ type: 'field', field: f, value: v });
    const pctSum = installmentsPctSum(state);

    const fixIssues = () => {
        setConfirmOpen(false);
        setShowIssues(true);
        const first = check.lineIdx[0];
        if (first !== undefined) document.getElementById(`line-${String(first)}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    return (
        <div className="flex flex-col gap-3">
            {pkg.pricingMode === 'vendor_choice' && (
                <Segmented<BidMode> block size="large" value={state.mode} onChange={v => dispatch({ type: 'mode', mode: v })}
                    options={[{ value: 'unit', label: t('bid.modeUnit') }, { value: 'lump', label: t('bid.modeLump') }]} />
            )}

            {state.mode === 'unit' ? (
                <>
                    {groupLines(pkg.lines, t).map(g => (
                        <Section key={g.title} title={t('package.section', { title: g.title })}>
                            {g.lines.map(line => {
                                const d = pairs.get(line.idx);
                                return d === undefined ? null : <LineEditor key={line.idx} line={line} d={d} dispatch={dispatch} flagged={flagged.has(line.idx)} />;
                            })}
                        </Section>
                    ))}
                    <Section>
                        <label className="flex flex-col gap-1">
                            <Label hint={t('bid.discountHint')}>{t('bid.discountLabel')}</Label>
                            <MoneyInput value={state.discount} onChange={field('discount')} ariaLabel={t('bid.discountAria')} placeholder={t('bid.none')} />
                        </label>
                    </Section>
                </>
            ) : (
                <Section title={t('bid.lumpPrice')}>
                    <div className="flex flex-col gap-3">
                        <MoneyInput value={state.lumpTotal} onChange={field('lumpTotal')} suffix={t('units.baht')} ariaLabel={t('bid.lumpPrice')}
                            invalid={showIssues && (state.lumpTotal === '')} />
                        <label className="flex flex-col gap-1">
                            <Label>{t('bid.inclusions')}</Label>
                            <Input.TextArea value={state.inclusions} onChange={e => field('inclusions')(e.target.value)} maxLength={2000}
                                autoSize={{ minRows: 3, maxRows: 8 }} placeholder={t('bid.inclusionsPlaceholder')} />
                        </label>
                    </div>
                </Section>
            )}

            <Section title={t('bid.timeAndCrew')}>
                <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1">
                        <Label>{t('bid.days')}</Label>
                        <Input value={state.days} onChange={e => field('days')(e.target.value.replace(/\D/g, ''))} inputMode="numeric" suffix={t('units.days')} />
                    </label>
                    <label className="flex flex-col gap-1">
                        <Label>{t('bid.earliestStart')}</Label>
                        <Input type="date" value={state.earliestStart} onChange={e => field('earliestStart')(e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                        <Label>{t('bid.skilled')}</Label>
                        <Input value={state.crewSkilled} onChange={e => field('crewSkilled')(e.target.value.replace(/\D/g, ''))} inputMode="numeric" suffix={t('units.people')} />
                    </label>
                    <label className="flex flex-col gap-1">
                        <Label>{t('bid.labourers')}</Label>
                        <Input value={state.crewLabourers} onChange={e => field('crewLabourers')(e.target.value.replace(/\D/g, ''))} inputMode="numeric" suffix={t('units.people')} />
                    </label>
                    <label className="flex flex-col gap-1 col-span-2">
                        <Label>{t('bid.validUntil')}</Label>
                        <Input type="date" value={state.validUntil} onChange={e => field('validUntil')(e.target.value)} />
                    </label>
                </div>
            </Section>

            <Section title={t('bid.installments')}>
                <Radio.Group value={state.installmentsMode} onChange={e => dispatch({ type: 'installmentsMode', mode: e.target.value as 'accept' | 'propose' })}
                    className="!flex !flex-col gap-2">
                    <Radio value="accept">{t('bid.acceptInstallments')}</Radio>
                    <Radio value="propose">{t('bid.proposeInstallments')}</Radio>
                </Radio.Group>
                {state.installmentsMode === 'accept' ? (
                    <div className="mt-3">
                        {pkg.installments.map(i => <Fact key={i.no} label={t('package.installmentLabel', { no: i.no, pct: formatPct(i.pct) })}>{i.condition}</Fact>)}
                    </div>
                ) : (
                    <div className="mt-3 flex flex-col gap-3">
                        {state.installments.map((inst, k) => (
                            <div key={k} className="flex gap-2 items-start">
                                <span className="pt-2.5 text-secondary text-gray-600 w-12 shrink-0">{t('bid.installmentN', { n: k + 1 })}</span>
                                <div className="flex-1 min-w-0 flex flex-col gap-2">
                                    <Input value={inst.pct} onChange={e => dispatch({ type: 'installment', index: k, patch: { pct: amountChars(e.target.value) } })}
                                        inputMode="decimal" suffix="%" aria-label={t('bid.installmentPct', { n: k + 1 })} />
                                    <Input value={inst.condition} onChange={e => dispatch({ type: 'installment', index: k, patch: { condition: e.target.value } })}
                                        maxLength={300} placeholder={t('bid.conditionPlaceholder')} />
                                </div>
                                <Button type="text" aria-label={t('bid.removeInstallment')} icon={<DeleteOutlined />} disabled={state.installments.length <= 1}
                                    onClick={() => dispatch({ type: 'removeInstallment', index: k })} />
                            </div>
                        ))}
                        <div className="flex items-center justify-between">
                            <Button icon={<PlusOutlined />} onClick={() => dispatch({ type: 'addInstallment' })}>{t('bid.addInstallment')}</Button>
                            <span className={`text-secondary font-medium ${Math.abs(pctSum - 100) <= 0.01 ? 'text-green-700' : 'text-gray-600'}`}>{t('bid.pctTotal', { sum: String(pctSum) })}</span>
                        </div>
                    </div>
                )}
            </Section>

            {pkg.terms.questions.length > 0 && (
                <Section title={t('bid.clientQuestions')}>
                    <div className="flex flex-col gap-3">
                        {pkg.terms.questions.map((q, k) => (
                            <label key={k} className="flex flex-col gap-1">
                                <Label>{q}</Label>
                                <Input.TextArea value={state.answers[k] ?? ''} onChange={e => dispatch({ type: 'answer', index: k, value: e.target.value })}
                                    maxLength={1000} autoSize={{ minRows: 1, maxRows: 5 }} />
                            </label>
                        ))}
                    </div>
                </Section>
            )}

            <Section title={t('bid.noteAndPhotos')}>
                <div className="flex flex-col gap-3">
                    <Input.TextArea value={state.note} onChange={e => field('note')(e.target.value)} maxLength={2000}
                        autoSize={{ minRows: 2, maxRows: 6 }} placeholder={t('bid.notePlaceholder')} />
                    <PhotoPicker photos={state.photos} max={MAX_BID_PHOTOS} purpose="bid_photo" label={t('bid.addPhotos')}
                        onAdd={file => dispatch({ type: 'addPhoto', file })} onRemove={id => dispatch({ type: 'removePhoto', id })} />
                </div>
            </Section>

            {onCancel !== undefined && <Button type="text" size="large" block onClick={onCancel}>{t('bid.backToSent')}</Button>}

            <BottomBar>
                <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="text-caption text-gray-600">{t('bid.total')}</div>
                        <div className="text-card-title font-semibold text-gray-900 truncate">{formatBaht(total)}</div>
                        <SaveStatus state={save.status} />
                    </div>
                    <Button type="primary" size="large" onClick={() => setConfirmOpen(true)}>{t('bid.submit')}</Button>
                </div>
            </BottomBar>

            <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('bid.reviewTitle')}>
                <div className="flex flex-col gap-3">
                    <div className="text-center py-2">
                        <div className="text-secondary text-gray-600">{t('bid.amountTo', { name: pkg.buyerName })}</div>
                        <div className="text-figure font-bold text-gray-900">{formatBaht(total)}</div>
                        {state.days !== '' && <div className="text-secondary text-gray-600">{t('bid.workDays', { n: state.days })}</div>}
                    </div>
                    {check.errors.length > 0 && (
                        <Alert type="error" showIcon title={t('bid.cannotSend')} description={<ul className="m-0 pl-4">{check.errors.map(e => <li key={e}>{e}</li>)}</ul>} />
                    )}
                    {check.warnings.length > 0 && (
                        <Alert type="warning" showIcon title={t('bid.checkAgain')} description={<ul className="m-0 pl-4">{check.warnings.map(e => <li key={e}>{e}</li>)}</ul>} />
                    )}
                    {check.errors.length > 0 ? (
                        <Button type="primary" size="large" block onClick={fixIssues}>{t('bid.goFix')}</Button>
                    ) : (
                        <>
                            <Button type="primary" size="large" block loading={submit.isPending} onClick={() => submit.mutate()}>{t('bid.confirmSend')}</Button>
                            {check.warnings.length > 0 && <Button type="text" block onClick={fixIssues}>{t('bid.goFix')}</Button>}
                        </>
                    )}
                    <div className="text-caption text-gray-500 text-center">{t('bid.afterSendNote')}</div>
                </div>
            </Sheet>
        </div>
    );
}
