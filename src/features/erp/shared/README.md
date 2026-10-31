# ERP UI kit (`src/features/erp/shared/`)

Shared pieces of every ERP screen (WP-06). Text comes from the `erp` / `common` / `enums` namespaces, numbers and dates
from `useFormat()` (`src/i18n/format.ts`). No Thai literals in ERP code (ESLint). One line per piece:

| File | Use |
|---|---|
| `ErpPage.tsx` | `<ErpPage title={t('list.title')} extra={<Button/>} breadcrumb={[{ label: t('x'), href: '/x' }, { label: name }]}>…</ErpPage>` (1200 px column; the app shell gives the 16 px phone gutter). `PageHeader` is exported for custom layouts. |
| `SectionCard.tsx` | `<SectionCard title={t('lines.title')} extra={<Button/>}>…</SectionCard>` |
| `StatusTag.tsx` | `<StatusTag enumName="quotationStatus" value={q.status} />` — label `enums.quotationStatus.<value>`; colours: own `tones={{ sent: 'processing' }}` or defaults (`statusTone`). |
| `MoneyText.tsx` | `<MoneyText value={1234.5} />` → `1,234.50` (`currency` → `1,234.50 บาท` / `THB 1,234.50`; null → `–`) |
| `QtyText.tsx` | `<QtyText value={12.5} unit={line.unit} />` → `12.5 ตร.ม.` |
| `DateText.tsx` | `<DateText value="2026-10-31" />` → `31 ต.ค. 2026` (`style="long"` / `"dateTime"`; always the Christian-era year) |
| `DocumentNumberTag.tsx` | `<DocumentNumberTag number={doc.number} />` → the number, or the "draft" tag when null |
| `EmptyState.tsx` | `<EmptyState title={t('empty.title')} hint={t('empty.hint')} action={<Button/>} />` (title defaults to `erp.empty.default`) |
| `ConfirmAction.tsx` | `<ConfirmAction danger title={t('confirm.void')} onConfirm={() => voidDoc.mutateAsync()}>{t('actions.void')}</ConfirmAction>` (errors shown via `useErrorMessage`) |
| `MoneyInput.tsx` | `<Form.Item name="amount"><MoneyInput /></Form.Item>` (2 decimals, grouping; `allowNegative` for VO / credit notes) |
| `QtyInput.tsx` | `<QtyInput precision={4} />` (≤ 4 decimals; `allowNegative`) |
| `FileAttachments.tsx` | `<FileAttachments purpose="quotation_attachment" workspaceId={ws.workspaceId} value={files} onChange={setFiles} />` (POST `/api/files` with `workspaceId`; `readOnly` for a list) |
| `files.ts` | `uploadErpFile(file, purpose, workspaceId)` / `uploadProblem(file)` for custom upload UIs |
| `PrintFrame.tsx` | `<PrintFrame language={doc.language} watermark={doc.status === 'draft' ? 'draft' : null} title={doc.number}>…</PrintFrame>` inside `src/app/(print)/print/<doc>/[id]/page.tsx`; text via `documentTranslator(doc.language)` |
| `PrintShell.tsx` | used by `src/app/(print)/layout.tsx` only (antd + session start, grey backdrop) |
| `apiPaths.ts` | `workspacePath(ws, 'customers', id)` → `/workspaces/<ws>/customers/<id>`; `projectPath(p, 'quotations')`; `seg(s)`; `apiPath(...)` |
| `useErpWorkspace.ts` | `const { workspaceId, role, memberCount, isSolo } = useErpWorkspace();` (switcher's workspace; pass an id on project pages) |

Elsewhere: module gate `ModuleGate` / `useModuleEnabled` / `useActiveModules` (`src/features/modules/`), errors
`useErrorMessage()` (`src/features/cloud/api/error-message.ts`), permissions `can(role, p)` (`@/shared/contract`),
menu entries and project tabs `src/features/erp/hub/nav-registry.ts` (add an item to `WORKSPACE_NAV` / `PROJECT_TABS`).
