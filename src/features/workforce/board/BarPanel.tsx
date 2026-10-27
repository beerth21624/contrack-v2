'use client';

// ─── The panel of a clicked bar: project, task, dates, crew, conflicts, the wait after; for `assign` roles move it ───
// Mounted per assignment version (key = id + updatedAt), so its draft starts from what is saved every time. Moving
// onto days the crew already works elsewhere is allowed (the board warns, it does not block) after a confirm.
// While the draft differs from what is saved, "ผลของการเปลี่ยนนี้" shows the what-if (scenario.ts, W3): finish of the
// projects touched, conflicts, idle crew-days, and the later tasks of the project that would have to move along; with
// such knock-ons the save asks whether to move them too (saved one by one, useSaveSteps) or this task only.
import { useMemo, useState } from 'react';
import { App, Button, DatePicker, Drawer, Popconfirm, Select } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { CrewAssignmentDto, CrewDto, TaskLag } from '@/shared/contract';
import { crewBusy, crewsByFit, effectiveTaskLag, spanDays, taskTrade, type CrewBusySpan } from '@/domain/workforce';
import { addDays, thaiDayRange, type BoardConflict, type BoardWindow } from '@/domain/workforce/board';
import { whatIf, type ChangedAssignment } from '@/domain/workforce/scenario';
import { useCrewAssignments, useDeleteCrewAssignment, useUpdateCrewAssignment } from '@/features/cloud/api/workforce';
import { ImpactList } from './ImpactList';
import { changeLine, changeNamesOf, followOns, impactLines, saveSteps, type SaveStep } from './suggest-view';
import { showSaveFailure, useSaveSteps, writeError } from './useSaveSteps';
import { boardCrews, taskLabel, type BoardNames, type ProjectColour } from './view';

const FORMAT = 'DD/MM/YYYY';

export interface BarPanelProps {
    workspaceId: string;
    assignment: CrewAssignmentDto;
    /** Conflicts of this assignment shown on the board. */
    conflicts: readonly BoardConflict<CrewAssignmentDto>[];
    lags: readonly TaskLag[];
    crews: readonly CrewDto[];
    /** What the board loaded, its waits and window: the live before/after reads the same data as the board. */
    assignments: readonly CrewAssignmentDto[];
    lagsByProject: ReadonlyMap<string, readonly TaskLag[]>;
    boardWindow: BoardWindow;
    today: string;
    names: BoardNames;
    colour: ProjectColour;
    canAssign: boolean;
    onOpen: (assignmentId: string) => void;
    onClose: () => void;
}

function busyLine(b: CrewBusySpan<CrewAssignmentDto>, names: BoardNames): string {
    return `${names.project(b.assignment.projectId)} ${taskLabel(b.assignment.taskId)} ${thaiDayRange(b.from, b.to)}`;
}

export function BarPanel(props: BarPanelProps) {
    const { assignment: a, names, colour } = props;
    return (
        <Drawer open onClose={props.onClose} size="min(440px, 100vw)" destroyOnHidden
            title={<span className="text-[16px] font-semibold">{taskLabel(a.taskId)}</span>}>
            <PanelBody key={`${a.id}:${a.updatedAt}`} {...props} names={names} colour={colour} />
        </Drawer>
    );
}

function PanelBody({
    workspaceId, assignment: a, conflicts, lags, crews, assignments, lagsByProject, boardWindow, today, names, colour, canAssign,
    onOpen, onClose,
}: BarPanelProps) {
    const { message, modal } = App.useApp();
    const [crewId, setCrewId] = useState(a.crewId);
    const [start, setStart] = useState(a.start);
    const [end, setEnd] = useState(a.end);
    const update = useUpdateCrewAssignment(workspaceId);
    const remove = useDeleteCrewAssignment(workspaceId);
    // Who is free over the draft days, across the whole workspace.
    const around = useCrewAssignments(workspaceId, { from: start, to: end });

    const lag = effectiveTaskLag(a.taskId, lags);
    const trade = taskTrade(a.taskId);
    const offered = useMemo(
        () => crewsByFit(crews.filter(c => c.archivedAt === null || c.id === a.crewId), trade),
        [crews, a.crewId, trade],
    );
    const busyFor = (id: string) => (around.data === undefined ? [] : crewBusy(around.data, id, start, end, a.id));
    const hint = (busy: readonly CrewBusySpan<CrewAssignmentDto>[]): string => {
        if (around.data === undefined) return around.isError ? '' : 'กำลังตรวจสอบว่าว่างไหม…';
        const [first] = busy;
        if (first === undefined) return 'ว่าง';
        return `ติดงาน ${busyLine(first, names)}${busy.length > 1 ? ` และอีก ${String(busy.length - 1)} งาน` : ''}`;
    };
    const selectedBusy = busyFor(crewId);
    const changed = crewId !== a.crewId || start !== a.start || end !== a.end;
    const steps = useSaveSteps(workspaceId);
    const lineNames = useMemo(() => changeNamesOf(names), [names]);

    // The what-if of the draft (pushes only: nothing is brought earlier by itself).
    const preview = useMemo(() => {
        if (!changed) return undefined;
        const w = whatIf(boardCrews(crews, assignments, boardWindow), assignments, lagsByProject,
            [{ assignmentId: a.id, crewId, start, end }], boardWindow, today);
        return { w, follow: followOns(w.result.changed) };
    }, [changed, crews, assignments, boardWindow, lagsByProject, a.id, crewId, start, end, today]);
    const moneyVisible = crews.some(c => c.dailyCost !== null);

    const save = async () => {
        try {
            await update.mutateAsync({
                assignmentId: a.id,
                ...(crewId !== a.crewId ? { crewId } : {}),
                ...(start !== a.start ? { start } : {}),
                ...(end !== a.end ? { end } : {}),
            });
            void message.success('บันทึกแล้ว');
        } catch (e) {
            void message.error(writeError(e));
        }
    };

    const stepLine = (s: SaveStep) => changeLine(s.change, lineNames);
    const saveWithFollowOns = async () => {
        if (preview === undefined) return;
        const list = saveSteps(preview.w.result.changed);
        const result = await steps.run(list);
        if (result.failed === undefined) void message.success(`บันทึกแล้ว พร้อมเลื่อนงานที่ตามมา ${String(list.length - 1)} งาน`);
        else showSaveFailure(modal, result, list.length, stepLine);
    };

    // Knock-ons: move them along (every change, one by one) or save this task only (as before W3).
    const askFollowOns = (follow: readonly ChangedAssignment<CrewAssignmentDto>[]) => {
        // Overlaps with a task that moves along only hold when this task is saved alone.
        const followIds = new Set(follow.map(c => c.after.id));
        const busyStays = selectedBusy.filter(b => !followIds.has(b.assignment.id));
        const busyIfAlone = selectedBusy.length - busyStays.length;
        const busyNote = (busyStays.length > 0 || busyIfAlone > 0) && (
            <div className="flex flex-col gap-1">
                {busyStays.length > 0 && (
                    <>
                        <div className="text-gray-900 font-medium">{names.crew(crewId)} ติดงานในช่วงนี้</div>
                        <ul className="list-disc pl-5 text-gray-700">
                            {busyStays.map(b => <li key={b.assignment.id}>{busyLine(b, names)} (ซ้อน {b.days} วัน)</li>)}
                        </ul>
                    </>
                )}
                {busyIfAlone > 0 && (
                    <div className="text-gray-600">ถ้าบันทึกเฉพาะงานนี้ {names.crew(crewId)} จะถูกจัดซ้อนกับงานที่ควรเลื่อนตาม</div>
                )}
                <div className="text-gray-600">บันทึกซ้อนกันได้ ทีมจะต้องแบ่งเวลาระหว่างงาน</div>
            </div>
        );
        const dialog = modal.confirm({
            title: `มีงานที่ต้องเลื่อนตาม ${String(follow.length)} งาน`,
            width: 520,
            content: (
                <div className="flex flex-col gap-3 text-[13px]">
                    <div className="flex flex-col gap-1">
                        <div className="text-gray-600">ถ้าไม่เลื่อนตาม งานเหล่านี้จะเริ่มก่อนงานก่อนหน้าจบและรอครบ</div>
                        <ul className="list-disc pl-5 text-gray-800">
                            {follow.map(c => <li key={c.after.id} className="break-words">{changeLine(c, lineNames)}</li>)}
                        </ul>
                    </div>
                    {busyNote}
                </div>
            ),
            footer: (_, { CancelBtn }) => (
                <div className="flex flex-wrap justify-end gap-2 mt-4">
                    <CancelBtn />
                    <Button onClick={() => { dialog.destroy(); void save(); }}>บันทึกเฉพาะงานนี้</Button>
                    <Button type="primary" onClick={() => { dialog.destroy(); void saveWithFollowOns(); }}>บันทึกพร้อมเลื่อนงานที่ตามมา</Button>
                </div>
            ),
            cancelText: 'กลับไปแก้',
        });
    };

    const submit = () => {
        if (!changed) return;
        if (preview !== undefined && preview.follow.length > 0) { askFollowOns(preview.follow); return; }
        if (selectedBusy.length === 0) { void save(); return; }
        modal.confirm({
            title: `${names.crew(crewId)} ติดงานในช่วงนี้`,
            content: (
                <div className="flex flex-col gap-1 text-[13px]">
                    <ul className="list-disc pl-5 text-gray-700">
                        {selectedBusy.map(b => <li key={b.assignment.id}>{busyLine(b, names)} (ซ้อน {b.days} วัน)</li>)}
                    </ul>
                    <div className="text-gray-600">บันทึกซ้อนกันได้ ทีมจะต้องแบ่งเวลาระหว่างงาน</div>
                </div>
            ),
            okText: 'บันทึกซ้อนกัน',
            cancelText: 'กลับไปแก้',
            onOk: save,
        });
    };

    const deleteIt = async () => {
        try {
            await remove.mutateAsync(a.id);
            void message.success(`เอา${names.crew(a.crewId)}ออกจากงาน ${a.taskId} แล้ว`);
            onClose();
        } catch (e) {
            void message.error(writeError(e));
        }
    };

    const row = (label: string, value: React.ReactNode) => (
        <div className="grid grid-cols-[88px_1fr] gap-3 text-[14px] leading-6">
            <span className="text-gray-500 text-[13px]">{label}</span>
            <span className="text-gray-900 min-w-0">{value}</span>
        </div>
    );

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
                {row('โครงการ', (
                    <span className="flex items-start gap-2 min-w-0">
                        <span aria-hidden className="mt-[7px] shrink-0 w-2.5 h-2.5 rounded-sm" style={{ background: colour.accent }} />
                        <span className="break-words">{names.project(a.projectId)}</span>
                    </span>
                ))}
                {row('ทีม', names.crew(a.crewId))}
                {row('วันที่', <span className="tabular-nums">{thaiDayRange(a.start, a.end)} · {spanDays(a.start, a.end)} วัน</span>)}
                {lag.days > 0 && row('รอหลังงาน', (
                    <span className="text-gray-700">
                        {lag.days} วัน · {lag.reason}
                        <span className="block text-[12px] text-gray-500 tabular-nums">
                            {thaiDayRange(addDays(a.end, 1), addDays(a.end, lag.days))} ทีมว่าง ย้ายไปช่วยงานอื่นได้
                            {lag.overridden ? ' · โครงการกำหนดเอง' : ''}
                        </span>
                    </span>
                ))}
                {a.note !== null && a.note.trim() !== '' && row('หมายเหตุ', <span className="text-gray-700 break-words">{a.note}</span>)}
            </div>

            {conflicts.length > 0 && (
                <div className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2.5 flex flex-col gap-1.5" role="alert">
                    <div className="text-[13px] font-medium text-red-700">ทีมนี้ถูกจัดซ้อนกับงานอื่น</div>
                    {conflicts.map(c => {
                        const other = c.a.id === a.id ? c.b : c.a;
                        return (
                            <div key={other.id} className="flex items-start gap-2 text-[13px] text-gray-800">
                                <span className="flex-1 min-w-0">
                                    {names.project(other.projectId)} {taskLabel(other.taskId)}
                                    <span className="block text-[12px] text-red-700 tabular-nums">ชน {c.days} วัน ({thaiDayRange(c.from, c.to)})</span>
                                </span>
                                <Button size="small" type="link" className="!px-0" onClick={() => onOpen(other.id)}>เปิดงานนั้น</Button>
                            </div>
                        );
                    })}
                </div>
            )}

            {canAssign ? (
                <div className="flex flex-col gap-4 border-t border-gray-100 pt-4">
                    <div className="text-[14px] font-medium text-gray-900">ย้ายทีมหรือเลื่อนวัน</div>
                    <label className="flex flex-col gap-1">
                        <span className="text-[13px] font-medium text-gray-700">ทีม</span>
                        <Select<string> value={crewId} onChange={setCrewId} aria-label="ทีม" showSearch={{ optionFilterProp: 'label' }}
                            options={offered.map(c => ({ value: c.id, label: c.name }))}
                            optionRender={o => {
                                const id = String(o.value);
                                const busy = busyFor(id);
                                const text = hint(busy);
                                return (
                                    <div className="flex flex-col py-0.5 min-w-0">
                                        <span className="truncate text-[14px] text-gray-900">{names.crew(id)}</span>
                                        {text !== '' && <span className={`truncate text-[12px] ${busy.length > 0 ? 'text-amber-600' : 'text-gray-500'}`}>{text}</span>}
                                    </div>
                                );
                            }} />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-[13px] font-medium text-gray-700">ช่วงวันที่</span>
                        <DatePicker.RangePicker format={FORMAT} allowClear={false} aria-label="ช่วงวันที่" inputReadOnly
                            value={[dayjs(start), dayjs(end)]}
                            onChange={v => {
                                const [x, y] = v ?? [null, null];
                                if (x !== null && y !== null) { setStart(x.format('YYYY-MM-DD')); setEnd(y.format('YYYY-MM-DD')); }
                            }} />
                        {selectedBusy.length > 0 && (
                            <span className="text-[12px] text-amber-600">
                                ติดงาน {selectedBusy.map(b => busyLine(b, names)).join(', ')}
                            </span>
                        )}
                    </label>
                    {preview !== undefined && (
                        <div className="rounded-[6px] border border-gray-200 bg-gray-50 px-3 py-2.5 flex flex-col gap-2 min-w-0" aria-live="polite">
                            <div className="flex items-baseline gap-2">
                                <span className="text-[13px] font-medium text-gray-900">ผลของการเปลี่ยนนี้</span>
                                <span className="text-[12px] text-gray-500">ยังไม่ได้บันทึก</span>
                            </div>
                            <ImpactList compact lines={impactLines(preview.w, { projectName: names.project, moneyVisible, today })} />
                            {preview.follow.length > 0 && (
                                <div className="flex flex-col gap-1 border-t border-gray-200 pt-2">
                                    <span className="text-[13px] text-amber-700">มีงานที่ต้องเลื่อนตาม {preview.follow.length} งาน</span>
                                    <ul className="list-disc pl-5 m-0 text-[12px] text-gray-700">
                                        {preview.follow.map(c => <li key={c.after.id} className="break-words">{changeLine(c, lineNames)}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <Popconfirm title="เอาทีมนี้ออกจากงาน?" description="ลบเฉพาะการจัดทีมของงานนี้ ทีมยังอยู่ในบริษัท"
                            okText="เอาออก" cancelText="ยกเลิก" okButtonProps={{ danger: true, loading: remove.isPending }} onConfirm={deleteIt}>
                            <Button danger type="text" icon={<DeleteOutlined />}>เอาออก</Button>
                        </Popconfirm>
                        <span className="ml-auto" />
                        {changed && <Button onClick={() => { setCrewId(a.crewId); setStart(a.start); setEnd(a.end); }}>คืนค่า</Button>}
                        <Button type="primary" disabled={!changed} loading={update.isPending || steps.saving} onClick={submit}>บันทึก</Button>
                    </div>
                </div>
            ) : (
                <div className="text-[13px] text-gray-500 border-t border-gray-100 pt-4">ดูได้อย่างเดียว เจ้าของ ผู้ดูแล หรือผู้ประมาณราคาเป็นผู้จัดทีม</div>
            )}
        </div>
    );
}
