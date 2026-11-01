'use client';

// Table shared by the "ท่อน้ำทิ้ง_Waste Pipe" and "ท่อน้ำดี_Water Pipe" pages (Excel sheets 05 / 06 have the same layout).
import type { CalculatorDef } from '@/domain/calculators/types';
import type { ProjectResult } from '@/domain/project';
import {
    runLength, sizeFromLabel, sizeMismatches, unlinkedRuns,
    type PipeBoqLine, type PipePlainLabel, type PipeRun, type PipeRunsInput,
} from '@/domain/calculators/waste-pipe/pipe-runs';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { PipeRunsJourney } from './PipeRunsJourney';
import { useTranslations } from 'next-intl';

const NO_DEPS = { outputs: () => undefined };

export function PipeRunsSheet({ def, input, onChange, result, subtitle, items, sizes, lines, plain, noun }: {
    def: CalculatorDef<PipeRunsInput>;
    input: PipeRunsInput;
    onChange: (runs: PipeRun[]) => void;
    result: ProjectResult;
    subtitle: string;
    /** Excel dropdown lists of B (รายการ) and C (ขนาดท่อ/ชนิด). */
    items: readonly string[];
    sizes: readonly string[];
    lines: readonly PipeBoqLine[];
    /** Guided journey: plain names of the B options, and what the pipes are (e.g. "ท่อน้ำทิ้ง"). */
    plain: Record<string, PipePlainLabel>;
    noun: string;
}) {
    const t = useTranslations('calculators');
    const inJourney = useJourneyMode();
    if (inJourney) {
        return <PipeRunsJourney def={def} input={input} onChange={onChange} result={result} items={items}
            sizes={sizes} lines={lines} plain={plain} noun={noun} />;
    }
    const sectionNo = def.sections[0] ?? 0;
    const out = def.compute(input, NO_DEPS);
    const boqDesc = (line: PipeBoqLine) => {
        const row = result.boq.sections.find(s => s.no === sectionNo)?.rows.find(r => r.key === line.line);
        return row?.desc ?? line.size;
    };
    const unlinked = unlinkedRuns(input, lines);
    const mismatches = sizeMismatches(input, lines);
    const positional = lines.map(l => l.size).join(', ');

    return (
        <>
            <SheetCard title={subtitle}>
                <EditableTable<PipeRun>
                    rows={input.runs}
                    onChange={onChange}
                    lockedRows={lines.length}
                    newRow={() => ({ label: '', size: '', horizontal: 0, vertical: 0 })}
                    addLabel={t('common.addItem')}
                    columns={[
                        { kind: 'select', key: 'label', title: t('common.item'), width: 260,
                            options: items.map(v => ({ value: v })),
                            get: r => r.label,
                            // The item name ends with its pipe size: pick that size too (it can still be changed).
                            set: (r, v) => ({ ...r, label: v, size: sizeFromLabel(v, sizes) || r.size }) },
                        { kind: 'select', key: 'size', title: t('wastePipe.pipeSizeType'), width: 120,
                            options: sizes.map(v => ({ value: v })),
                            get: r => r.size.trim(), set: (r, v) => ({ ...r, size: v }) },
                        { kind: 'number', key: 'horizontal', title: t('common.horizontalRunM'), width: 110,
                            get: r => r.horizontal, set: (r, v) => ({ ...r, horizontal: v }) },
                        { kind: 'number', key: 'vertical', title: t('wastePipe.verticalLengthM'), width: 110,
                            get: r => r.vertical, set: (r, v) => ({ ...r, vertical: v }) },
                        { kind: 'calc', key: 'length', title: t('common.totalLengthM2'), width: 110, get: r => runLength(r) },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>{t('wastePipe.totalLengthHorizontalLengthVertical')}</li>
                    <li>
                        {t('common.rows1')}{lines.length}{t('wastePipe.sentToBOQSection')}{sectionNo}{t('wastePipe.inRowOrder')}{positional}{t('wastePipe.rowsYouAddYourselfAre')}
                    </li>
                    <li>{t('wastePipe.theBOQAdds15Allowance')}</li>
                </ul>
                {(unlinked.length > 0 || mismatches.length > 0) && (
                    <ul className="mt-2 list-disc pl-5 text-[12px] text-orange-600 space-y-0.5">
                        {unlinked.map(u => (
                            <li key={`u${u.index}`}>
                                {t('wastePipe.row')}{u.index + 1} ({u.size || t('wastePipe.noPipeSizeSpecified')}{t('wastePipe.length')}{formatNumber(u.length)}{t('wastePipe.mThereIsNoRow')}
                            </li>
                        ))}
                        {mismatches.map(m => (
                            <li key={`m${m.index}`}>
                                {t('wastePipe.row')}{m.index + 1}{t('wastePipe.selected')}{m.size}{t('wastePipe.butSentToTheBOQ')}{boqDesc(m.line)}{t('wastePipe.whichIsPricedFor')}{m.line.size}{t('wastePipe.checkThePriceUnitOn')}
                            </li>
                        ))}
                    </ul>
                )}
            </SheetCard>

            <SheetCard title={t('wastePipe.pipeLengthSummarySentTo', { sectionNo: String(sectionNo) })}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    {lines.map(l => (
                        <CalcField key={l.line} label={boqDesc(l)} value={out[l.line]} unit={t('common.m')} strong />
                    ))}
                    <CalcField label={t('wastePipe.totalLengthOfAllRows')} value={out.total} unit={t('common.m')} />
                    {(out.unlinked ?? 0) !== 0 && <CalcField label={t('wastePipe.noRowInTheBOQ')} value={out.unlinked} unit={t('common.m')} />}
                </div>
            </SheetCard>
        </>
    );
}
