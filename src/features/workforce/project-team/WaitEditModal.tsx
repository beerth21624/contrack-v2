'use client';

// The wait after one planned task (ช่วงรอหลังงาน): how many days the work waits (concrete curing, plaster drying …)
// and why. Saving PUTs the project's whole override list (only the tasks that differ from the default); "ใช้ค่าตั้งต้น"
// drops this task's override. Waits never move the S-Curve dates. Mounted only while open, so its state starts from
// the task's current wait every time.
import { useState } from 'react';
import { App, Button, Input, InputNumber, Modal } from 'antd';
import { MAX_TASK_LAG_DAYS, type TaskLag } from '@/shared/contract';
import { effectiveTaskLag } from '@/domain/workforce';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { usePutProjectTaskLags } from '@/features/cloud/api/workforce';
import type { OpenCloudProject } from './project-workforce';
import { defaultWaitText, nextLagOverrides, sameLagOverrides, waitDaysProblem } from './team-model';

/** The contract's limit on a wait's note. */
const NOTE_MAX = 200;

export function WaitEditModal({ cloud, task, overrides, onClose }: {
    cloud: OpenCloudProject;
    task: { id: string; name: string };
    /** The project's stored overrides (all tasks). */
    overrides: readonly TaskLag[];
    onClose: () => void;
}) {
    const { message } = App.useApp();
    const lag = effectiveTaskLag(task.id, overrides);
    const own = overrides.find(l => l.taskId === task.id);
    const [days, setDays] = useState<number | null>(lag.days);
    const [note, setNote] = useState(own?.note ?? '');
    const [tried, setTried] = useState(false);
    const put = usePutProjectTaskLags(cloud.projectId, cloud.workspaceId);
    const problem = waitDaysProblem(days);

    const write = async (next: TaskLag[], done: string) => {
        if (sameLagOverrides(next, overrides)) { onClose(); return; }
        try {
            await put.mutateAsync(next);
            void message.success(done);
            onClose();
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };

    const save = () => {
        if (days === null || problem !== undefined) { setTried(true); return; }
        void write(nextLagOverrides(overrides, task.id, { days, note }), 'บันทึกช่วงรอแล้ว');
    };
    const reset = () => { void write(nextLagOverrides(overrides, task.id, null), 'ใช้ช่วงรอค่าตั้งต้นแล้ว'); };

    return (
        <Modal open onCancel={onClose} destroyOnHidden width={440} title={`ช่วงรอหลังงาน · ${task.id} ${task.name}`}
            footer={(
                <div className="flex items-center gap-2">
                    {lag.overridden && <Button type="text" onClick={reset} disabled={put.isPending}>ใช้ค่าตั้งต้น</Button>}
                    <span className="ml-auto" />
                    <Button onClick={onClose}>ยกเลิก</Button>
                    <Button type="primary" loading={put.isPending} onClick={save}>บันทึก</Button>
                </div>
            )}>
            <div className="flex flex-col gap-4 pt-1">
                <div className="text-[13px] text-gray-600">{defaultWaitText(task.id)}</div>
                <label className="flex flex-col gap-1">
                    <span className="text-[13px] font-medium text-gray-700">รอกี่วัน</span>
                    <InputNumber<number> value={days} onChange={v => setDays(v)} min={0} max={MAX_TASK_LAG_DAYS} precision={0}
                        suffix="วัน" className="w-40" aria-label="รอกี่วัน"
                        status={tried && problem !== undefined ? 'error' : undefined} />
                    {tried && problem !== undefined && <span className="text-[12px] text-red-600" role="alert">{problem}</span>}
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[13px] font-medium text-gray-700">เหตุผล</span>
                    <Input value={note} onChange={e => setNote(e.target.value)} maxLength={NOTE_MAX}
                        placeholder={lag.reason === '' ? 'เช่น รอปูนเซ็ตตัว' : lag.reason} aria-label="เหตุผล" />
                </label>
            </div>
        </Modal>
    );
}
