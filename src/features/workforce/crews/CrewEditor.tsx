'use client';

// ─── Add / edit a crew: a short "quick add" dialog (no names needed) and the full drawer (leader, members, note) ───
// Both share the same fields and the live daily-cost preview; the quick dialog can open the full drawer with what was
// typed so far.
import { App, Button, Drawer, Form, Input, InputNumber, Modal, Radio, Select, type FormInstance, type SelectProps } from 'antd';
import {
    MAX_CREW_HEADCOUNT, WORKFORCE_TRADE_LABEL, type CrewDto, type PersonDto, type RateCardDto,
} from '@/shared/contract';
import { useCreateCrew, useUpdateCrew, workforceConflict } from '@/features/cloud/api/workforce';
import {
    EMPTY_CREW_FORM, crewCostPreview, crewFormToRequest, crewToForm, crewUpdate, peopleForTrade, personLabel,
    type CrewFormValues,
} from './logic';
import { RULES, TRADE_OPTIONS, baht, bahtFormatter, bahtParser, rateCardLabel, writeErrorMessage } from './shared';

/** What the editor is open for: nothing, a quick add, or the full form (new with values carried over, or a crew). */
export type CrewEditorTarget =
    | { mode: 'closed' }
    | { mode: 'quick'; initial: CrewFormValues }
    | { mode: 'full'; initial: CrewFormValues; crew: CrewDto | undefined };

export const closedEditor: CrewEditorTarget = { mode: 'closed' };

/** A new crew's starting values: the oldest company card (normally A) as its rate. */
export function newCrewValues(cards: readonly RateCardDto[]): CrewFormValues {
    return { ...EMPTY_CREW_FORM, rateCardId: cards[0]?.id };
}

export function editCrewTarget(crew: CrewDto): CrewEditorTarget {
    return { mode: 'full', initial: crewToForm(crew), crew };
}

interface Props {
    workspaceId: string;
    target: CrewEditorTarget;
    /** Bumped by the caller on every open, so each open starts a fresh form (antd keeps a form's values otherwise). */
    seq: number;
    people: readonly PersonDto[];
    rateCards: readonly RateCardDto[];
    onChange: (next: CrewEditorTarget) => void;
}

export function CrewEditor({ workspaceId, target, seq, people, rateCards, onChange }: Props) {
    const close = () => onChange(closedEditor);
    return (
        <>
            <QuickCrewModal key={`quick-${String(seq)}`} workspaceId={workspaceId}
                open={target.mode === 'quick'} initial={target.mode === 'quick' ? target.initial : EMPTY_CREW_FORM}
                rateCards={rateCards} onClose={close}
                onExpand={values => onChange({ mode: 'full', initial: values, crew: undefined })} />
            <CrewDrawer key={`full-${String(seq)}`}workspaceId={workspaceId}
                open={target.mode === 'full'} initial={target.mode === 'full' ? target.initial : EMPTY_CREW_FORM}
                crew={target.mode === 'full' ? target.crew : undefined} people={people} rateCards={rateCards} onClose={close} />
        </>
    );
}

/** Saves the form as a new crew or as changes to `crew`; resolves true when saved. */
function useSaveCrew(workspaceId: string, form: FormInstance<CrewFormValues>, crew: CrewDto | undefined) {
    const { message } = App.useApp();
    const create = useCreateCrew(workspaceId);
    const update = useUpdateCrew(workspaceId);
    const save = async (): Promise<boolean> => {
        let values: CrewFormValues;
        try {
            values = await form.validateFields();
        } catch {
            return false;
        }
        // validateFields returns only the mounted fields; merge them over everything the form holds.
        const req = crewFormToRequest({ ...EMPTY_CREW_FORM, ...(form.getFieldsValue(true) as Partial<CrewFormValues>), ...values });
        if (req === undefined) return false;
        try {
            if (crew === undefined) {
                const saved = await create.mutateAsync(req);
                void message.success(`เพิ่ม "${saved.name}" แล้ว`);
            } else {
                await update.mutateAsync({ crewId: crew.id, ...crewUpdate(req, crew.wagesHidden) });
                void message.success('บันทึกแล้ว');
            }
            return true;
        } catch (e) {
            const conflict = workforceConflict(e);
            if (conflict?.reason === 'name_taken') form.setFields([{ name: 'name', errors: [writeErrorMessage(e)] }]);
            else void message.error(writeErrorMessage(e));
            return false;
        }
    };
    return { save, saving: create.isPending || update.isPending };
}

function QuickCrewModal({ workspaceId, open, initial, rateCards, onClose, onExpand }: {
    workspaceId: string; open: boolean; initial: CrewFormValues; rateCards: readonly RateCardDto[];
    onClose: () => void; onExpand: (values: CrewFormValues) => void;
}) {
    const [form] = Form.useForm<CrewFormValues>();
    const { save, saving } = useSaveCrew(workspaceId, form, undefined);
    return (
        <Modal open={open} onCancel={onClose} destroyOnHidden title="เพิ่มทีม" okText="เพิ่มทีม" cancelText="ยกเลิก"
            confirmLoading={saving} width={520}
            onOk={() => { void save().then(ok => { if (ok) onClose(); }); }}>
            <p className="text-[13px] text-gray-600 mb-4">ไม่ต้องกรอกรายคน กรอกแค่ชื่อทีม สายงาน และจำนวนคนก็พอ</p>
            <Form form={form} layout="vertical" initialValues={initial}
                onFinish={() => { void save().then(ok => { if (ok) onClose(); }); }}>
                <CoreFields form={form} rateCards={rateCards} showRates />
            </Form>
            <Button type="link" className="!px-0" onClick={() => onExpand({ ...initial, ...(form.getFieldsValue(true) as Partial<CrewFormValues>) })}>
                ระบุหัวหน้าทีมและรายชื่อสมาชิก
            </Button>
        </Modal>
    );
}

function CrewDrawer({ workspaceId, open, initial, crew, people, rateCards, onClose }: {
    workspaceId: string; open: boolean; initial: CrewFormValues; crew: CrewDto | undefined;
    people: readonly PersonDto[]; rateCards: readonly RateCardDto[]; onClose: () => void;
}) {
    const [form] = Form.useForm<CrewFormValues>();
    const { save, saving } = useSaveCrew(workspaceId, form, crew);
    const trade = Form.useWatch('trade', form);
    const groups = peopleForTrade(people, trade);
    const toOption = (p: PersonDto) => ({ value: p.id, label: personLabel(p) });
    const options: SelectProps['options'] = groups.inTrade.length === 0
        ? groups.others.map(toOption)
        : [
            { label: trade === undefined ? 'สายงานนี้' : `สาย${WORKFORCE_TRADE_LABEL[trade]}`, options: groups.inTrade.map(toOption) },
            { label: 'สายงานอื่น', options: groups.others.map(toOption) },
        ];
    const noPeople = <span className="text-[13px] text-gray-500">ยังไม่มีบุคลากร เพิ่มได้ที่แท็บบุคลากร</span>;
    const submit = () => { void save().then(ok => { if (ok) onClose(); }); };

    return (
        <Drawer open={open} onClose={onClose} destroyOnHidden size="min(520px, 100vw)"
            title={crew === undefined ? 'เพิ่มทีม' : `แก้ไข ${crew.name}`}
            footer={(
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>ยกเลิก</Button>
                    <Button type="primary" loading={saving} onClick={submit}>{crew === undefined ? 'เพิ่มทีม' : 'บันทึก'}</Button>
                </div>
            )}>
            <Form form={form} layout="vertical" initialValues={initial} onFinish={submit}>
                <CoreFields form={form} rateCards={rateCards} showRates={crew?.wagesHidden !== true} />
                <Form.Item name="leaderId" label="หัวหน้าทีม">
                    <Select allowClear showSearch={{ optionFilterProp: 'label' }} placeholder="เลือกจากบุคลากร" options={options}
                        notFoundContent={noPeople} />
                </Form.Item>
                <Form.Item name="memberIds" label="สมาชิก" extra={trade === undefined ? undefined : 'คนในสายงานนี้ขึ้นก่อน'}>
                    <Select mode="multiple" allowClear showSearch={{ optionFilterProp: 'label' }} placeholder="ไม่ระบุก็ได้"
                        options={options} notFoundContent={noPeople} maxTagCount="responsive" />
                </Form.Item>
                <Form.Item name="note" label="หมายเหตุ" rules={RULES.note}>
                    <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} />
                </Form.Item>
            </Form>
        </Drawer>
    );
}

/** Name, trade, counts and the rate (with its live preview): everything a quick add needs. */
function CoreFields({ form, rateCards, showRates }: { form: FormInstance<CrewFormValues>; rateCards: readonly RateCardDto[]; showRates: boolean }) {
    const skilledCount = Form.useWatch('skilledCount', form);
    const labourerCount = Form.useWatch('labourerCount', form);
    const source = Form.useWatch('rateSource', form);
    const rateCardId = Form.useWatch('rateCardId', form);
    const lumpSum = Form.useWatch('lumpSum', form);
    const preview = crewCostPreview({
        skilledCount, labourerCount, source: source === 'lump' ? 'lump' : 'card',
        card: rateCards.find(c => c.id === rateCardId), lumpSum,
    });

    return (
        <>
            <Form.Item name="name" label="ชื่อทีม" rules={RULES.crewName}>
                <Input placeholder="เช่น ทีมก่อฉาบช่างแดง" autoFocus />
            </Form.Item>
            <Form.Item name="trade" label="สายงาน" rules={RULES.trade}>
                <Select showSearch={{ optionFilterProp: 'label' }} placeholder="เลือกสายงาน" options={TRADE_OPTIONS} />
            </Form.Item>
            <div className="grid grid-cols-2 gap-3">
                <Form.Item name="skilledCount" label="ช่าง (คน)">
                    <InputNumber min={0} max={MAX_CREW_HEADCOUNT} precision={0} className="!w-full" />
                </Form.Item>
                <Form.Item name="labourerCount" label="คนงาน (คน)">
                    <InputNumber min={0} max={MAX_CREW_HEADCOUNT} precision={0} className="!w-full" />
                </Form.Item>
            </div>
            {showRates && (
                <>
                    <Form.Item name="rateSource" label="ค่าแรงทีม">
                        <Radio.Group optionType="button" options={[
                            { value: 'card', label: 'ชุดค่าแรงของบริษัท' },
                            { value: 'lump', label: 'เหมาต่อวัน' },
                        ]} />
                    </Form.Item>
                    {source === 'lump'
                        ? (
                            <Form.Item name="lumpSum" rules={RULES.wage} className="!-mt-2">
                                <InputNumber<number> min={0} precision={0} className="!w-full" suffix="บาท/วัน" placeholder="เช่น 3,500"
                                    formatter={bahtFormatter} parser={bahtParser} aria-label="ค่าแรงเหมาต่อวัน" />
                            </Form.Item>
                        )
                        : (
                            <Form.Item name="rateCardId" className="!-mt-2">
                                <Select allowClear placeholder="เลือกชุดค่าแรง" aria-label="ชุดค่าแรงของบริษัท"
                                    options={rateCards.map(c => ({ value: c.id, label: rateCardLabel(c) }))}
                                    notFoundContent={<span className="text-[13px] text-gray-500">ยังไม่มีชุดค่าแรงของบริษัท</span>} />
                            </Form.Item>
                        )}
                    <div className="-mt-2 mb-4 text-[13px] tabular-nums" aria-live="polite">
                        {preview === undefined
                            ? <span className="text-gray-400">ค่าแรงทีมต่อวัน —</span>
                            : (
                                <>
                                    <span className="text-gray-600">ค่าแรงทีมต่อวัน </span>
                                    <span className="font-semibold text-gray-900">{baht(preview.total)} บาท</span>
                                    {preview.formula !== undefined && (
                                        <span className="text-gray-400">
                                            {` (ช่าง ${String(preview.formula.skilled)} × ${baht(preview.formula.skilledRate)}`}
                                            {` + คนงาน ${String(preview.formula.labourers)} × ${baht(preview.formula.labourerRate)})`}
                                        </span>
                                    )}
                                </>
                            )}
                    </div>
                </>
            )}
        </>
    );
}
