'use client';

// ─── First crew profile (L0): team name, contact, trades. Created in the user's personal workspace. ───
import { useState } from 'react';
import { Alert, Button, Input, Tag } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TradeId } from '@/shared/contract';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { useSession } from '@/features/cloud/auth/session';
import { TRADES } from '@/domain/subcontracting/trades';
import { vendorApi, vk } from '../api';
import { useVendorWorkspaceStore } from '../workspace-store';

export function TradeChips({ value, onChange }: { value: readonly TradeId[]; onChange: (next: TradeId[]) => void }) {
    const toggle = (id: TradeId) => onChange(value.includes(id) ? value.filter(t => t !== id) : [...value, id]);
    return (
        <div className="flex flex-wrap gap-2">
            {TRADES.map(t => (
                <Tag.CheckableTag key={t.id} checked={value.includes(t.id)} onChange={() => toggle(t.id)}
                    className="!m-0 !px-3 !py-2 !text-[15px] !leading-snug border border-gray-200 rounded-control">
                    {t.label}
                </Tag.CheckableTag>
            ))}
        </div>
    );
}

export function CreateCrewProfile({ defaultTrade, defaultTeamName = '', onCreated, title = 'สร้างโปรไฟล์ทีมช่าง' }: {
    defaultTrade?: TradeId;
    defaultTeamName?: string;
    onCreated: (workspaceId: string) => void;
    title?: string;
}) {
    const qc = useQueryClient();
    const user = useSession(s => s.user);
    const select = useVendorWorkspaceStore(s => s.select);
    const [teamName, setTeamName] = useState(defaultTeamName);
    const [contactName, setContactName] = useState(user?.displayName ?? '');
    const [trades, setTrades] = useState<TradeId[]>(defaultTrade === undefined ? [] : [defaultTrade]);

    const create = useMutation({
        mutationFn: async () => {
            const me = await vendorApi.account();
            const ws = me.workspaces.find(w => w.kind === 'personal') ?? me.workspaces.find(w => w.role === 'owner');
            if (ws === undefined) throw new Error('no workspace');
            return vendorApi.putProfile({
                workspaceId: ws.id, teamName: teamName.trim(), contactName: contactName.trim(), trades,
                provinces: [], crewSkilled: null, crewLabourers: null, tools: [], vatRegistered: false,
                referenceRates: [], availableMonths: [],
            });
        },
        onSuccess: async (profile) => {
            select(profile.workspaceId);
            await qc.invalidateQueries({ queryKey: vk.me });
            onCreated(profile.workspaceId);
        },
    });

    const ok = teamName.trim() !== '' && contactName.trim() !== '' && trades.length > 0;
    return (
        <div className="flex flex-col gap-4">
            <div>
                <h2 className="m-0 text-card-title font-semibold">{title}</h2>
                <p className="m-0 mt-1 text-secondary text-gray-600">ผู้ว่าจ้างจะเห็นชื่อทีมนี้ตอนคุณเสนอราคา แก้ไขทีหลังได้</p>
            </div>
            {create.isError && <Alert type="error" showIcon title={thaiErrorMessage(create.error)} />}
            <label className="flex flex-col gap-1">
                <span className="text-secondary font-medium text-gray-700">ชื่อทีม / ชื่อร้าน</span>
                <Input value={teamName} onChange={e => setTeamName(e.target.value)} maxLength={120} placeholder="เช่น ทีมช่างสมชาย" autoComplete="organization" />
            </label>
            <label className="flex flex-col gap-1">
                <span className="text-secondary font-medium text-gray-700">ชื่อผู้ติดต่อ</span>
                <Input value={contactName} onChange={e => setContactName(e.target.value)} maxLength={80} autoComplete="name" />
            </label>
            <div className="flex flex-col gap-2">
                <span className="text-secondary font-medium text-gray-700">รับงานประเภทไหนบ้าง</span>
                <TradeChips value={trades} onChange={setTrades} />
            </div>
            <Button type="primary" size="large" block disabled={!ok} loading={create.isPending} onClick={() => create.mutate()}>สร้างโปรไฟล์</Button>
        </div>
    );
}
