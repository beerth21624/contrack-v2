# ConTrack design system (2026-10-26)

One source of truth for how every screen looks. Tokens live in `src/app/globals.css` (`@theme`, Tailwind v4) and in
the antd `ConfigProvider` theme (`src/components/AppLayoutUI.tsx`); components use the tokens, never ad-hoc values.

## Typography
- **UI font: IBM Plex Sans Thai** (next/font, weights 400/500/600/700) — a modern, highly legible Thai + Latin
  family for software; tabular numerals (`font-variant-numeric: tabular-nums`) for every amount and quantity.
- **Document font: Sarabun** (Thai government standard style, like TH Sarabun New) — print/PDF BOQ and exports only.
- Scale (px): 12 caption · 13 secondary · 14 body (default) · 16 section title · 18 card title · 22 page title ·
  28 key figure. Line height 1.55 for Thai body text, 1.25 for headings and figures.
- Weights: 400 body, 500 labels/emphasis, 600 titles. No 700+ except the key figure.

## Colour
- Neutrals (text / borders / surfaces): gray-900 text, gray-600 secondary, gray-400 muted, gray-200 borders,
  gray-100 dividers, white surfaces on a #F6F7F9 page.
- Brand / primary: orange #F97316 (hover #EA580C) — primary buttons, current step, focus ring. One accent only.
- State: green-600 done/success, red-600 problem/error, amber-600 warning. Used only to mean state.
- Sheet cells keep their meaning: input (yellow #FFF7D6 soft), calculated (green #EAF6EC soft) — softened so they
  read as fields, not highlighter.

## Spacing, shape, elevation
- 4 px grid: 4 · 8 · 12 · 16 · 20 · 24 · 32. Card padding 20 (16 on phones). Gap between cards 16.
- Radius: 6 inputs/buttons · 10 cards · 16 hero.
- Borders 1 px gray-200; shadow only `0 1px 2px rgb(16 24 40 / .04)` on cards. No double borders.
- Control heights: 36 (default), 32 (in tables), 40 (primary call to action), touch ≥ 40 on phones.

## Alignment rules (pixel-exact)
- Labels and values share a baseline; icons are vertically centred with text (no 1–2 px drift).
- Numbers right-aligned in fixed-width columns; units left-aligned after a constant gap.
- Card headers: title left, meta right, same height everywhere.
- Every page uses the same max width (1200) and gutters (24 desktop, 16 phone).
