'use client';

// ─── /subcontracting/packages/new: create a work package in 3 steps (plan §4.3) ───
// 1 เลือกงาน · 2 รูปแบบและเงื่อนไข · 3 เวลา งวด และผู้รับ. Submit = create (draft) → attach files → invitations →
// the one-time links to pass on by hand.
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { App, Button, Steps } from 'antd';
import {
    createPackageRequestSchema, tradeIdSchema, type CreatePackageRequest, type FileDto, type ProjectDto, type SubcontractingSettingsDto,
    type TradeId,
} from '@/shared/contract';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { useCurrentWorkspace } from '@/features/cloud/query/hooks';
import { spinner } from '@/features/cloud/ui/common';
import { useProjectStore } from '@/store/project-store';
import { useBuyerRights } from '../../contracts/ui';
import { scApi, scKeys } from '../api';
import { LIVE_PACKAGE_STATUSES, money0 } from '../format';
import {
    useBuyerContext, useCreatePackage, useLiveProjectResult, usePackageDetails, usePackages, useScSettings,
} from '../hooks';
import { InvitationLinksModal, type LinkRow } from '../LinksModal';
import { provinceInAddress } from '../provinces';
import { Card, NoProjectState, PageHead, ScPage } from '../ui';
import {
    buildRequest, customLinesComplete, effectiveKeys, estimateTotal, filledCustomLines, heldLines, initialDraft, issueText,
    sendProblems, titleOf, wizardRows, type Draft,
} from './state';
import { StepLines } from './StepLines';
import { StepTerms } from './StepTerms';
import { StepSend } from './StepSend';
import { PreviewModal } from './PreviewModal';

const NEXT = '/subcontracting/packages/new';

export function PackageWizardPage() {
    return (
        <ScPage next={NEXT}>
            <WizardGate />
        </ScPage>
    );
}

function WizardGate() {
    const { project } = useBuyerContext();
    // The package will belong to the project's workspace: role and settings come from it, not from the switcher.
    const workspaceId = project?.workspaceId;
    const rights = useBuyerRights(workspaceId);
    const settings = useScSettings(workspaceId);
    const params = useSearchParams();
    if (project === null) {
        return (
            <>
                <PageHead title="สร้างแพ็กเกจ" back={{ href: '/subcontracting', label: 'จ้างช่วง' }} />
                <NoProjectState />
            </>
        );
    }
    if (rights.loading) return spinner;
    if (!rights.may('sc.packages.manage')) {
        return (
            <>
                <PageHead title="สร้างแพ็กเกจ" back={{ href: '/subcontracting', label: 'จ้างช่วง' }} />
                <Card><p className="text-gray-600 m-0">บทบาทของคุณดูแพ็กเกจได้อย่างเดียว ให้ผู้ดูแลหรือผู้ประมาณราคาเป็นผู้สร้าง</p></Card>
            </>
        );
    }
    // Defaults come from the workspace settings: wait for them once (an error falls back to the built-in defaults).
    if (settings.isLoading) return spinner;
    const trade = tradeIdSchema.safeParse(params.get('trade'));
    const sectionRaw = params.get('section');
    const section = sectionRaw === null || !/^\d+$/.test(sectionRaw) ? null : Number(sectionRaw);
    return (
        <Wizard key={project.id} project={project} workspaceId={project.workspaceId} workspaceName={rights.workspaceName}
            settings={settings.data} initialTrade={trade.success ? trade.data : 'structure'} initialSection={section} />
    );
}

function Wizard({ project, workspaceId, workspaceName, settings, initialTrade, initialSection }: {
    project: ProjectDto;
    workspaceId: string;
    workspaceName: string;
    settings: SubcontractingSettingsDto | undefined;
    initialTrade: TradeId;
    initialSection: number | null;
}) {
    const { message } = App.useApp();
    const router = useRouter();
    const qc = useQueryClient();
    const result = useLiveProjectResult();
    const meta = useProjectStore(s => s.project.meta);
    const { workspaces } = useCurrentWorkspace();
    const [draft, setDraft] = useState<Draft>(() => initialDraft({
        trade: initialTrade, section: initialSection, boq: result.boq, settings,
        province: provinceInAddress(meta.siteAddress), address: meta.siteAddress, now: new Date(),
    }));
    const update = (patch: Partial<Draft>) => setDraft(d => ({ ...d, ...patch }));
    const addFile = (file: FileDto) => setDraft(d => ({ ...d, files: [...d.files, file] }));
    const [step, setStep] = useState(0);
    const [preview, setPreview] = useState(false);
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState<{ packageId: string; buyerName: string; title: string; deadline: string; rows: LinkRow[] } | null>(null);

    // Rows held by other live packages of this project (only summaries are listed: details are fetched lazily).
    const packages = usePackages(project.id);
    const liveIds = useMemo(
        () => (packages.data ?? []).filter(p => LIVE_PACKAGE_STATUSES.includes(p.status)).map(p => p.id),
        [packages.data],
    );
    const details = usePackageDetails(liveIds);
    const held = heldLines(details.map(d => d.data).filter((d): d is NonNullable<typeof d> => d !== undefined));

    const rows = useMemo(() => wizardRows(result.boq, draft.shownTrades), [result.boq, draft.shownTrades]);
    const keys = effectiveKeys(draft, rows, held);
    const estimate = estimateTotal(result.boq, draft, keys);
    const tasks = result.planning.schedule.tasks;
    const request: CreatePackageRequest = buildRequest(draft, { lineKeys: keys, tasks });
    const lineCount = keys.length + filledCustomLines(draft.customLines).length;
    const step1Ok = lineCount > 0 && customLinesComplete(draft.customLines);
    const step2Ok = titleOf(draft).trim() !== '';
    const create = useCreatePackage(project.id);

    const goPackage = (id: string) => router.push(`/subcontracting/packages/${id}`);

    const submit = async (send: boolean) => {
        const now = new Date();
        const problems = sendProblems(request, draft, now, !send);
        if (problems.length > 0) {
            void message.warning(problems[0]);
            return;
        }
        const parsed = createPackageRequestSchema.safeParse(request);
        if (!parsed.success) {
            void message.warning(issueText(parsed.error.issues[0]));
            return;
        }
        setBusy(true);
        let packageId: string;
        let buyerName: string;
        try {
            const created = await create.mutateAsync(parsed.data);
            packageId = created.id;
            // After create, the package says which workspace owns it (the name crews see on the links).
            buyerName = workspaces.find(w => w.id === created.buyerWorkspaceId)?.name ?? workspaceName;
        } catch (e) {
            setBusy(false);
            void message.error(thaiErrorMessage(e));
            return;
        }
        let filesFailed = 0;
        for (const f of draft.files) {
            try {
                const pkg = await scApi.attachFile(packageId, f.id);
                qc.setQueryData(scKeys.package(pkg.id), pkg);
            } catch {
                filesFailed += 1;
            }
        }
        if (filesFailed > 0) void message.warning(`แนบไฟล์ไม่สำเร็จ ${String(filesFailed)} ไฟล์ แนบใหม่ได้ที่หน้าแพ็กเกจ`);
        if (!send) {
            void message.success('บันทึกร่างแล้ว');
            goPackage(packageId);
            return;
        }
        try {
            const res = await scApi.invite(packageId, { entries: draft.invitees.map(i => ({ vendorListEntryId: i.entryId, channel: i.channel })) });
            void qc.invalidateQueries({ queryKey: scKeys.package(packageId) });
            void qc.invalidateQueries({ queryKey: scKeys.packages(project.id) });
            void qc.invalidateQueries({ queryKey: scKeys.overview(project.id) });
            const byId = new Map(res.invitations.map(i => [i.id, i]));
            setSent({
                packageId,
                buyerName,
                title: parsed.data.title,
                deadline: parsed.data.bidDeadline,
                rows: res.links.map(l => {
                    const inv = byId.get(l.invitationId);
                    return { invitationId: l.invitationId, displayName: inv?.displayName ?? '', phone: inv?.phone ?? '', url: l.url };
                }),
            });
        } catch (e) {
            void message.warning(`บันทึกเป็นร่างแล้ว แต่ส่งคำเชิญไม่สำเร็จ (${thaiErrorMessage(e)}) ส่งใหม่ได้ที่หน้าแพ็กเกจ`);
            goPackage(packageId);
        } finally {
            setBusy(false);
        }
    };

    const stepItems = [{ title: 'เลือกงาน' }, { title: 'รูปแบบและเงื่อนไข' }, { title: 'เวลา งวด และผู้รับ' }];
    const canOpen = (i: number) => i <= step || (i === 1 && step1Ok) || (i === 2 && step1Ok && step2Ok);
    const n = draft.invitees.length;

    return (
        <>
            <PageHead title="สร้างแพ็กเกจ" sub={project.name} back={{ href: '/subcontracting', label: 'จ้างช่วง' }} />
            <Card>
                <Steps current={step} size="small" items={stepItems.map((s, i) => ({ ...s, disabled: !canOpen(i) }))}
                    onChange={i => { if (canOpen(i)) setStep(i); }} />
            </Card>

            {step === 0 && <StepLines draft={draft} update={update} boq={result.boq} rows={rows} held={held} />}
            {step === 1 && <StepTerms draft={draft} update={update} addFile={addFile} keys={keys} rows={rows} projectName={project.name} />}
            {step === 2 && (
                <StepSend draft={draft} update={update} tasks={tasks} workspaceId={workspaceId}
                    province={draft.location.province} onPreview={() => setPreview(true)} />
            )}

            <div className="bg-white border border-gray-200 rounded-card px-5 py-3 shadow-card flex flex-wrap items-center gap-3 sticky bottom-3 z-10">
                {step > 0 && <Button onClick={() => setStep(step - 1)} disabled={busy}>ย้อนกลับ</Button>}
                <div className="flex-1 min-w-0 text-secondary text-gray-600">
                    {lineCount > 0
                        ? <>เลือก {lineCount} รายการ · ประเมิน <span className="tabular-nums text-gray-900 font-medium">{money0(estimate)}</span> บาท</>
                        : 'ยังไม่ได้เลือกงาน'}
                </div>
                {step < 2 && (
                    <Button type="primary" size="large" disabled={step === 0 ? !step1Ok : !step2Ok} onClick={() => setStep(step + 1)}>
                        ถัดไป
                    </Button>
                )}
                {step === 2 && (
                    <>
                        <Button onClick={() => { void submit(false); }} disabled={busy}>บันทึกร่าง</Button>
                        <Button type="primary" size="large" loading={busy} disabled={n === 0} onClick={() => { void submit(true); }}>
                            {n === 0 ? 'ส่งคำเชิญ' : `ส่งคำเชิญ ${String(n)} ราย`}
                        </Button>
                    </>
                )}
            </div>

            <PreviewModal open={preview} onClose={() => setPreview(false)} request={request} buyerName={workspaceName}
                projectName={project.name} rows={rows} />
            {sent !== null && (
                <InvitationLinksModal open onClose={() => goPackage(sent.packageId)} rows={sent.rows} title="ส่งคำเชิญแล้ว"
                    buyerName={sent.buyerName} packageTitle={sent.title} deadline={sent.deadline} />
            )}
        </>
    );
}
