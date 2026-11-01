'use client';

// "+ จัดทีม" / edit a crew chip: which crew, from when to when, a note. The crews of the task's trade come first and
// each shows whether it is free over the chosen days across the whole workspace ("ว่าง" / "ติดงาน …"). Overlaps are
// allowed — a crew can split its time — but the user confirms them before saving. Mounted only while open, so its
// state starts from the task (or the edited assignment) every time.
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { App, Button, DatePicker, Input, Modal, Popconfirm, Select } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
    WORKFORCE_NOTE_MAX, type CrewAssignmentDto, type CrewDto,
} from '@/shared/contract';
import { crewsByFit } from '@/domain/workforce';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import {
    useCreateCrewAssignment, useCrewAssignments, useDeleteCrewAssignment, useUpdateCrewAssignment, workforceConflictMessage,
} from '@/features/cloud/api/workforce';
import { useProjects } from '@/features/cloud/query/hooks';
import { usePlanningText } from '@/features/planning/usePlanningText';
import { tradeNameOf } from '../text';
import type { OpenCloudProject } from './project-workforce';
import {
    assignProblemText, assignProblems, assignmentPatch, availabilityHint, busyOf, overlapLines, type BusyContext, type TeamTaskRow,
} from './team-model';

const FORMAT = 'DD/MM/YYYY';

export function AssignCrewModal({ cloud, task, editing, crews, crewName, onClose }: {
    cloud: OpenCloudProject;
    task: TeamTaskRow<CrewAssignmentDto>;
    /** The assignment being edited; undefined = a new one. */
    editing: CrewAssignmentDto | undefined;
    /** The workspace's crews (archived ones are offered only when already chosen). */
    crews: readonly CrewDto[];
    crewName: (crewId: string) => string;
    onClose: () => void;
}) {
    const { message, modal } = App.useApp();
    const t = useTranslations('workforce');
    const tc = useTranslations('common');
    const errorMessage = useErrorMessage();
    const planning = usePlanningText();
    const writeError = (e: unknown) => workforceConflictMessage(e) ?? errorMessage(e);
    const taskName = planning.task(task.id, task.name);
    const [crewId, setCrewId] = useState<string | undefined>(editing?.crewId);
    const [start, setStart] = useState<string | null>(editing?.start ?? task.start);
    const [end, setEnd] = useState<string | null>(editing?.end ?? task.finish);
    const [note, setNote] = useState(editing?.note ?? '');
    /** A save was refused for a missing field: from then on what is still missing shows red. */
    const [tried, setTried] = useState(false);

    const all = useCrewAssignments(cloud.workspaceId);
    const projects = useProjects(cloud.workspaceId);
    const create = useCreateCrewAssignment(cloud.workspaceId);
    const update = useUpdateCrewAssignment(cloud.workspaceId);
    const remove = useDeleteCrewAssignment(cloud.workspaceId);
    const saving = create.isPending || update.isPending;

    const ctx: BusyContext = useMemo(() => {
        const names = new Map((projects.data ?? []).map(p => [p.id, p.name]));
        return { projectId: cloud.projectId, projectName: id => names.get(id) };
    }, [projects.data, cloud.projectId]);

    const workspaceAssignments = all.data;
    const busyFor = (id: string) => busyOf(workspaceAssignments ?? [], id, start, end, editing?.id);

    const offered = crewsByFit(crews.filter(c => c.archivedAt === null || c.id === editing?.crewId), task.trade);
    const fits = offered.filter(c => task.trade !== undefined && c.trade === task.trade);
    const others = offered.filter(c => !fits.includes(c));
    const hints = new Map(offered.map(c => {
        if (workspaceAssignments === undefined) return [c.id, { text: all.isError ? '' : t('shared.checking'), busy: false }];
        const busy = busyFor(c.id);
        return [c.id, { text: availabilityHint(busy, ctx), busy: busy.length > 0 }];
    }));
    const option = (c: CrewDto) => ({ value: c.id, label: c.name });
    const tradeLabel = task.trade === undefined ? t('shared.tradeGroupThis') : t('shared.tradeGroupNamed', { trade: tradeNameOf(t, task.trade) });
    const options = [
        ...(fits.length > 0 ? [{ label: tradeLabel, title: tradeLabel, options: fits.map(option) }] : []),
        ...(others.length > 0 ? [{
            label: fits.length > 0 ? t('shared.tradeGroupOther') : t('shared.allCrews'), title: t('shared.tradeGroupOther'), options: others.map(option),
        }] : []),
    ];

    const selectedBusy = crewId === undefined ? [] : busyFor(crewId);
    const problems = assignProblems({ crewId, start, end });
    const trimmedNote = note.trim();

    const save = async () => {
        if (crewId === undefined || start === null || end === null) return;
        try {
            if (editing === undefined) {
                await create.mutateAsync({
                    projectId: cloud.projectId, taskId: task.id, crewId, start, end, note: trimmedNote === '' ? null : trimmedNote,
                });
                void message.success(t('assign.done', { crew: crewName(crewId), id: task.id }));
            } else {
                const patch = assignmentPatch(editing, { crewId, start, end, note });
                if (patch !== undefined) {
                    await update.mutateAsync({ assignmentId: editing.id, ...patch });
                    void message.success(t('assign.saved'));
                }
            }
            onClose();
        } catch (e) {
            void message.error(writeError(e));
        }
    };

    const submit = () => {
        if (problems.length > 0) { setTried(true); return; }
        if (selectedBusy.length === 0) { void save(); return; }
        modal.confirm({
            title: crewId === undefined ? t('shared.busyTitleThis') : t('shared.busyTitle', { crew: crewName(crewId) }),
            content: (
                <div className="flex flex-col gap-1 text-[13px]">
                    <ul className="list-disc pl-5 text-gray-700">
                        {overlapLines(selectedBusy, ctx).map(l => <li key={l}>{l}</li>)}
                    </ul>
                    <div className="text-gray-600">{t('shared.overlapOk')}</div>
                </div>
            ),
            okText: t('shared.overlapSave'),
            cancelText: t('shared.backToEdit'),
            onOk: save,
        });
    };

    const deleteIt = async () => {
        if (editing === undefined) return;
        try {
            await remove.mutateAsync(editing.id);
            void message.success(t('shared.removedFrom', { crew: crewName(editing.crewId), id: task.id }));
            onClose();
        } catch (e) {
            void message.error(writeError(e));
        }
    };

    const shown = tried ? problems : [];

    return (
        <Modal open onCancel={onClose} destroyOnHidden width={520}
            title={t(editing === undefined ? 'assign.titleNew' : 'assign.titleEdit', { id: task.id, name: taskName })}
            footer={(
                <div className="flex items-center gap-2">
                    {editing !== undefined && (
                        <Popconfirm title={t('shared.removeTitle')} description={t('shared.removeDesc')}
                            okText={t('shared.removeOut')} cancelText={tc('cancel')} okButtonProps={{ danger: true, loading: remove.isPending }}
                            onConfirm={deleteIt}>
                            <Button danger type="text" icon={<DeleteOutlined />}>{t('shared.removeOut')}</Button>
                        </Popconfirm>
                    )}
                    <span className="ml-auto" />
                    <Button onClick={onClose}>{tc('cancel')}</Button>
                    <Button type="primary" loading={saving} onClick={submit}>{tc('save')}</Button>
                </div>
            )}>
            <div className="flex flex-col gap-4 pt-1">
                <div className="text-[13px] text-gray-600 tabular-nums">
                    {t('assign.planned', {
                        range: task.start === null || task.finish === null
                            ? t('shared.noDates') : `${dayjs(task.start).format(FORMAT)} – ${dayjs(task.finish).format(FORMAT)}`,
                    })}
                    {' · '}{t('assign.needs', { skilled: task.skilled, labourers: task.labourers })}
                </div>

                <label className="flex flex-col gap-1">
                    <span className="text-[13px] font-medium text-gray-700">{t('assign.crew')} <span className="text-gray-400">*</span></span>
                    <Select<string> value={crewId} onChange={v => setCrewId(v)} options={options} placeholder={t('assign.crewPlaceholder')}
                        status={shown.includes('crew') ? 'error' : undefined}
                        showSearch={{ optionFilterProp: 'label' }} aria-label={t('assign.crew')}
                        notFoundContent={<span className="text-[13px] text-gray-500">{t('assign.noCrews')}</span>}
                        optionRender={o => {
                            const id = String(o.value);
                            const h = hints.get(id);
                            return (
                                <div className="flex flex-col py-0.5 min-w-0">
                                    <span className="truncate text-[14px] text-gray-900">{crewName(id)}</span>
                                    {h !== undefined && h.text !== '' && (
                                        <span className={`truncate text-[12px] ${h.busy ? 'text-amber-600' : 'text-gray-500'}`}>{h.text}</span>
                                    )}
                                </div>
                            );
                        }} />
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-[13px] font-medium text-gray-700">{t('assign.dates')} <span className="text-gray-400">*</span></span>
                    <DatePicker.RangePicker format={FORMAT} allowClear={false} aria-label={t('assign.dates')}
                        status={shown.includes('dates') || shown.includes('order') ? 'error' : undefined}
                        value={start === null || end === null ? null : [dayjs(start), dayjs(end)]}
                        onChange={v => {
                            const [a, b] = v ?? [null, null];
                            setStart(a ? a.format('YYYY-MM-DD') : null);
                            setEnd(b ? b.format('YYYY-MM-DD') : null);
                        }} />
                    {selectedBusy.length > 0 && (
                        <span className="text-[12px] text-amber-600">{availabilityHint(selectedBusy, ctx)}</span>
                    )}
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-[13px] font-medium text-gray-700">{t('assign.note')}</span>
                    <Input.TextArea value={note} onChange={e => setNote(e.target.value)} maxLength={WORKFORCE_NOTE_MAX}
                        autoSize={{ minRows: 2, maxRows: 4 }} placeholder={t('assign.notePlaceholder')} />
                </label>

                {shown.length > 0 && (
                    <div className="text-[13px] text-red-600" role="alert">{shown.map(p => assignProblemText(p)).join(' · ')}</div>
                )}
            </div>
        </Modal>
    );
}
