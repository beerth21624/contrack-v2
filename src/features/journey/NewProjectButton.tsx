'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Modal } from 'antd';
import { FileAddOutlined, HomeOutlined, PlusOutlined } from '@ant-design/icons';
import { useProjectStore } from '@/store/project-store';
import type { ProjectStart } from '@/domain/project';
import { JOURNEY_LEVELS } from '@/domain/journey';

/** Start a new project (replaces the current one after confirmation). */
export function NewProjectButton({ size }: { size?: 'large' | 'middle' }) {
    const t = useTranslations('journeyUi.newProject');
    const router = useRouter();
    const newProject = useProjectStore(s => s.newProject);
    const isCloud = useProjectStore(s => s.binding.kind === 'cloud');
    const [open, setOpen] = useState(false);
    const choices: { start: ProjectStart; icon: React.ReactNode; title: string; text: string }[] = [
        { start: 'blank', icon: <FileAddOutlined />, title: t('blankTitle'), text: t('blankText') },
        { start: 'sample', icon: <HomeOutlined />, title: t('sampleTitle'), text: t('sampleText') },
    ];

    // A cloud project is never replaced: new cloud projects are made on the projects page.
    if (isCloud) {
        return <Button size={size} icon={<PlusOutlined />} onClick={() => router.push('/projects')}>{t('button')}</Button>;
    }

    const choose = (start: ProjectStart) => {
        newProject(start);
        setOpen(false);
        const first = JOURNEY_LEVELS[0];
        router.push(first ? `/journey/${first.id}` : '/journey');
    };

    return (
        <>
            <Button size={size} icon={<PlusOutlined />} onClick={() => setOpen(true)}>{t('button')}</Button>
            <Modal open={open} onCancel={() => setOpen(false)} footer={null} title={t('modalTitle')} width={560}>
                <p className="text-[13px] text-gray-500 mb-3">{t('replaceNote')}</p>
                <div className="flex flex-col gap-3">
                    {choices.map(c => (
                        <button key={c.start} type="button" onClick={() => choose(c.start)}
                            className="text-left flex gap-3 rounded-lg border-2 border-gray-200 hover:border-orange-400 hover:bg-orange-50 p-4 transition cursor-pointer bg-white">
                            <span className="text-[24px] text-orange-500">{c.icon}</span>
                            <span>
                                <span className="block font-semibold text-[15px] text-gray-900">{c.title}</span>
                                <span className="block text-[13px] text-gray-600">{c.text}</span>
                            </span>
                        </button>
                    ))}
                </div>
            </Modal>
        </>
    );
}
