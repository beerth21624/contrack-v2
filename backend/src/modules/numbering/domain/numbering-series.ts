// ─── Effective numbering series of a document type (saved row or DOC_TYPE_DEFAULTS) ───
import {
    DEFAULT_MONTHLY_NUMBER_PATTERN, DEFAULT_NUMBER_PATTERN, DOC_TYPE_DEFAULTS, type DocType, type NumberReset, type YearStyle,
} from '@contrack/contract';
import { formatDocNumber, periodKeyOf } from '@contrack/domain/erp/numbering';
import type { UserId } from '../../../shared/domain/ids';
import type { SavedSeries } from '../application/ports/numbering.repository';

export interface NumberingSeries {
    docType: DocType;
    prefix: string;
    pattern: string;
    reset: NumberReset;
    yearStyle: YearStyle;
    isDefault: boolean;
    updatedBy: UserId | null;
    updatedAt: Date | null;
}

export function effectiveSeries(docType: DocType, saved: SavedSeries | undefined): NumberingSeries {
    if (saved !== undefined) return { ...saved, isDefault: false };
    const d = DOC_TYPE_DEFAULTS[docType];
    return {
        docType,
        prefix: d.prefix,
        pattern: d.reset === 'monthly' ? DEFAULT_MONTHLY_NUMBER_PATTERN : DEFAULT_NUMBER_PATTERN,
        reset: d.reset,
        yearStyle: 'ce',
        isDefault: true,
        updatedBy: null,
        updatedAt: null,
    };
}

export const seriesPeriodKey = (series: NumberingSeries, issueDate: string): string => periodKeyOf(series.reset, issueDate);

export const seriesNumber = (series: NumberingSeries, issueDate: string, seq: number): string =>
    formatDocNumber(series.pattern, { prefix: series.prefix, issueDate, yearStyle: series.yearStyle, seq });

/** True when two series would print different numbers (any of prefix / pattern / reset / year style differs). */
export const seriesChanged = (a: NumberingSeries, b: Pick<NumberingSeries, 'prefix' | 'pattern' | 'reset' | 'yearStyle'>): boolean =>
    a.prefix !== b.prefix || a.pattern !== b.pattern || a.reset !== b.reset || a.yearStyle !== b.yearStyle;
