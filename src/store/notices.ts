// ─── Short messages for the user from code without React (store, sync engine, realtime) ───
// The app shell subscribes once and shows them with antd `message`.

export type NoticeLevel = 'info' | 'success' | 'warning' | 'error';

export interface AppNotice {
    level: NoticeLevel;
    text: string;
    /** Same key = replaces the previous message instead of stacking. */
    key?: string;
}

type Listener = (notice: AppNotice) => void;
const listeners = new Set<Listener>();

export function emitNotice(notice: AppNotice): void {
    for (const l of listeners) l(notice);
}

export function onNotice(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
