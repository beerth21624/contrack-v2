'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal } from 'antd';
import { FileAddOutlined, HomeOutlined, PlusOutlined } from '@ant-design/icons';
import { useProjectStore } from '@/store/project-store';
import type { ProjectStart } from '@/domain/project';
import { JOURNEY_LEVELS } from '@/domain/journey';

const CHOICES: { start: ProjectStart; icon: React.ReactNode; title: string; text: string }[] = [
    {
        start: 'blank', icon: <FileAddOutlined />, title: 'เริ่มจากแบบแปลนของฉัน',
        text: 'ทุกขั้นตอนเริ่มจากค่าว่าง กรอกขนาดและจำนวนตามแบบ ราคาวัสดุ/ค่าแรงตั้งต้นจาก Excel v5 (แก้ไขได้)',
    },
    {
        start: 'sample', icon: <HomeOutlined />, title: 'ทดลองกับบ้านตัวอย่าง',
        text: 'บ้านชั้นเดียวจาก Excel Training Edition v5 กรอกข้อมูลไว้ครบ เหมาะสำหรับทดลองใช้งานและเปรียบเทียบกับ Excel',
    },
];

/** Start a new project (replaces the current one after confirmation). */
export function NewProjectButton({ size }: { size?: 'large' | 'middle' }) {
    const router = useRouter();
    const newProject = useProjectStore(s => s.newProject);
    const isCloud = useProjectStore(s => s.binding.kind === 'cloud');
    const [open, setOpen] = useState(false);

    // A cloud project is never replaced: new cloud projects are made on the projects page.
    if (isCloud) {
        return <Button size={size} icon={<PlusOutlined />} onClick={() => router.push('/projects')}>โครงการใหม่</Button>;
    }

    const choose = (start: ProjectStart) => {
        newProject(start);
        setOpen(false);
        const first = JOURNEY_LEVELS[0];
        router.push(first ? `/journey/${first.id}` : '/journey');
    };

    return (
        <>
            <Button size={size} icon={<PlusOutlined />} onClick={() => setOpen(true)}>โครงการใหม่</Button>
            <Modal open={open} onCancel={() => setOpen(false)} footer={null} title="เริ่มโครงการใหม่" width={560}>
                <p className="text-[13px] text-gray-500 mb-3">ข้อมูลโครงการปัจจุบันจะถูกแทนที่</p>
                <div className="flex flex-col gap-3">
                    {CHOICES.map(c => (
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
