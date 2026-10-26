'use client';

// ─── Wizard step 3: schedule (from the S-Curve), proposed installments, bid deadline, who receives the invitation ───
import { useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { App, Button, DatePicker, Input, InputNumber, Segmented, Select, Switch, Table } from 'antd';
import { CheckOutlined, DeleteOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import {
    formatThaiPhone, phoneSchema, type InstallmentDto, type InviteChannel, type ScheduleDto, type VendorListEntryDto,
} from '@/shared/contract';
import type { ScheduleTaskResult } from '@/domain/planning/schedule';
import { isApiError, thaiErrorMessage } from '@/features/cloud/api/errors';
import { CHANNEL_LABEL, daysBetween, fmtDay, installmentsTotal, installmentsValid, pct, renumber, toDay } from '../format';
import { useCreateVendor, useVendorList } from '../hooks';
import { Card } from '../ui';
import { Field } from './StepTerms';
import {
    MAX_RFQ, inviteeProblem, installmentsOf, scheduleFromPlan, scheduleOf, sortVendors, toggleInvitee,
    type DirectOrRfq, type Draft,
} from './state';

const day = (s: string | null) => (s === null ? null : dayjs(s));

export function StepSend({ draft, update, tasks, workspaceId, province, onPreview }: {
    draft: Draft;
    update: (patch: Partial<Draft>) => void;
    tasks: readonly ScheduleTaskResult[];
    workspaceId: string;
    province: string;
    onPreview: () => void;
}) {
    const schedule = scheduleOf(draft, tasks);
    const planned = scheduleFromPlan(tasks, draft.trade);
    const installments = installmentsOf(draft, schedule);

    const setSchedule = (patch: Partial<ScheduleDto>) => {
        const next = { ...schedule, ...patch };
        if (patch.start !== undefined || patch.finish !== undefined) next.days = daysBetween(next.start, next.finish) ?? next.days;
        update({ schedule: next });
    };

    return (
        <>
            <Card title="กำหนดเวลา" extra={draft.schedule !== null ? (
                <Button size="small" type="link" onClick={() => update({ schedule: null })}>ใช้ตามแผนงาน</Button>
            ) : undefined}>
                {draft.schedule === null && planned.start === null && (
                    <p className="text-secondary text-gray-500 mt-0 mb-2">ยังไม่กำหนดในแผนงาน (S-Curve) กรอกวันเองได้</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                    <DatePicker format="DD/MM/YYYY" placeholder="วันเริ่ม" aria-label="วันเริ่ม" value={day(schedule.start)}
                        onChange={(d: Dayjs | null) => setSchedule({ start: d === null ? null : d.format('YYYY-MM-DD') })} />
                    <span className="text-gray-400">ถึง</span>
                    <DatePicker format="DD/MM/YYYY" placeholder="วันจบ" aria-label="วันจบ" value={day(schedule.finish)}
                        status={schedule.start !== null && schedule.finish !== null && schedule.finish < schedule.start ? 'error' : undefined}
                        onChange={(d: Dayjs | null) => setSchedule({ finish: d === null ? null : d.format('YYYY-MM-DD') })} />
                    <InputNumber<number> className="!w-32" min={0} max={3650} precision={0} suffix="วัน" aria-label="จำนวนวัน"
                        value={schedule.days} onChange={v => setSchedule({ days: v })} />
                </div>
            </Card>

            <InstallmentsCard list={installments} overridden={draft.installments !== null}
                onChange={list => update({ installments: list })} onReset={() => update({ installments: null })} />

            <Card title="การรับราคา">
                <Field label="ปิดรับราคา">
                    <DatePicker showTime={{ format: 'HH:mm' }} format="DD/MM/YYYY HH:mm" allowClear={false} aria-label="ปิดรับราคา"
                        value={dayjs(draft.bidDeadline)} disabledDate={d => d.isBefore(dayjs(), 'day')}
                        onChange={(d: Dayjs | null) => { if (d !== null) update({ bidDeadline: d.second(0).millisecond(0).toISOString() }); }} />
                </Field>
                <Field label="ราคายืนถึง">
                    <DatePicker format="DD/MM/YYYY" allowClear={false} aria-label="ราคายืนถึง" value={dayjs(draft.priceValidUntil)}
                        disabledDate={d => d.isBefore(dayjs(), 'day')}
                        onChange={(d: Dayjs | null) => { if (d !== null) update({ priceValidUntil: toDay(d.toDate()) }); }} />
                </Field>
            </Card>

            <InviteesCard draft={draft} update={update} workspaceId={workspaceId} province={province} onPreview={onPreview} />
        </>
    );
}

function InstallmentsCard({ list, overridden, onChange, onReset }: {
    list: InstallmentDto[];
    overridden: boolean;
    onChange: (list: InstallmentDto[]) => void;
    onReset: () => void;
}) {
    const total = installmentsTotal(list);
    const ok = installmentsValid(list);
    const set = (i: number, patch: Partial<InstallmentDto>) => onChange(list.map((x, k) => (k === i ? { ...x, ...patch } : x)));
    return (
        <Card title="งวดจ่ายที่เสนอ" extra={overridden ? <Button size="small" type="link" onClick={onReset}>ใช้ค่าเริ่มต้น</Button> : undefined}>
            <div className="flex flex-col gap-2">
                {list.map((it, i) => (
                    <div key={it.no} className="flex flex-wrap md:flex-nowrap items-center gap-2">
                        <span className="w-14 text-gray-600">งวด {it.no}</span>
                        <InputNumber<number> className="!w-28" min={0} max={100} step={5} suffix="%" aria-label={`งวด ${String(it.no)} ร้อยละ`}
                            value={Math.round(it.pct * 10000) / 100} onChange={v => set(i, { pct: (v ?? 0) / 100 })} />
                        <Input className="md:flex-1 min-w-[200px]" maxLength={300} placeholder="เงื่อนไขส่งมอบ เช่น เทฐานรากครบ"
                            status={it.condition.trim() === '' ? 'error' : undefined} value={it.condition}
                            onChange={e => set(i, { condition: e.target.value })} />
                        <Button type="text" aria-label="ลบงวด" icon={<DeleteOutlined />} disabled={list.length <= 1}
                            onClick={() => onChange(renumber(list.filter((_x, k) => k !== i)))} />
                    </div>
                ))}
                <div className="flex items-center gap-3">
                    <Button size="small" icon={<PlusOutlined />} disabled={list.length >= 60}
                        onClick={() => onChange(renumber([...list, { no: list.length + 1, pct: Math.max(0, 1 - total), condition: '' }]))}>
                        เพิ่มงวด
                    </Button>
                    <span className={`text-secondary tabular-nums ${ok ? 'text-gray-500' : 'text-red-600'}`}>
                        รวม {pct(total)}{Math.abs(total - 1) > 0.0001 ? ' ต้องรวมได้ 100%' : ''}
                    </span>
                </div>
            </div>
        </Card>
    );
}

function InviteesCard({ draft, update, workspaceId, province, onPreview }: {
    draft: Draft;
    update: (patch: Partial<Draft>) => void;
    workspaceId: string;
    province: string;
    onPreview: () => void;
}) {
    const { message } = App.useApp();
    const [allTrades, setAllTrades] = useState(false);
    const vendors = useVendorList(workspaceId, allTrades ? { hidden: false } : { trade: draft.trade, hidden: false });
    const list = sortVendors(vendors.data ?? [], province);
    const chosen = new Map(draft.invitees.map(i => [i.entryId, i]));
    const problem = inviteeProblem(draft.sourcingMode, draft.invitees.length);
    const full = draft.sourcingMode === 'rfq' && draft.invitees.length >= MAX_RFQ;

    const setMode = (mode: DirectOrRfq) => update({ sourcingMode: mode, invitees: mode === 'direct' ? draft.invitees.slice(0, 1) : draft.invitees });
    const setChannel = (entryId: string, channel: InviteChannel) =>
        update({ invitees: draft.invitees.map(i => (i.entryId === entryId ? { ...i, channel } : i)) });

    const columns = [
        {
            title: 'ทีมช่าง', key: 'name',
            render: (_: unknown, v: VendorListEntryDto) => (
                <div className="min-w-0">
                    <div className="font-medium text-gray-900">
                        {v.displayName}
                        {v.hasAccount && <CheckOutlined className="!ml-1.5 text-green-600" aria-label="มีบัญชีแล้ว" />}
                    </div>
                    <div className="text-caption text-gray-500">{formatThaiPhone(v.phone)}{v.province !== '' ? ` · ${v.province}` : ''}</div>
                </div>
            ),
        },
        {
            title: 'งานกับเราล่าสุด', key: 'last', width: 140, responsive: ['md' as const],
            render: (_: unknown, v: VendorListEntryDto) => (v.lastEngagedAt === null
                ? <span className="text-gray-400">–</span>
                : <span className="tabular-nums">{fmtDay(toDay(new Date(v.lastEngagedAt)))}</span>),
        },
        {
            title: 'คะแนนจากเรา', key: 'rating', width: 110, align: 'right' as const, responsive: ['md' as const],
            render: (_: unknown, v: VendorListEntryDto) => (v.ratingFromUs === null
                ? <span className="text-gray-400">–</span>
                : <span className="tabular-nums">{v.ratingFromUs.toFixed(1)}</span>),
        },
        {
            title: 'ช่องทางส่ง', key: 'channel', width: 190,
            render: (_: unknown, v: VendorListEntryDto) => {
                const inv = chosen.get(v.id);
                if (inv === undefined) return null;
                const options = (['link', 'sms', 'line'] as const)
                    .filter(c => c !== 'line' || v.lineId !== '')
                    .map(c => ({ value: c, label: CHANNEL_LABEL[c] }));
                return <Select<InviteChannel> size="small" className="w-full" value={inv.channel} options={options}
                    aria-label={`ช่องทางส่งถึง ${v.displayName}`} onChange={c => setChannel(v.id, c)} />;
            },
        },
    ];

    return (
        <Card title="ผู้รับคำเชิญ" extra={<Button size="small" icon={<EyeOutlined />} onClick={onPreview}>ดูหน้าที่ผู้รับเห็น</Button>}>
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <Segmented<DirectOrRfq> value={draft.sourcingMode} onChange={setMode}
                        options={[{ value: 'rfq', label: `ขอราคาเทียบ (2–${String(MAX_RFQ)} ราย)` }, { value: 'direct', label: 'จ้างตรง (1 ราย)' }]} />
                    <label className="flex items-center gap-2 text-secondary text-gray-600 cursor-pointer md:ml-auto">
                        <Switch size="small" checked={allTrades} onChange={setAllTrades} />
                        แสดงทีมช่างทุกประเภทงาน
                    </label>
                </div>
                <Table<VendorListEntryDto> rowKey="id" size="small" pagination={false} columns={columns} dataSource={list}
                    loading={vendors.isLoading} scroll={{ x: 520 }}
                    rowSelection={{
                        type: draft.sourcingMode === 'direct' ? 'radio' : 'checkbox',
                        selectedRowKeys: draft.invitees.map(i => i.entryId),
                        hideSelectAll: true,
                        getCheckboxProps: v => ({ disabled: full && !chosen.has(v.id), 'aria-label': v.displayName }),
                        onSelect: (v, on) => update({ invitees: toggleInvitee(draft.invitees, v.id, on, draft.sourcingMode) }),
                    }}
                    locale={{
                        emptyText: vendors.isError
                            ? thaiErrorMessage(vendors.error)
                            : allTrades ? 'ทะเบียนทีมช่างยังว่าง เพิ่มรายใหม่ด้านล่าง' : 'ยังไม่มีทีมช่างประเภทงานนี้ในทะเบียน เพิ่มรายใหม่ด้านล่าง',
                    }} />
                <QuickAddVendor workspaceId={workspaceId} draft={draft} province={province}
                    onAdded={entry => {
                        update({ invitees: toggleInvitee(draft.invitees, entry.id, true, draft.sourcingMode) });
                        void message.success(`เพิ่ม ${entry.displayName} แล้ว`);
                    }} />
                {draft.invitees.length > 0 && problem !== null && <div className="text-secondary text-amber-600">{problem}</div>}
            </div>
        </Card>
    );
}

/** "เพิ่มรายใหม่" inline: name + phone, saved to the vendor list with this package's trade. */
function QuickAddVendor({ workspaceId, draft, province, onAdded }: {
    workspaceId: string;
    draft: Draft;
    province: string;
    onAdded: (entry: VendorListEntryDto) => void;
}) {
    const { message } = App.useApp();
    const create = useCreateVendor(workspaceId);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [tried, setTried] = useState(false);
    const phoneOk = phoneSchema.safeParse(phone).success;
    const nameOk = name.trim() !== '';

    const add = () => {
        setTried(true);
        if (!nameOk || !phoneOk) return;
        create.mutate({ displayName: name.trim(), phone, lineId: '', trades: [draft.trade], province, privateNote: '' }, {
            onSuccess: (entry) => {
                setName('');
                setPhone('');
                setTried(false);
                onAdded(entry);
            },
            onError: (e) => {
                void message.error(isApiError(e) && e.status === 409 ? 'เบอร์นี้อยู่ในทะเบียนแล้ว เลือกจากรายการด้านบน' : thaiErrorMessage(e));
            },
        });
    };

    return (
        <div className="flex flex-wrap items-start gap-2">
            <Input className="!w-56" placeholder="ชื่อทีมช่าง" maxLength={120} value={name} aria-label="ชื่อทีมช่างใหม่"
                status={tried && !nameOk ? 'error' : undefined} onChange={e => setName(e.target.value)} />
            <div className="flex flex-col">
                <Input className="!w-44" placeholder="เบอร์โทร" inputMode="tel" maxLength={20} value={phone} aria-label="เบอร์โทรทีมช่างใหม่"
                    status={tried && !phoneOk ? 'error' : undefined} onChange={e => setPhone(e.target.value)} onPressEnter={add} />
                {tried && !phoneOk && <span className="text-caption text-red-600 mt-0.5">เบอร์โทรไม่ถูกต้อง</span>}
            </div>
            <Button icon={<PlusOutlined />} loading={create.isPending} onClick={add}>เพิ่มรายใหม่</Button>
        </div>
    );
}
