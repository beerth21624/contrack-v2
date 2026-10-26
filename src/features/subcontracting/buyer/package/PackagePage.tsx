'use client';

// ─── /subcontracting/packages/[packageId]: one package while it waits for prices (plan §4.4) ───
// Header (status, deadline countdown, estimate), one primary action that follows the state, tabs for invitees,
// lines, terms, files and Q&A. Polls every 30 s (no realtime yet).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, App, Button, Dropdown, Result, Tabs, type MenuProps } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import type { BuyerPackageDto, ScInvitationDto } from '@/shared/contract';
import { tradeLabel } from '@/domain/subcontracting/trades';
import { isApiError, thaiErrorMessage } from '@/features/cloud/api/errors';
import { isModuleDisabled } from '../../contracts/logic';
import { spinner } from '@/features/cloud/ui/common';
import { scApi } from '../api';
import { ModuleOffState, useBuyerRights } from '../../contracts/ui';
import { useDeletePackage, useInvitations, usePackage, useQuestions } from '../hooks';
import { countdown, fmtDateTime, money0, SOURCING_MODE_LABEL } from '../format';
import { InvitationLinksModal, type LinkRow } from '../LinksModal';
import { PackageStatusTag, PageHead, ScPage } from '../ui';
import { AddendumModal } from './AddendumModal';
import { FilesTab } from './FilesTab';
import { bidCount, inviteRoom, isSentUndecided, needsMoreBids, primaryAction } from './helpers';
import { InviteesTab } from './InviteesTab';
import { InviteModal } from './InviteModal';
import { LinesTab } from './LinesTab';
import { ManualBidModal } from './ManualBidModal';
import { CancelPackageModal, EditDraftModal, ExtendDeadlineModal } from './PackageActions';
import { QaTab } from './QaTab';
import { TermsTab } from './TermsTab';

export function PackagePage({ packageId }: { packageId: string }) {
    return (
        <ScPage next={`/subcontracting/packages/${packageId}`}>
            <PackageContent packageId={packageId} />
        </ScPage>
    );
}

type Dialog = 'invite' | 'extend' | 'cancel' | 'edit' | 'addendum' | null;

/** "now" that moves every minute (for the countdown). */
function useMinuteClock(): Date {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const t = window.setInterval(() => setNow(new Date()), 60_000);
        return () => window.clearInterval(t);
    }, []);
    return now;
}

function PackageContent({ packageId }: { packageId: string }) {
    const pkg = usePackage(packageId);
    if (pkg.isLoading) return spinner;
    if (pkg.data === undefined) {
        if (isModuleDisabled(pkg.error)) return <ModuleOffState />;
        const notFound = isApiError(pkg.error) && pkg.error.status === 404;
        return (
            <Result status={notFound ? '404' : 'warning'} title={notFound ? 'ไม่พบแพ็กเกจนี้' : 'โหลดแพ็กเกจไม่สำเร็จ'}
                subTitle={notFound ? 'อาจถูกลบไปแล้ว หรือคุณไม่ได้เป็นสมาชิกของพื้นที่ทำงานนี้' : thaiErrorMessage(pkg.error)}
                extra={<Link href="/subcontracting"><Button>กลับไปหน้าจ้างช่วง</Button></Link>} />
        );
    }
    return <PackageView pkg={pkg.data} />;
}

function PackageView({ pkg }: { pkg: BuyerPackageDto }) {
    const { message, modal } = App.useApp();
    const router = useRouter();
    // Role, rights and settings of the workspace that owns the package (not the switcher's current workspace).
    const rights = useBuyerRights(pkg.buyerWorkspaceId);
    const buyerName = rights.workspaceName;
    const canManage = rights.may('sc.packages.manage');
    const canSeePrices = rights.may('sc.readPrices');
    const now = useMinuteClock();

    const invitationsQ = useInvitations(pkg.id);
    const questionsQ = useQuestions(pkg.id);
    const invitations = invitationsQ.data ?? [];
    const remove = useDeletePackage();

    const [dialog, setDialog] = useState<Dialog>(null);
    const [manualFor, setManualFor] = useState<ScInvitationDto | null>(null);
    const [links, setLinks] = useState<{ rows: LinkRow[]; title: string } | null>(null);
    const [resending, setResending] = useState(false);
    const [tab, setTab] = useState('invitees');

    const live = isSentUndecided(pkg.status);
    const action = primaryAction(pkg.status, invitations);
    const room = inviteRoom(pkg.sourcingMode, invitations);
    const unansweredCount = (questionsQ.data ?? []).filter(q => q.answer === null).length;
    const cd = countdown(pkg.bidDeadline, now);

    const resendUnopened = async (ids: readonly string[]) => {
        setResending(true);
        const rows: LinkRow[] = [];
        try {
            for (const id of ids) {
                const res = await scApi.resend(id);
                rows.push({ invitationId: id, displayName: res.invitation.displayName, phone: res.invitation.phone, url: res.link.url });
            }
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        } finally {
            setResending(false);
            void invitationsQ.refetch();
        }
        if (rows.length > 0) setLinks({ rows, title: 'ลิงก์ใหม่ของคนที่ยังไม่เปิด' });
    };

    const deleteDraft = () => {
        modal.confirm({
            title: 'ลบร่างแพ็กเกจนี้?',
            content: 'ยังไม่ได้ส่งให้ใคร ลบแล้วแถว BOQ กลับไปจัดหาใหม่ได้',
            okText: 'ลบร่าง', okButtonProps: { danger: true }, cancelText: 'ยกเลิก',
            onOk: async () => {
                try {
                    await remove.mutateAsync(pkg.id);
                    void message.success('ลบร่างแล้ว');
                    router.push('/subcontracting');
                } catch (e) {
                    void message.error(thaiErrorMessage(e));
                }
            },
        });
    };

    // ── actions ──
    let primary: React.ReactNode = null;
    if (action.kind === 'invite' && canManage) {
        primary = <Button type="primary" size="large" onClick={() => setDialog('invite')}>ส่งคำเชิญ</Button>;
    } else if (action.kind === 'leveling' && canSeePrices) {
        primary = (
            <Link href={`/subcontracting/packages/${pkg.id}/leveling`}>
                <Button type="primary" size="large">เปิดตารางเทียบ ({bidCount(invitations)} ราย)</Button>
            </Link>
        );
    } else if (action.kind === 'resend' && canManage) {
        primary = (
            <Button type="primary" size="large" loading={resending} onClick={() => { void resendUnopened(action.ids); }}>
                ส่งซ้ำให้คนที่ยังไม่เปิด ({action.ids.length})
            </Button>
        );
    } else if (action.kind === 'contracts') {
        primary = <Link href="/subcontracting/contracts"><Button type="primary" size="large">ดูสัญญา</Button></Link>;
    }

    const menu: NonNullable<MenuProps['items']> = [];
    if (canManage && pkg.status === 'draft') menu.push({ key: 'edit', label: 'แก้ไขร่าง' });
    if (canManage && live) menu.push({ key: 'extend', label: 'ขยายวันปิดรับ' });
    if (canManage && live && room > 0) menu.push({ key: 'invite', label: 'เชิญเพิ่ม' });
    if (canSeePrices && live && action.kind !== 'leveling') menu.push({ key: 'leveling', label: 'ตารางเทียบราคา' });
    if (canManage && (pkg.status === 'draft' || live)) menu.push({ type: 'divider' });
    if (canManage && live) menu.push({ key: 'cancel', label: 'ยกเลิกแพ็กเกจ', danger: true });
    if (canManage && pkg.status === 'draft') menu.push({ key: 'delete', label: 'ลบร่าง', danger: true });
    const onMenu: MenuProps['onClick'] = ({ key }) => {
        if (key === 'leveling') router.push(`/subcontracting/packages/${pkg.id}/leveling`);
        else if (key === 'delete') deleteDraft();
        else if (key === 'edit' || key === 'extend' || key === 'invite' || key === 'cancel') setDialog(key);
    };
    const hasMenu = menu.some(m => m !== null && m.type !== 'divider');

    // ── header line ──
    const sub = (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <PackageStatusTag status={pkg.status} />
            <span>{tradeLabel(pkg.trade)}</span>
            <span className="text-gray-500">{SOURCING_MODE_LABEL[pkg.sourcingMode]}</span>
            {pkg.version > 1 && <span className="text-gray-500">ฉบับที่ {pkg.version}</span>}
            {pkg.status === 'draft' && <span className="text-gray-500">ปิดรับ {fmtDateTime(pkg.bidDeadline)}</span>}
            {live && (
                <span className={cd.passed ? 'text-red-600' : cd.soon ? 'text-amber-600' : 'text-gray-600'} title={fmtDateTime(pkg.bidDeadline)}>
                    {cd.passed ? `ปิดรับแล้ว ${fmtDateTime(pkg.bidDeadline)}` : `ปิดรับ${cd.text}`}
                </span>
            )}
            {canSeePrices && <span className="tabular-nums text-gray-600">ประเมิน {money0(pkg.estimateTotal)} บาท</span>}
        </span>
    );

    return (
        <>
            <PageHead back={{ href: '/subcontracting', label: 'จ้างช่วง' }} title={pkg.title} sub={sub}
                extra={(
                    <>
                        {hasMenu && (
                            <Dropdown trigger={['click']} menu={{ items: menu, onClick: onMenu }}>
                                <Button size="large">จัดการ <DownOutlined /></Button>
                            </Dropdown>
                        )}
                        {primary}
                    </>
                )} />

            {pkg.status === 'cancelled' && (
                <Alert type="info" showIcon title="แพ็กเกจนี้ถูกยกเลิกแล้ว"
                    description={pkg.cancelReason !== null && pkg.cancelReason !== '' ? `เหตุผล: ${pkg.cancelReason}` : undefined} />
            )}
            {needsMoreBids(pkg, invitations, now) && canManage && (
                <Alert type="warning" showIcon title={`ปิดรับแล้ว ได้ราคา ${String(bidCount(invitations))} ราย`}
                    description="ขยายเวลา เชิญเพิ่ม หรือไปต่อด้วยราคาที่มี"
                    action={(
                        <div className="flex flex-wrap gap-2">
                            <Button size="small" onClick={() => setDialog('extend')}>ขยายเวลา</Button>
                            {room > 0 && <Button size="small" onClick={() => setDialog('invite')}>เชิญเพิ่ม</Button>}
                            {bidCount(invitations) > 0 && canSeePrices && (
                                <Link href={`/subcontracting/packages/${pkg.id}/leveling`}><Button size="small">ไปต่อด้วยราคาที่มี</Button></Link>
                            )}
                        </div>
                    )} />
            )}

            <div className="bg-white border border-gray-200 rounded-card px-5 pb-5 max-md:px-4 shadow-card">
                <Tabs activeKey={tab} onChange={setTab} items={[
                    {
                        key: 'invitees', label: `ผู้รับคำเชิญ${invitations.length > 0 ? ` (${String(invitations.length)})` : ''}`,
                        children: (
                            <InviteesTab pkg={pkg} invitations={invitations} loading={invitationsQ.isLoading}
                                error={invitationsQ.isError ? thaiErrorMessage(invitationsQ.error) : null}
                                canManage={canManage} canSeePrices={canSeePrices}
                                onLinks={(rows, title) => setLinks({ rows, title })} onManualBid={setManualFor}
                                onInviteMore={room > 0 ? () => setDialog('invite') : null} />
                        ),
                    },
                    {
                        key: 'lines', label: `รายการงาน (${String(pkg.lines.length)})`,
                        children: <LinesTab pkg={pkg} canSeePrices={canSeePrices} canManage={canManage} onAddendum={() => setDialog('addendum')} />,
                    },
                    { key: 'terms', label: 'เงื่อนไข', children: <TermsTab pkg={pkg} /> },
                    { key: 'files', label: `ไฟล์${pkg.files.length > 0 ? ` (${String(pkg.files.length)})` : ''}`, children: <FilesTab pkg={pkg} canManage={canManage} /> },
                    {
                        key: 'qa', label: `คำถาม-คำตอบ${unansweredCount > 0 ? ` (รอตอบ ${String(unansweredCount)})` : ''}`,
                        children: (
                            <QaTab packageId={pkg.id} questions={questionsQ.data ?? []} loading={questionsQ.isLoading}
                                error={questionsQ.isError ? thaiErrorMessage(questionsQ.error) : null}
                                canAnswer={canManage && pkg.status !== 'cancelled'} />
                        ),
                    },
                ]} />
            </div>

            {/* Mounted only while open, so each opening starts from the package as it is now. */}
            {dialog === 'invite' && (
                <InviteModal open onClose={() => setDialog(null)} pkg={pkg}
                    invitations={invitations} onSent={rows => setLinks({ rows, title: 'ส่งคำเชิญแล้ว' })} />
            )}
            {dialog === 'extend' && <ExtendDeadlineModal open onClose={() => setDialog(null)} pkg={pkg} />}
            {dialog === 'cancel' && <CancelPackageModal open onClose={() => setDialog(null)} pkg={pkg} />}
            {dialog === 'edit' && <EditDraftModal open onClose={() => setDialog(null)} pkg={pkg} />}
            <AddendumModal open={dialog === 'addendum'} onClose={() => setDialog(null)} pkg={pkg} />
            <ManualBidModal pkg={pkg} invitation={manualFor} onClose={() => setManualFor(null)} />
            <InvitationLinksModal open={links !== null} onClose={() => setLinks(null)} rows={links?.rows ?? []}
                title={links?.title} buyerName={buyerName} packageTitle={pkg.title} deadline={pkg.bidDeadline} />
        </>
    );
}
