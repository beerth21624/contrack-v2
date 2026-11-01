'use client';

// ─── Add / edit a crew: a short "quick add" dialog (no names needed) and the full drawer (leader, members, note) ───
// Both share the same fields and the live daily-cost preview; the quick dialog can open the full drawer with what was
// typed so far.
import { useTranslations } from 'next-intl';
import { App, Button, Drawer, Form, Input, InputNumber, Modal, Radio, Select, type FormInstance, type SelectProps } from 'antd';
import {
    MAX_CREW_HEADCOUNT, type CrewDto, type PersonDto, type RateCardDto,
} from '@/shared/contract';
import { useCreateCrew, useUpdateCrew, workforceConflict } from '@/features/cloud/api/workforce';
import {
    EMPTY_CREW_FORM, crewCostPreview, crewFormToRequest, crewToForm, crewUpdate, peopleForTrade, personLabel,
    type CrewFormValues,
} from './logic';
import { tradeNameOf } from '../text';
import {
    baht, bahtFormatter, bahtParser, rateCardLabel, useWorkforceOptions, useWorkforceRules, useWriteErrorMessage,
} from './shared';

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
    const t = useTranslations('workforce');
    const writeErrorMessage = useWriteErrorMessage();
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
                void message.success(t('shared.addedNamed', { name: saved.name }));
            } else {
                await update.mutateAsync({ crewId: crew.id, ...crewUpdate(req, crew.wagesHidden) });
                void message.success(t('shared.saved'));
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
    const t = useTranslations('workforce');
    const tc = useTranslations('common');
    const [form] = Form.useForm<CrewFormValues>();
    const { save, saving } = useSaveCrew(workspaceId, form, undefined);
    return (
        <Modal open={open} onCancel={onClose} destroyOnHidden title={t('crews.editor.addTitle')} okText={t('crews.editor.addOk')} cancelText={tc('cancel')}
            confirmLoading={saving} width={520}
            onOk={() => { void save().then(ok => { if (ok) onClose(); }); }}>
            <p className="text-[13px] text-gray-600 mb-4">{t('crews.editor.quickHint')}</p>
            <Form form={form} layout="vertical" initialValues={initial}
                onFinish={() => { void save().then(ok => { if (ok) onClose(); }); }}>
                <CoreFields form={form} rateCards={rateCards} showRates />
            </Form>
            <Button type="link" className="!px-0" onClick={() => onExpand({ ...initial, ...(form.getFieldsValue(true) as Partial<CrewFormValues>) })}>
                {t('crews.editor.expand')}
            </Button>
        </Modal>
    );
}

function CrewDrawer({ workspaceId, open, initial, crew, people, rateCards, onClose }: {
    workspaceId: string; open: boolean; initial: CrewFormValues; crew: CrewDto | undefined;
    people: readonly PersonDto[]; rateCards: readonly RateCardDto[]; onClose: () => void;
}) {
    const t = useTranslations('workforce');
    const tc = useTranslations('common');
    const RULES = useWorkforceRules();
    const [form] = Form.useForm<CrewFormValues>();
    const { save, saving } = useSaveCrew(workspaceId, form, crew);
    const trade = Form.useWatch('trade', form);
    const groups = peopleForTrade(people, trade);
    const toOption = (p: PersonDto) => ({ value: p.id, label: personLabel(p) });
    const options: SelectProps['options'] = groups.inTrade.length === 0
        ? groups.others.map(toOption)
        : [
            { label: trade === undefined ? t('shared.tradeGroupThis') : t('crews.editor.groupTrade', { trade: tradeNameOf(t, trade) }), options: groups.inTrade.map(toOption) },
            { label: t('shared.tradeGroupOther'), options: groups.others.map(toOption) },
        ];
    const noPeople = <span className="text-[13px] text-gray-500">{t('crews.editor.noPeople')}</span>;
    const submit = () => { void save().then(ok => { if (ok) onClose(); }); };

    return (
        <Drawer open={open} onClose={onClose} destroyOnHidden size="min(520px, 100vw)"
            title={crew === undefined ? t('crews.editor.addTitle') : t('shared.editNamed', { name: crew.name })}
            footer={(
                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>{tc('cancel')}</Button>
                    <Button type="primary" loading={saving} onClick={submit}>{crew === undefined ? t('crews.editor.addOk') : tc('save')}</Button>
                </div>
            )}>
            <Form form={form} layout="vertical" initialValues={initial} onFinish={submit}>
                <CoreFields form={form} rateCards={rateCards} showRates={crew?.wagesHidden !== true} />
                <Form.Item name="leaderId" label={t('crews.editor.leader')}>
                    <Select allowClear showSearch={{ optionFilterProp: 'label' }} placeholder={t('crews.editor.leaderPlaceholder')} options={options}
                        notFoundContent={noPeople} />
                </Form.Item>
                <Form.Item name="memberIds" label={t('crews.editor.members')} extra={trade === undefined ? undefined : t('crews.editor.membersExtra')}>
                    <Select mode="multiple" allowClear showSearch={{ optionFilterProp: 'label' }} placeholder={t('crews.editor.membersPlaceholder')}
                        options={options} notFoundContent={noPeople} maxTagCount="responsive" />
                </Form.Item>
                <Form.Item name="note" label={t('crews.editor.note')} rules={RULES.note}>
                    <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} />
                </Form.Item>
            </Form>
        </Drawer>
    );
}

/** Name, trade, counts and the rate (with its live preview): everything a quick add needs. */
function CoreFields({ form, rateCards, showRates }: { form: FormInstance<CrewFormValues>; rateCards: readonly RateCardDto[]; showRates: boolean }) {
    const t = useTranslations('workforce');
    const options = useWorkforceOptions();
    const RULES = useWorkforceRules();
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
            <Form.Item name="name" label={t('crews.editor.name')} rules={RULES.crewName}>
                <Input placeholder={t('crews.editor.namePlaceholder')} autoFocus />
            </Form.Item>
            <Form.Item name="trade" label={t('crews.editor.trade')} rules={RULES.trade}>
                <Select showSearch={{ optionFilterProp: 'label' }} placeholder={t('crews.editor.tradePlaceholder')} options={options.trades} />
            </Form.Item>
            <div className="grid grid-cols-2 gap-3">
                <Form.Item name="skilledCount" label={t('crews.editor.skilled')}>
                    <InputNumber min={0} max={MAX_CREW_HEADCOUNT} precision={0} className="!w-full" />
                </Form.Item>
                <Form.Item name="labourerCount" label={t('crews.editor.labourers')}>
                    <InputNumber min={0} max={MAX_CREW_HEADCOUNT} precision={0} className="!w-full" />
                </Form.Item>
            </div>
            {showRates && (
                <>
                    <Form.Item name="rateSource" label={t('crews.editor.rateSource')}>
                        <Radio.Group optionType="button" options={[
                            { value: 'card', label: t('crews.editor.sourceCard') },
                            { value: 'lump', label: t('crews.editor.sourceLump') },
                        ]} />
                    </Form.Item>
                    {source === 'lump'
                        ? (
                            <Form.Item name="lumpSum" rules={RULES.wage} className="!-mt-2">
                                <InputNumber<number> min={0} precision={0} className="!w-full" suffix={t('crews.editor.lumpSuffix')} placeholder={t('crews.editor.lumpPlaceholder')}
                                    formatter={bahtFormatter} parser={bahtParser} aria-label={t('crews.editor.lumpAria')} />
                            </Form.Item>
                        )
                        : (
                            <Form.Item name="rateCardId" className="!-mt-2">
                                <Select allowClear placeholder={t('crews.editor.cardPlaceholder')} aria-label={t('crews.editor.sourceCard')}
                                    options={rateCards.map(c => ({ value: c.id, label: rateCardLabel(t, c) }))}
                                    notFoundContent={<span className="text-[13px] text-gray-500">{t('crews.editor.noCards')}</span>} />
                            </Form.Item>
                        )}
                    <div className="-mt-2 mb-4 text-[13px] tabular-nums" aria-live="polite">
                        {preview === undefined
                            ? <span className="text-gray-400">{t('crews.editor.costPerDay')} —</span>
                            : (
                                <>
                                    <span className="text-gray-600">{t('crews.editor.costPerDay')} </span>
                                    <span className="font-semibold text-gray-900">{t('shared.bahtAmount', { amount: baht(preview.total) })}</span>
                                    {preview.formula !== undefined && (
                                        <span className="text-gray-400">
                                            {' '}
                                            {t('crews.editor.formula', {
                                                skilled: String(preview.formula.skilled), skilledRate: baht(preview.formula.skilledRate),
                                                labourers: String(preview.formula.labourers), labourerRate: baht(preview.formula.labourerRate),
                                            })}
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
