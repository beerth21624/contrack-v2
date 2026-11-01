'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getLevel } from '@/domain/journey';

/** Plain title of a journey level ("ฐานราก"); the id when it is not a level. */
export const levelTitle = (levelId: string): string => getLevel(levelId)?.title ?? levelId;

/** Page of a journey level. */
export const levelHref = (levelId: string): string => `/journey/${levelId}`;

/** Inline link to a journey level: "ขั้นตอนฐานราก" (or the given text). */
export function LevelLink({ levelId, className, children }: { levelId: string; className?: string; children?: ReactNode }) {
    const t = useTranslations('journeyUi.level');
    return (
        <Link href={levelHref(levelId)} className={className ?? 'text-blue-600 hover:underline'}>
            {children ?? t('step', { title: levelTitle(levelId) })}
        </Link>
    );
}
