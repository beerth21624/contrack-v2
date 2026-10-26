'use client';

// ─── /vendor/invitations/[id]: one job for a signed-in crew — the bid, the job details, messages ───
import { useState } from 'react';
import { App, Button, Collapse, Segmented } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BidDto, BidStatus, DeclineRequest, GuestPackageDto, MyBidStateDto } from '@/shared/contract';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { useSession } from '@/features/cloud/auth/session';
import { vendorApi, vk } from '../api';
import { formatBaht, formatDateTime, formatDay, formatMoney, formatPct, formatQty } from '../format';
import { useBidState, useInvitation } from '../hooks';
import { useNow } from '../now';
import { BidForm } from '../ui/BidForm';
import { BottomBar, ErrorState, Fact, PageSpinner, Section, SignInPrompt } from '../ui/common';
import { MessagesThread } from '../ui/MessagesThread';
import { AddendumBanner, AskQuestionSheet, DeadlineText, DeclineSheet, PackageDetails, closedReason } from '../ui/PackageView';

type View = 'bid' | 'job' | 'messages';

const BID_STATUS_TEXT: Record<BidStatus, string> = {
    draft: 'ร่าง',
    submitted: 'ส่งแล้ว รอผู้ว่าจ้างพิจารณา',
    superseded: 'มีฉบับใหม่กว่า',
    withdrawn: 'ถอนราคาแล้ว',
    selected: 'ได้รับเลือก',
    not_selected: 'ไม่ได้รับเลือก',
};

function latestSubmitted(list: readonly BidDto[]): BidDto | null {
    return list.reduce<BidDto | null>((best, b) => (best === null || b.version > best.version ? b : best), null);
}

function SubmittedBid({ pkg, bid, older }: { pkg: GuestPackageDto; bid: BidDto; older: BidDto[] }) {
    const byIdx = new Map(pkg.lines.map(l => [l.idx, l]));
    return (
        <Section title={`ราคาที่ส่ง ฉบับที่ ${String(bid.version)}`} tone={bid.status === 'selected' ? 'success' : 'default'}>
            <div className="text-figure font-bold text-gray-900">{formatBaht(bid.total)}</div>
            <div className="text-secondary text-gray-600">
                {BID_STATUS_TEXT[bid.status]}{bid.submittedAt === null ? '' : ` · ${formatDateTime(bid.submittedAt)}`}
            </div>
            {bid.outdated && (
                <div className="mt-2 text-secondary text-amber-600">ส่งก่อนผู้ว่าจ้างแก้ไขงาน ควรส่งราคาใหม่ให้ตรงกับงานล่าสุด</div>
            )}
            <div className="mt-3">
                {bid.days !== null && <Fact label="ทำงาน">{bid.days} วัน</Fact>}
                {bid.earliestStart !== null && <Fact label="เริ่มได้">{formatDay(bid.earliestStart)}</Fact>}
                {bid.validUntil !== null && <Fact label="ราคายืนถึง">{formatDay(bid.validUntil)}</Fact>}
                {bid.adjustment < 0 && <Fact label="ส่วนลดรวม">{formatBaht(-bid.adjustment)}</Fact>}
                {bid.installmentsProposal !== null && (
                    <Fact label="งวดที่เสนอ">{bid.installmentsProposal.map(i => formatPct(i.pct)).join(' / ')}</Fact>
                )}
            </div>
            {bid.mode === 'unit' ? (
                <Collapse ghost className="!mt-2 -mx-4" items={[{
                    key: 'lines', label: 'ดูราคารายรายการ',
                    children: bid.lines.map(l => {
                        const line = byIdx.get(l.idx);
                        return (
                            <div key={l.idx} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-gray-100 last:border-b-0">
                                <span className="text-secondary text-gray-800">
                                    {line?.desc ?? `รายการ ${String(l.idx + 1)}`}
                                    {!l.excluded && l.unitPrice !== null && line !== undefined && (
                                        <span className="text-gray-500"> · {formatMoney(l.unitPrice)}{l.matUnitPrice === null ? '' : ` + ${formatMoney(l.matUnitPrice)}`} × {formatQty(line.qtyPriced)}</span>
                                    )}
                                </span>
                                <span className="shrink-0 text-secondary font-medium">{l.excluded ? 'ไม่รวม' : formatMoney(l.total)}</span>
                            </div>
                        );
                    }),
                }]} />
            ) : bid.inclusions !== '' && <p className="mt-2 mb-0 text-secondary text-gray-700 whitespace-pre-line">{bid.inclusions}</p>}
            {older.length > 0 && (
                <div className="mt-3 text-caption text-gray-500">
                    ฉบับก่อนหน้า: {older.map(b => `ฉบับที่ ${String(b.version)} ${formatBaht(b.total)}`).join(' · ')}
                </div>
            )}
        </Section>
    );
}

function InvitationBody({ id, pkg, bids }: { id: string; pkg: GuestPackageDto; bids: MyBidStateDto }) {
    const qc = useQueryClient();
    const { message, modal } = App.useApp();
    const now = useNow();
    const closed = closedReason(pkg, now);
    const canEdit = closed === null;
    const latest = latestSubmitted(bids.submitted);
    const older = bids.submitted.filter(b => b !== latest).sort((a, b) => b.version - a.version);
    const [view, setView] = useState<View>(canEdit || latest !== null ? 'bid' : 'job');
    const [editing, setEditing] = useState(false);
    const [sheet, setSheet] = useState<'ask' | 'decline' | null>(null);

    const refresh = () => qc.invalidateQueries({ queryKey: vk.all });
    const ask = useMutation({
        mutationFn: (question: string) => vendorApi.invitation.ask(id, { question }),
        onSuccess: () => { setSheet(null); void message.success('ส่งคำถามแล้ว'); void refresh(); },
        onError: (e) => { void message.error(thaiErrorMessage(e)); },
    });
    const decline = useMutation({
        mutationFn: (body: DeclineRequest) => vendorApi.invitation.decline(id, body),
        onSuccess: () => { setSheet(null); void message.success('แจ้งผู้ว่าจ้างแล้ว'); void refresh(); },
        onError: (e) => { void message.error(thaiErrorMessage(e)); },
    });
    const withdraw = useMutation({
        mutationFn: () => vendorApi.invitation.withdraw(id),
        onSuccess: () => { void message.success('ถอนราคาแล้ว'); void refresh(); },
        onError: (e) => { void message.error(thaiErrorMessage(e)); },
    });

    const confirmWithdraw = () => {
        modal.confirm({
            title: 'ถอนราคานี้?',
            content: 'ผู้ว่าจ้างจะไม่เห็นราคานี้ในการพิจารณา ส่งราคาใหม่ได้จนถึงวันปิดรับ',
            okText: 'ถอนราคา', okButtonProps: { danger: true }, cancelText: 'ไม่ถอน',
            onOk: () => withdraw.mutateAsync(),
        });
    };

    const showForm = canEdit && (latest === null || editing);
    const formFrom = bids.draft ?? latest;

    return (
        <div className="flex flex-col gap-3">
            <Section>
                <div className="text-secondary text-gray-600">{pkg.buyerName}</div>
                <h1 className="m-0 text-card-title font-semibold text-gray-900">{pkg.title}</h1>
                <div className="mt-1 text-secondary text-gray-700">ปิดรับราคา <DeadlineText deadline={pkg.bidDeadline} /></div>
            </Section>

            {closed !== null && (
                <Section tone={closed.tone === 'success' ? 'success' : 'default'}>
                    <div className={`text-section font-medium ${closed.tone === 'success' ? 'text-green-700' : 'text-gray-700'}`}>{closed.title}</div>
                </Section>
            )}
            <AddendumBanner pkg={pkg} />

            <Segmented<View> block size="large" value={view} onChange={v => setView(v)}
                options={[{ value: 'bid', label: 'ใบเสนอราคา' }, { value: 'job', label: 'รายละเอียดงาน' }, { value: 'messages', label: 'ข้อความ' }]} />

            {view === 'job' && <PackageDetails pkg={pkg} showHeader={false} onAsk={canEdit ? () => setSheet('ask') : undefined} />}

            {view === 'messages' && <MessagesThread invitationId={id} buyerName={pkg.buyerName} />}

            {view === 'bid' && (showForm ? (
                <BidForm key={`${String(pkg.version)}-${latest?.id ?? 'none'}`} pkg={pkg} invitationId={id} from={formFrom}
                    onSubmitted={() => setEditing(false)} onCancel={latest === null ? undefined : () => setEditing(false)} />
            ) : latest !== null ? (
                <>
                    <SubmittedBid pkg={pkg} bid={latest} older={older} />
                    {canEdit && latest.status === 'submitted' && (
                        <Button type="text" danger size="large" block loading={withdraw.isPending} onClick={confirmWithdraw}>ถอนราคา</Button>
                    )}
                    {canEdit && (
                        <BottomBar>
                            <Button type="primary" size="large" block onClick={() => setEditing(true)}>
                                {bids.draft === null ? 'ส่งราคาใหม่' : 'ทำราคาฉบับใหม่ต่อ'}
                            </Button>
                        </BottomBar>
                    )}
                </>
            ) : (
                <Section><div className="text-secondary text-gray-600">คุณไม่ได้ส่งราคางานนี้</div></Section>
            ))}

            {canEdit && view !== 'messages' && (
                <div className="flex justify-center gap-2 py-1">
                    <Button type="text" onClick={() => setSheet('ask')}>ถามคำถาม</Button>
                    {latest === null && <Button type="text" onClick={() => setSheet('decline')}>ไม่รับงานนี้</Button>}
                </div>
            )}

            <AskQuestionSheet open={sheet === 'ask'} onClose={() => setSheet(null)} busy={ask.isPending} onSubmit={q => ask.mutate(q)} />
            <DeclineSheet open={sheet === 'decline'} onClose={() => setSheet(null)} busy={decline.isPending} onSubmit={b => decline.mutate(b)} />
        </div>
    );
}

export function InvitationPage({ id }: { id: string }) {
    const status = useSession(s => s.status);
    const inv = useInvitation(id);
    const bids = useBidState(id);
    if (status === 'unknown') return <PageSpinner />;
    if (status === 'guest') return <SignInPrompt next={`/vendor/invitations/${id}`} />;
    if (inv.isPending || bids.isPending) return <PageSpinner />;
    if (inv.isError) return <ErrorState error={inv.error} onRetry={() => { void inv.refetch(); }} />;
    if (bids.isError) return <ErrorState error={bids.error} onRetry={() => { void bids.refetch(); }} />;
    return <InvitationBody id={id} pkg={inv.data} bids={bids.data} />;
}
