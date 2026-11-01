'use client';

// ─── Small building blocks of the crew screens (cards, sheets, bottom bar, empty / error states) ───
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button, Drawer, Image, Result, Spin } from 'antd';
import { FileOutlined, FilePdfOutlined } from '@ant-design/icons';
import type { FileDto } from '@/shared/contract';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { isModuleDisabled } from '../api';

export function Section({ title, extra, children, tone = 'default', id }: {
    title?: ReactNode;
    extra?: ReactNode;
    children: ReactNode;
    tone?: 'default' | 'highlight' | 'warning' | 'success';
    id?: string;
}) {
    const border = tone === 'highlight' ? 'border-orange-300' : tone === 'warning' ? 'border-amber-300' : tone === 'success' ? 'border-green-300' : 'border-gray-200';
    return (
        <section id={id} className={`bg-white border ${border} rounded-card shadow-card p-4`}>
            {(title !== undefined || extra !== undefined) && (
                <div className="flex items-center justify-between gap-3 mb-3 min-h-6">
                    <h2 className="m-0 text-section font-semibold text-gray-900">{title}</h2>
                    {extra}
                </div>
            )}
            {children}
        </section>
    );
}

/** Label on the left, value on the right (same baseline). */
export function Fact({ label, children }: { label: ReactNode; children: ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-gray-100 last:border-b-0">
            <span className="text-secondary text-gray-600 shrink-0">{label}</span>
            <span className="text-body text-gray-900 text-right">{children}</span>
        </div>
    );
}

export function PageSpinner() {
    return <div className="flex justify-center py-24"><Spin size="large" /></div>;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
    const t = useTranslations('vendor');
    const toText = useErrorMessage();
    if (isModuleDisabled(error)) {
        return <Result status="info" title={t('common.serviceOff')} subTitle={t('common.serviceOffHint')} />;
    }
    return (
        <Result
            status="warning"
            title={t('common.loadFailed')}
            subTitle={toText(error)}
            extra={onRetry === undefined ? undefined : <Button type="primary" size="large" onClick={onRetry}>{t('common.retry')}</Button>}
        />
    );
}

export function SignInPrompt({ next }: { next: string }) {
    const t = useTranslations('vendor');
    return (
        <Result
            status="info"
            title={t('common.signInTitle')}
            subTitle={t('common.signInHint')}
            extra={<Link href={`/vendor/login?next=${encodeURIComponent(next)}`}><Button type="primary" size="large">{t('common.signIn')}</Button></Link>}
        />
    );
}

/** Fixed bar at the bottom of the screen (the screen's one primary action). The shell keeps room for it under the content. */
export function BottomBar({ children }: { children: ReactNode }) {
    return (
        <div className="fixed inset-x-0 bottom-0 z-20 bg-white border-t border-gray-200"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -2px 8px rgb(16 24 40 / .06)' }}>
            <div className="mx-auto max-w-[640px] px-4 py-3">{children}</div>
        </div>
    );
}

/** Bottom sheet (phone-native) for a short task: ask, decline, claim, … */
export function Sheet({ open, onClose, title, children, footer }: {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
}) {
    return (
        <Drawer
            open={open}
            onClose={onClose}
            placement="bottom"
            title={title}
            size="auto"
            destroyOnHidden
            footer={footer}
            styles={{
                wrapper: { maxHeight: '92dvh', borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
                body: { paddingTop: 12 },
            }}
        >
            <div className="mx-auto max-w-[640px]">{children}</div>
        </Drawer>
    );
}

const isImage = (f: FileDto) => f.contentType.startsWith('image/');

/** Photos as tappable thumbnails, other files (PDF, drawings) as rows that open in a new tab. */
export function FileList({ files }: { files: readonly FileDto[] }) {
    const images = files.filter(isImage);
    const others = files.filter(f => !isImage(f));
    return (
        <div className="flex flex-col gap-3">
            {images.length > 0 && (
                <Image.PreviewGroup>
                    <div className="grid grid-cols-3 gap-2">
                        {images.map(f => (
                            <Image key={f.id} src={f.url} alt={f.name} width="100%" height={96}
                                style={{ objectFit: 'cover', borderRadius: 6 }} />
                        ))}
                    </div>
                </Image.PreviewGroup>
            )}
            {others.map(f => (
                <a key={f.id} href={f.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 min-h-11 px-3 rounded-control border border-gray-200 text-gray-900 hover:border-orange-300">
                    {f.contentType === 'application/pdf' ? <FilePdfOutlined className="text-red-600" /> : <FileOutlined />}
                    <span className="truncate">{f.name}</span>
                </a>
            ))}
        </div>
    );
}

/** Calm, centered note for a state with nothing to do (empty tab, closed package). */
export function QuietNote({ title, children }: { title: string; children?: ReactNode }) {
    return (
        <div className="text-center py-10 px-4">
            <div className="text-section font-medium text-gray-700">{title}</div>
            {children !== undefined && <div className="mt-2 text-secondary text-gray-500">{children}</div>}
        </div>
    );
}
