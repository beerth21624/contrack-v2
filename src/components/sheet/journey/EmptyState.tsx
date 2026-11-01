'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { levelHref, levelTitle } from './levelRef';
import { useRequiredAdd } from './RequiredContext';

export interface EmptyAction { label: string; onClick: () => void }

/**
 * Friendly prompt for an empty list or table of a journey level, with one big primary "เพิ่ม…" button
 * (`addLabel` + `onAdd`). Extra add buttons (`actions`) come after it in the default style; `goToLevel` sends the
 * user to the earlier level the list comes from instead.
 */
export function EmptyState({ text, note, addLabel, onAdd, actions = [], goToLevel, children }: {
    text: ReactNode;
    /** Smaller grey line under the text. */
    note?: ReactNode;
    addLabel?: string;
    onAdd?: () => void;
    actions?: EmptyAction[];
    /** Journey level id: a "ไปที่ขั้นตอน…" button to that level. */
    goToLevel?: string;
    children?: ReactNode;
}) {
    const t = useTranslations('journeyUi.level');
    const buttons: EmptyAction[] = [...(addLabel !== undefined && onAdd ? [{ label: addLabel, onClick: onAdd }] : []), ...actions];
    // After a failed confirm on a step that needs its first item, the thin missing ring.
    const needed = useRequiredAdd() && buttons.length > 0;
    return (
        <div data-req-add=""
            className={`flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center scroll-mt-24 ${needed ? 'ring-1 ring-red-300' : ''}`}>
            <div className="text-[14px] text-gray-600 max-w-xl">{text}</div>
            {note !== undefined && <div className="text-[12px] text-gray-500 max-w-xl">{note}</div>}
            {(buttons.length > 0 || goToLevel !== undefined) && (
                <div className="flex flex-wrap justify-center gap-2">
                    {buttons.map((b, i) => (
                        <Button key={b.label} type={i === 0 ? 'primary' : 'default'} size="large" icon={<PlusOutlined />}
                            onClick={b.onClick}>
                            {b.label}
                        </Button>
                    ))}
                    {goToLevel !== undefined && (
                        <Link href={levelHref(goToLevel)}>
                            <Button type={buttons.length === 0 ? 'primary' : 'default'} size="large" icon={<ArrowLeftOutlined />}>
                                {t('goTo', { title: levelTitle(goToLevel) })}
                            </Button>
                        </Link>
                    )}
                </div>
            )}
            {children}
        </div>
    );
}
