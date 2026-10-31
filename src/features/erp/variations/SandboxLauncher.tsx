'use client';

// ─── Price a VO with the calculators: the launcher on the VO page and the bar shown above every page while in it ───
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, App, Button } from 'antd';
import { CalculatorOutlined, CloseOutlined, SaveOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { VariationOrderDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useProjectStore } from '@/store/project-store';
import { enterVariationSandbox, leaveVariationSandbox, saveVariationSandbox } from './sandbox';
import { variationHref } from './status';

/** On the VO page: how many calculators / BOQ edits the sandbox holds, and the button that opens it. */
export function SandboxLauncher({ dto, workspaceId, editable }: { dto: VariationOrderDto; workspaceId: string | undefined; editable: boolean }) {
    const t = useTranslations('variations.sandbox');
    const router = useRouter();
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const [opening, setOpening] = useState(false);
    const calculators = Object.keys(dto.sandbox.calculators).length;
    const edits = Object.keys(dto.sandbox.boqOverrides).length;
    const calcLines = dto.lines.filter(l => l.source === 'calculator').length;

    const open = async () => {
        if (workspaceId === undefined) return;
        setOpening(true);
        try {
            const problem = await enterVariationSandbox(dto, workspaceId);
            if (problem !== null) {
                void message.warning(t(`problems.${problem}`));
                return;
            }
            router.push('/boq');
        } catch (e) {
            void message.error(toText(e));
        } finally {
            setOpening(false);
        }
    };

    return (
        <div className="flex min-w-0 flex-col gap-2">
            <div className="text-[13px] text-gray-600">{t('hint')}</div>
            <div className="text-[13px] text-gray-500">{t('summary', { calculators, edits, lines: calcLines })}</div>
            {editable && (
                <div>
                    <Button type="primary" ghost icon={<CalculatorOutlined />} loading={opening} disabled={workspaceId === undefined}
                        onClick={() => { void open(); }}>
                        {t('open')}
                    </Button>
                </div>
            )}
        </div>
    );
}

/** Above every page while a VO sandbox is the working copy: save (compute the VO lines) or leave without saving. */
export function SandboxBanner() {
    const t = useTranslations('variations.sandbox');
    const binding = useProjectStore(s => (s.binding.kind === 'sandbox' ? s.binding : null));
    const qc = useQueryClient();
    const router = useRouter();
    const toText = useErrorMessage();
    const { message, modal } = App.useApp();
    const [busy, setBusy] = useState<'save' | 'cancel' | null>(null);
    if (binding === null) return null;
    const back = variationHref(binding.projectId, binding.variationId);

    const save = async () => {
        setBusy('save');
        try {
            await saveVariationSandbox(qc);
            await leaveVariationSandbox(qc);
            void message.success(t('saved'));
            router.push(back);
        } catch (e) {
            void message.error(toText(e));
        } finally {
            setBusy(null);
        }
    };
    const cancel = () => {
        modal.confirm({
            title: t('cancelConfirm'),
            okText: t('cancelOk'),
            okButtonProps: { danger: true },
            onOk: async () => {
                setBusy('cancel');
                try {
                    await leaveVariationSandbox(qc);
                    router.push(back);
                } finally {
                    setBusy(null);
                }
            },
        });
    };

    return (
        <Alert type="info" showIcon icon={<CalculatorOutlined />} className="!mb-4"
            title={t('bannerTitle', { label: binding.label })}
            description={t('bannerHint')}
            action={(
                <div className="flex flex-wrap gap-2">
                    <Button type="primary" size="small" icon={<SaveOutlined />} loading={busy === 'save'} disabled={busy !== null}
                        onClick={() => { void save(); }}>
                        {t('save')}
                    </Button>
                    <Button size="small" icon={<CloseOutlined />} loading={busy === 'cancel'} disabled={busy !== null} onClick={cancel}>
                        {t('cancel')}
                    </Button>
                </div>
            )} />
    );
}
