'use client';

// ─── /vendor/profile: the crew profile buyers see (L0 → L1 "โปรไฟล์ครบ") and the portfolio ───
import { useState } from 'react';
import { Alert, App, Button, Image, Input, Select, Switch, Tag } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatThaiPhone, type FileDto, type PortfolioItemDto, type TradeId, type VendorProfileDto } from '@/shared/contract';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { useSession } from '@/features/cloud/auth/session';
import { TRADES, tradeLabel } from '@/domain/subcontracting/trades';
import { vendorApi, vk } from '../api';
import { parseAmount, parseCount } from '../bid-form';
import { formatMonth, locationText, nextMonths } from '../format';
import { useProfile, useVendorWorkspace } from '../hooks';
import { useNow } from '../now';
import { TOOL_SUGGESTIONS, profileMissing } from '../profile-rules';
import { THAI_PROVINCES } from '../provinces';
import { BottomBar, ErrorState, PageSpinner, Section, Sheet, SignInPrompt } from '../ui/common';
import { CreateCrewProfile, TradeChips } from '../ui/CreateCrewProfile';
import { PhotoPicker } from '../ui/PhotoPicker';

const PROVINCE_OPTIONS = THAI_PROVINCES.map(p => ({ value: p, label: p }));
const TRADE_OPTIONS = TRADES.map(t => ({ value: t.id, label: t.label }));
const TOOL_OPTIONS = TOOL_SUGGESTIONS.map(t => ({ value: t, label: t }));

interface RateRow { trade: TradeId; label: string; unit: string; rate: string }

function Label({ children }: { children: React.ReactNode }) {
    return <span className="text-secondary font-medium text-gray-700">{children}</span>;
}

function Completeness({ profile }: { profile: VendorProfileDto }) {
    const missing = profileMissing(profile);
    if (profile.profileComplete) {
        return (
            <Section tone="success">
                <div className="text-section font-medium text-green-700">โปรไฟล์ครบ</div>
                <div className="text-secondary text-gray-600">ผู้ว่าจ้างเห็นป้ายนี้ในทะเบียนทีมช่าง</div>
            </Section>
        );
    }
    return (
        <Section>
            <div className="text-section font-medium text-gray-800">อีกนิดจะได้ป้าย &quot;โปรไฟล์ครบ&quot;</div>
            <div className="text-secondary text-gray-600">ยังขาด: {missing.length === 0 ? 'รอระบบอัปเดต' : missing.join(' · ')}</div>
        </Section>
    );
}

function ProfileForm({ profile }: { profile: VendorProfileDto }) {
    const qc = useQueryClient();
    const { message } = App.useApp();
    const now = useNow(24 * 3600_000);
    const [teamName, setTeamName] = useState(profile.teamName);
    const [contactName, setContactName] = useState(profile.contactName);
    const [trades, setTrades] = useState<TradeId[]>(profile.trades);
    const [provinces, setProvinces] = useState<string[]>(profile.provinces);
    const [crewSkilled, setCrewSkilled] = useState(profile.crewSkilled === null ? '' : String(profile.crewSkilled));
    const [crewLabourers, setCrewLabourers] = useState(profile.crewLabourers === null ? '' : String(profile.crewLabourers));
    const [tools, setTools] = useState<string[]>(profile.tools);
    const [vat, setVat] = useState(profile.vatRegistered);
    const [rates, setRates] = useState<RateRow[]>(profile.referenceRates.map(r => ({ ...r, rate: String(r.rate) })));
    const [months, setMonths] = useState<string[]>(profile.availableMonths);

    const save = useMutation({
        mutationFn: () => vendorApi.putProfile({
            workspaceId: profile.workspaceId,
            teamName: teamName.trim(), contactName: contactName.trim(), trades, provinces,
            crewSkilled: parseCount(crewSkilled), crewLabourers: parseCount(crewLabourers),
            tools: tools.map(t => t.trim()).filter(t => t !== '').slice(0, 40), vatRegistered: vat,
            referenceRates: rates
                .filter(r => r.label.trim() !== '' && r.unit.trim() !== '' && parseAmount(r.rate) !== null)
                .map(r => ({ trade: r.trade, label: r.label.trim(), unit: r.unit.trim(), rate: parseAmount(r.rate) ?? 0 })),
            availableMonths: months,
        }),
        onSuccess: (p) => {
            qc.setQueryData(vk.profile(p.workspaceId), p);
            void qc.invalidateQueries({ queryKey: vk.me });
            void message.success('บันทึกโปรไฟล์แล้ว');
        },
        onError: (e) => { void message.error(thaiErrorMessage(e)); },
    });

    const monthChoices = now === 0 ? [] : nextMonths(new Date(now), 12);
    const setRate = (k: number, patch: Partial<RateRow>) => setRates(rs => rs.map((r, i) => (i === k ? { ...r, ...patch } : r)));
    const ok = teamName.trim() !== '' && contactName.trim() !== '' && trades.length > 0;

    return (
        <>
            <Section title="ข้อมูลทีม">
                <div className="flex flex-col gap-4">
                    <label className="flex flex-col gap-1"><Label>ชื่อทีม / ชื่อร้าน</Label>
                        <Input value={teamName} onChange={e => setTeamName(e.target.value)} maxLength={120} /></label>
                    <label className="flex flex-col gap-1"><Label>ชื่อผู้ติดต่อ</Label>
                        <Input value={contactName} onChange={e => setContactName(e.target.value)} maxLength={80} /></label>
                    <div className="flex flex-col gap-1"><Label>เบอร์โทร</Label>
                        <span className="text-body text-gray-900">{profile.phone === '' ? '-' : formatThaiPhone(profile.phone)} <span className="text-caption text-green-700">ยืนยันแล้ว</span></span></div>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1"><Label>ช่าง</Label>
                            <Input value={crewSkilled} onChange={e => setCrewSkilled(e.target.value.replace(/\D/g, ''))} inputMode="numeric" suffix="คน" /></label>
                        <label className="flex flex-col gap-1"><Label>คนงาน</Label>
                            <Input value={crewLabourers} onChange={e => setCrewLabourers(e.target.value.replace(/\D/g, ''))} inputMode="numeric" suffix="คน" /></label>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <Label>จดทะเบียนภาษีมูลค่าเพิ่ม (VAT)</Label>
                        <Switch checked={vat} onChange={setVat} aria-label="จดทะเบียน VAT" />
                    </div>
                </div>
            </Section>

            <Section title="รับงานประเภทไหนบ้าง"><TradeChips value={trades} onChange={setTrades} /></Section>

            <Section title="จังหวัดที่รับงาน">
                <Select mode="multiple" className="w-full" value={provinces} onChange={setProvinces} options={PROVINCE_OPTIONS}
                    placeholder="เลือกจังหวัด" showSearch={{ optionFilterProp: 'label' }} maxCount={77} aria-label="จังหวัดที่รับงาน" />
            </Section>

            <Section title="เครื่องมือหลัก">
                <Select mode="tags" className="w-full" value={tools} onChange={setTools} options={TOOL_OPTIONS} placeholder="เลือกหรือพิมพ์เพิ่ม" aria-label="เครื่องมือหลัก" />
            </Section>

            <Section title="ค่าแรงอ้างอิง" extra={<Button icon={<PlusOutlined />} onClick={() => setRates(rs => [...rs, { trade: trades[0] ?? 'masonry', label: '', unit: '', rate: '' }])}>เพิ่ม</Button>}>
                {rates.length === 0 ? (
                    <div className="text-secondary text-gray-500">ไม่บังคับ ใส่ไว้เป็นราคาตั้งต้นของคุณ เช่น ก่ออิฐ 120 บาท/ตร.ม.</div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {rates.map((r, k) => (
                            <div key={k} className="flex flex-col gap-2 border-b border-gray-100 pb-3 last:border-b-0">
                                <div className="flex gap-2">
                                    <Select className="flex-1 min-w-0" value={r.trade} onChange={(v: TradeId) => setRate(k, { trade: v })} options={TRADE_OPTIONS} aria-label="ประเภทงาน" />
                                    <Button type="text" aria-label="ลบ" icon={<DeleteOutlined />} onClick={() => setRates(rs => rs.filter((_r, i) => i !== k))} />
                                </div>
                                <Input value={r.label} onChange={e => setRate(k, { label: e.target.value })} maxLength={120} placeholder="งาน เช่น ก่ออิฐมอญครึ่งแผ่น" />
                                <div className="grid grid-cols-2 gap-2">
                                    <Input value={r.rate} onChange={e => setRate(k, { rate: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" suffix="บาท" placeholder="ราคา" />
                                    <Input value={r.unit} onChange={e => setRate(k, { unit: e.target.value })} maxLength={20} placeholder="ต่อหน่วย เช่น ตร.ม." />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            {monthChoices.length > 0 && (
                <Section title="เดือนที่ว่างรับงาน">
                    <div className="grid grid-cols-4 gap-2">
                        {monthChoices.map(m => (
                            <Tag.CheckableTag key={m} checked={months.includes(m)}
                                onChange={c => setMonths(ms => (c ? [...ms, m].sort() : ms.filter(x => x !== m)))}
                                className="!m-0 !py-2 text-center border border-gray-200 rounded-control !text-[14px]">
                                {formatMonth(m)}
                            </Tag.CheckableTag>
                        ))}
                    </div>
                </Section>
            )}

            <BottomBar>
                <Button type="primary" size="large" block disabled={!ok} loading={save.isPending} onClick={() => save.mutate()}>บันทึกโปรไฟล์</Button>
            </BottomBar>
        </>
    );
}

function PortfolioForm({ workspaceId, defaultTrade, onDone }: { workspaceId: string; defaultTrade: TradeId; onDone: () => void }) {
    const qc = useQueryClient();
    const { message } = App.useApp();
    const [title, setTitle] = useState('');
    const [trade, setTrade] = useState<TradeId>(defaultTrade);
    const [year, setYear] = useState('');
    const [district, setDistrict] = useState('');
    const [province, setProvince] = useState<string | undefined>(undefined);
    const [note, setNote] = useState('');
    const [photos, setPhotos] = useState<FileDto[]>([]);
    const add = useMutation({
        mutationFn: () => {
            const y = parseCount(year);
            return vendorApi.addPortfolio(workspaceId, {
                title: title.trim(), trade, year: y !== null && y >= 1950 && y <= 2100 ? y : null,
                district: district.trim(), province: province ?? '', photoFileIds: photos.map(p => p.id), note: note.trim(),
            });
        },
        onSuccess: async () => {
            void message.success('เพิ่มผลงานแล้ว');
            await qc.invalidateQueries({ queryKey: vk.profile(workspaceId) });
            onDone();
        },
        onError: (e) => { void message.error(thaiErrorMessage(e)); },
    });
    return (
        <div className="flex flex-col gap-3">
            <PhotoPicker photos={photos} max={10} purpose="portfolio_photo" label="เพิ่มรูปผลงาน"
                onAdd={f => setPhotos(p => (p.some(x => x.id === f.id) ? p : [...p, f]))} onRemove={id => setPhotos(p => p.filter(x => x.id !== id))} />
            <label className="flex flex-col gap-1"><Label>ชื่องาน</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} maxLength={160} placeholder="เช่น บ้าน 2 ชั้น คุณสมศรี" /></label>
            <label className="flex flex-col gap-1"><Label>ประเภทงาน</Label>
                <Select value={trade} onChange={(v: TradeId) => setTrade(v)} options={TRADE_OPTIONS} /></label>
            <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1"><Label>ปี (ค.ศ.)</Label>
                    <Input value={year} onChange={e => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="2025" /></label>
                <label className="flex flex-col gap-1"><Label>อำเภอ</Label>
                    <Input value={district} onChange={e => setDistrict(e.target.value)} maxLength={80} /></label>
            </div>
            <label className="flex flex-col gap-1"><Label>จังหวัด</Label>
                <Select value={province} onChange={(v: string) => setProvince(v)} options={PROVINCE_OPTIONS} showSearch={{ optionFilterProp: 'label' }} allowClear placeholder="เลือกจังหวัด" /></label>
            <Input.TextArea value={note} onChange={e => setNote(e.target.value)} autoSize={{ minRows: 2, maxRows: 5 }} maxLength={1000} placeholder="รายละเอียดสั้น ๆ (ไม่บังคับ)" />
            <Button type="primary" size="large" block disabled={title.trim() === '' || photos.length === 0} loading={add.isPending} onClick={() => add.mutate()}>บันทึกผลงาน</Button>
        </div>
    );
}

function Portfolio({ profile }: { profile: VendorProfileDto }) {
    const qc = useQueryClient();
    const { message, modal } = App.useApp();
    const [open, setOpen] = useState(false);
    const remove = useMutation({
        mutationFn: (id: string) => vendorApi.deletePortfolio(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: vk.profile(profile.workspaceId) }),
        onError: (e) => { void message.error(thaiErrorMessage(e)); },
    });
    const confirmRemove = (item: PortfolioItemDto) => {
        modal.confirm({ title: `ลบผลงาน "${item.title}"?`, okText: 'ลบ', okButtonProps: { danger: true }, cancelText: 'ไม่ลบ', onOk: () => remove.mutateAsync(item.id) });
    };
    return (
        <Section title="ผลงาน" extra={<Button icon={<PlusOutlined />} onClick={() => setOpen(true)}>เพิ่ม</Button>}>
            {profile.portfolio.length === 0 ? (
                <div className="text-secondary text-gray-500">ใส่ผลงานที่เคยทำอย่างน้อย 3 งาน พร้อมรูป ผู้ว่าจ้างจะตัดสินใจง่ายขึ้น</div>
            ) : (
                <div className="flex flex-col gap-3">
                    {profile.portfolio.map(item => (
                        <div key={item.id} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="text-body font-medium text-gray-900">{item.title}</div>
                                    <div className="text-caption text-gray-600">
                                        {[tradeLabel(item.trade), item.year === null ? '' : String(item.year), locationText(item)].filter(s => s !== '').join(' · ')}
                                    </div>
                                </div>
                                <Button type="text" aria-label="ลบผลงาน" icon={<DeleteOutlined />} onClick={() => confirmRemove(item)} />
                            </div>
                            {item.photos.length > 0 && (
                                <Image.PreviewGroup>
                                    <div className="mt-2 grid grid-cols-4 gap-1.5">
                                        {item.photos.slice(0, 8).map(p => (
                                            <Image key={p.id} src={p.url} alt={p.name} width="100%" height={72} style={{ objectFit: 'cover', borderRadius: 6 }} />
                                        ))}
                                    </div>
                                </Image.PreviewGroup>
                            )}
                        </div>
                    ))}
                </div>
            )}
            <Sheet open={open} onClose={() => setOpen(false)} title="เพิ่มผลงาน">
                <PortfolioForm workspaceId={profile.workspaceId} defaultTrade={profile.trades[0] ?? 'masonry'} onDone={() => setOpen(false)} />
            </Sheet>
        </Section>
    );
}

export function ProfilePage() {
    const status = useSession(s => s.status);
    const ws = useVendorWorkspace();
    const profile = useProfile(ws.current?.workspaceId);
    if (status === 'unknown') return <PageSpinner />;
    if (status === 'guest') return <SignInPrompt next="/vendor/profile" />;
    if (ws.error !== null) return <ErrorState error={ws.error} />;
    if (ws.none) return <Section><CreateCrewProfile onCreated={() => undefined} /></Section>;
    if (ws.current === undefined || profile.isPending) return <PageSpinner />;
    if (profile.isError) return <ErrorState error={profile.error} onRetry={() => { void profile.refetch(); }} />;
    if (profile.data === null) {
        return (
            <div className="flex flex-col gap-3">
                <Alert type="info" showIcon title="ทีมนี้ยังไม่มีโปรไฟล์" />
                <Section><CreateCrewProfile defaultTeamName={ws.current.teamName} onCreated={() => undefined} /></Section>
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-3">
            <h1 className="m-0 text-page-title font-semibold">โปรไฟล์ทีม</h1>
            <Completeness profile={profile.data} />
            <ProfileForm key={profile.data.workspaceId} profile={profile.data} />
            <Portfolio profile={profile.data} />
        </div>
    );
}
