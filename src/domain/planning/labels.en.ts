// ─── English overlay of the planning labels (docs/erp/03-i18n.md §9): task names, month abbreviations, installment ───
// labels and the built-in wage set names. Pure data + lookups; tasks.ts / calendar.ts / wage-sets.ts (Thai) stay the
// source of truth and the fallback. A name the user typed is never translated.

const isEn = (locale: string): boolean => locale === 'en';

/** Thai month abbreviation (as Excel renders "mmm-yy") → English. */
const MONTH_ABBR_EN: Readonly<Record<string, string>> = {
    'ม.ค.': 'Jan', 'ก.พ.': 'Feb', 'มี.ค.': 'Mar', 'เม.ย.': 'Apr', 'พ.ค.': 'May', 'มิ.ย.': 'Jun',
    'ก.ค.': 'Jul', 'ส.ค.': 'Aug', 'ก.ย.': 'Sep', 'ต.ค.': 'Oct', 'พ.ย.': 'Nov', 'ธ.ค.': 'Dec',
};

const MONTH_RE = /(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)/g;

/** "ม.ค.-26" → "Jan-26" (also inside "W3 มี.ค.-26"); unchanged for Thai. */
export function monthLabelIn(label: string, locale: string): string {
    return isEn(locale) ? label.replace(MONTH_RE, m => MONTH_ABBR_EN[m] ?? m) : label;
}

/** Task name (S-Curve / CashFlow) by task id. */
export const TASK_NAME_EN: Readonly<Record<string, string>> = {
    '1.1': 'Temporary water and electricity',
    '1.2': 'Site preparation',
    '1.3': 'Layout and staking',
    '1.4': 'Piling',
    '1.5': 'Footings',
    '1.6': 'Pedestal columns',
    '1.7': 'Ground beams',
    '2.1': 'Cast-in-place slab',
    '2.2': 'Precast slab',
    '2.3': 'First-floor columns',
    '2.4': 'Beams + roof deck slab',
    '2.5': 'Staircase structure',
    '3.1': 'Column cap plates',
    '3.2': 'Roof framing',
    '3.3': 'Roof covering',
    '4.1': 'Brick masonry',
    '4.2': 'Electrical conduit installation',
    '5.1': 'Plastering',
    '5.2': 'Electrical wiring',
    '6.1': 'Ceiling',
    '6.2': 'Tiling',
    '6.3': 'Bathroom tiling',
    '6.4': 'Wall finishing',
    '6.5': 'Primer painting',
    '7.1': 'Aluminium doors and windows',
    '7.2': 'Finish painting, coat 1',
    '8.1': 'Electrical fixtures installation',
    '8.2': 'Plumbing and sanitary system',
    '8.3': 'Miscellaneous work',
    '8.4': 'Sanitary ware',
    '8.5': 'Wooden doors and windows',
    '8.6': 'Final paint coat',
};

/** Man-Day block title by task id (only where it differs from the task name). */
const TASK_TITLE_EN: Readonly<Record<string, string>> = {
    '4.2': 'Electrical conduits',
    '5.2': 'Wiring',
    '6.2': 'Floor tiling',
};

/** Task name in the UI locale (the Thai name when the locale is Thai or the task is unknown). */
export const taskNameIn = (id: string, name: string, locale: string): string =>
    (isEn(locale) ? TASK_NAME_EN[id] : undefined) ?? name;

/** Man-Day block title in the UI locale. */
export const taskTitleIn = (id: string, title: string, locale: string): string =>
    (isEn(locale) ? (TASK_TITLE_EN[id] ?? TASK_NAME_EN[id]) : undefined) ?? title;

/** "งวดที่ 3" → "Installment 3", "มัดจำทำสัญญา" → "Contract deposit"; other (typed) labels unchanged. */
export function installmentLabelIn(label: string, locale: string): string {
    if (!isEn(locale)) return label;
    if (label === 'มัดจำทำสัญญา') return 'Contract deposit';
    const m = /^งวดที่ (\d+)$/.exec(label);
    return m ? `Installment ${m[1] ?? ''}` : label;
}

/** The built-in wage set names (wage-sets.ts) and the sample project name. */
const SAMPLE_TEXT_EN: Readonly<Record<string, string>> = {
    'งานทั่วไป': 'General work',
    'หลังคา ไฟฟ้า ฝ้า สี อลูมิเนียม เบ็ดเตล็ด': 'Roofing, electrical, ceiling, paint, aluminium, miscellaneous',
    'บ้านพักอาศัย คสล 1 ชั้น': 'Single-storey reinforced concrete house',
};

/** A name that is still the template's own text (wage set name, sample project name) in the UI locale. */
export const sampleTextIn = (text: string, locale: string): string =>
    (isEn(locale) ? SAMPLE_TEXT_EN[text] : undefined) ?? text;
