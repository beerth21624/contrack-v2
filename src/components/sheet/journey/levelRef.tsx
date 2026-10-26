'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { getLevel } from '@/domain/journey';

/** Plain title of a journey level ("ฐานราก"); the id when it is not a level. */
export const levelTitle = (levelId: string): string => getLevel(levelId)?.title ?? levelId;

/** Page of a journey level. */
export const levelHref = (levelId: string): string => `/journey/${levelId}`;

/** Inline link to a journey level: "ขั้นตอนฐานราก" (or the given text). */
export function LevelLink({ levelId, className, children }: { levelId: string; className?: string; children?: ReactNode }) {
    return (
        <Link href={levelHref(levelId)} className={className ?? 'text-blue-600 hover:underline'}>
            {children ?? <>ขั้นตอน{levelTitle(levelId)}</>}
        </Link>
    );
}
