'use client';

// ─── Global search: header icon and Ctrl/⌘+K open a dialog; projects, customers, suppliers and numbered documents ───
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Modal, Spin, Tag } from 'antd';
import type { InputRef } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { type SearchHit, SEARCH_QUERY_MAX } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { EmptyState } from '../shared/EmptyState';
import { useGlobalSearch } from './hooks';

export function GlobalSearch() {
    const t = useTranslations('portal');
    const tEnums = useTranslations('enums');
    const toText = useErrorMessage();
    const router = useRouter();
    const ws = useErpWorkspace();
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    const [q, setQ] = useState('');
    const [cursor, setCursor] = useState(0);
    const input = useRef<InputRef>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOpen(o => !o);
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        const id = setTimeout(() => setQ(text.trim()), 250);
        return () => clearTimeout(id);
    }, [text]);

    const result = useGlobalSearch(ws.workspaceId, q);
    const hits: readonly SearchHit[] = q === '' ? [] : result.data ?? [];

    const close = () => { setOpen(false); setText(''); setQ(''); setCursor(0); };
    const go = (hit: SearchHit) => { close(); router.push(hit.href); };

    const typeLabel = (hit: SearchHit): string => {
        if (hit.type === 'document' && hit.docType !== null) return tEnums(`docType.${hit.docType}`);
        return t(`search.types.${hit.type}`);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (hits.length === 0) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(hits.length - 1, c + 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
        else if (e.key === 'Enter') { const hit = hits[cursor]; if (hit !== undefined) go(hit); }
    };

    return (
        <>
            <Button type="text" aria-label={t('search.open')} title={t('search.openHint')} onClick={() => setOpen(true)}
                icon={<SearchOutlined style={{ fontSize: 18, color: '#fff' }} />}
                style={{ minWidth: 40, minHeight: 40, background: 'transparent' }} />
            <Modal open={open} onCancel={close} footer={null} title={t('search.title')} destroyOnHidden
                afterOpenChange={o => { if (o) input.current?.focus(); }}>
                <Input ref={input} allowClear size="large" prefix={<SearchOutlined />} value={text} maxLength={SEARCH_QUERY_MAX}
                    placeholder={t('search.placeholder')}
                    onChange={e => { setText(e.target.value); setCursor(0); }} onKeyDown={onKeyDown} />
                <div className="mt-3 max-h-[50vh] overflow-y-auto">
                    {q === '' ? (
                        <div className="py-6 text-center text-secondary text-gray-500">{t('search.hint')}</div>
                    ) : result.isError ? (
                        <div className="py-6 text-center text-red-600">{toText(result.error)}</div>
                    ) : result.data === undefined || q !== text.trim() ? (
                        <div className="flex justify-center py-6"><Spin /></div>
                    ) : hits.length === 0 ? (
                        <EmptyState title={t('search.empty')} />
                    ) : (
                        <ul className="m-0 flex list-none flex-col p-0" role="listbox">
                            {hits.map((hit, i) => (
                                <li key={`${hit.type}:${hit.id}`} role="option" aria-selected={i === cursor}>
                                    <button type="button" onClick={() => go(hit)} onMouseEnter={() => setCursor(i)}
                                        className={`flex w-full min-w-0 cursor-pointer items-center gap-3 rounded border-0 px-2 py-2 text-left ${i === cursor ? 'bg-orange-50' : 'bg-transparent'}`}>
                                        <Tag className="!m-0 shrink-0">{typeLabel(hit)}</Tag>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-gray-900">{hit.title}</span>
                                            {hit.subtitle !== '' && <span className="block truncate text-[12px] text-gray-500">{hit.subtitle}</span>}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </Modal>
        </>
    );
}
