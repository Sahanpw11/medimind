---
name: MediMind
description: Clinical light-theme web app; one teal accent on cool neutrals, Geist, full-width sidebar shell with cards and tables.
colors:
  clinic-teal: "#00798c"
  clinic-teal-strong: "#00606f"
  teal-wash: "#e6f4f6"
  teal-line: "#b6dde3"
  deep-teal: "#06424d"
  ground: "#f5f7fa"
  surface: "#ffffff"
  surface-muted: "#f9fafb"
  line: "#e3e8ef"
  line-strong: "#cfd6e2"
  ink: "#0f1b2d"
  ink-secondary: "#44546a"
  ink-tertiary: "#5f6e84"
  info: "#0a58b5"
  info-wash: "#e8f0fc"
  ok: "#1b7a3a"
  ok-wash: "#e7f5ec"
  warn: "#9a5200"
  warn-wash: "#fff2e0"
  danger: "#b3261e"
  danger-wash: "#fdecea"
  completed: "#475467"
  completed-wash: "#eef1f5"
typography:
  page-title:
    fontFamily: "Geist Variable, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  card-title:
    fontFamily: "Geist Variable, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  stat-value:
    fontFamily: "Geist Variable, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 650
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  body:
    fontFamily: "Geist Variable, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist Variable, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 550
  caption:
    fontFamily: "Geist Variable, -apple-system, Segoe UI, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
rounded:
  control: "10px"
  card: "12px"
  chip: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.clinic-teal}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "0 18px"
  button-primary-hover:
    backgroundColor: "{colors.clinic-teal-strong}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "10px 12px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "20px"
  chip:
    rounded: "{rounded.chip}"
    padding: "3px 10px 3px 8px"
  nav-item-active:
    backgroundColor: "{colors.teal-wash}"
    textColor: "{colors.clinic-teal-strong}"
    rounded: "{rounded.control}"
    height: "42px"
---

# Design System: MediMind

## Overview

**Creative North Star: "The Clinic Front Desk"**

A clean, well-lit reception: white surfaces on a cool grey ground, one teal that marks the thing to do next, and plain-language states for every rule (availability, permission, conflict, AI limit). It is a full-width application, not a phone-shaped column: a 248px sidebar, a 64px top bar and a content area that fills the viewport up to 1800px. Light theme only; dark mode was removed on purpose and `color-scheme: light` is locked.

Density is moderate and legible. Cards, tables and grouped rows carry the content; depth is a hairline border plus a near-invisible shadow. The same product reads on a laptop projector and, below 1024px, as a phone app with a bottom tab bar.

**Key Characteristics:**
- One accent (teal), used for actions, selection, current navigation and the single chart series.
- One radius system: cards 12px, controls 10px, chips pill.
- Geist Variable, self-hosted, weights 400 to 700, tabular numerals for data.
- Status is never colour alone: every chip pairs an icon with a label.
- Clinic times are UTC and say so.
- Styles are organized in CSS cascade layers: tokens, base, layout, components, screens.

## Colors

A cool-neutral clinical palette with a single teal voice and a small functional set reserved for status.

### Primary
- **Clinic Teal** (#00798c): primary buttons, selected date/slot, user chat bubble, focus ring, the one chart series.
- **Clinic Teal Strong** (#00606f): hover of primary, text links, active nav label, tinted icon glyphs (passes contrast on teal wash).
- **Teal Wash** (#e6f4f6) and **Teal Line** (#b6dde3): active nav background, row icon tiles, avatar, slot hover, focus halo.
- **Deep Teal** (#06424d): sign-in aside panel only (desktop auth screen).

### Neutral
- **Ground** (#f5f7fa): page background.
- **Surface** (#ffffff): sidebar, top bar, cards, inputs, tab bar.
- **Surface Muted** (#f9fafb): table headers, row hover, disabled/taken slots, summary boxes.
- **Line** (#e3e8ef) and **Line Strong** (#cfd6e2): hairline dividers and card borders; input and secondary-button borders.
- **Ink** (#0f1b2d), **Ink Secondary** (#44546a), **Ink Tertiary** (#5f6e84): primary, supporting and metadata text.

### Status
- Booked **Info** (#0a58b5 on #e8f0fc); Confirmed **Ok** (#1b7a3a on #e7f5ec); Completed (#475467 on #eef1f5); Cancelled **Danger** (#b3261e on #fdecea); No-show **Warn** (#9a5200 on #fff2e0). The same functional hues drive banners.

### Named Rules
**The One Teal Rule.** Teal is the only brand hue. Status colours appear only inside status chips, banners and validation, never as decoration.
**The Icon-Plus-Label Rule.** A status is an icon and a word on a tinted pill. Colour alone never carries state.

## Typography

**Display / Body / Label Font:** Geist Variable (fallback: -apple-system, Segoe UI, system-ui, Roboto, Arial, sans-serif)

**Character:** One neutral, precise sans family at modest sizes; hierarchy comes from weight (550 to 650) and slight negative tracking on headings, not from size jumps.

### Hierarchy
- **Page title** (650, 26px, 1.2, -0.02em; 22px below 1024px): one h1 per screen in the page head, with optional 70ch subtitle in Ink Secondary.
- **Auth headline** (650, 28px for form heading; 36px on the teal aside).
- **Stat value** (650, 28px, tabular numerals): figures in the stat strip.
- **Card title** (600, 16px, -0.01em): card, panel and doctor-card headings.
- **Body** (400, 15px, 1.5): default text; row titles at 550; supporting text 14px Ink Secondary.
- **Label** (550, 13.5px): field labels, group titles (600).
- **Caption** (500 to 600, 12 to 13px): table headers, chips (12.5px), metadata, tab bar labels (11px).

### Named Rules
**The Tabular Rule.** Times, counts, dates and table figures use tabular numerals.
**The Sentence-Case Rule.** Headings, labels and table headers are sentence case; uppercase appears only on the weekday abbreviation in the date strip.

## Layout

App shell: a two-column grid, 248px sticky white sidebar and a flexible main column. The 64px sticky top bar holds the user menu; the content area is capped at 1800px, centred, with a fluid gutter of clamp(16px, 2.4vw, 40px) and 28px top padding. Page content sits on a 12-column grid with 20px gaps; children span 12 by default and take 3 to 9 column spans from 1024px up. Admin charts use 8/4 and 6/6 splits.

Spacing rhythm: 8, 12, 16, 20, 24 and 28px; card padding 20px; rows are at least 56px; all touch targets at least 44px (40px for compact buttons).

Responsive: below 1024px the sidebar is removed, the brand moves into a 56px top bar, and a fixed bottom tab bar (60px plus safe area) takes navigation. Tables collapse under 768px into stacked cards with data-label captions. The stat strip dividers flip to horizontal below 600px. Auto-fit grids (filters, forms, description lists) and a doctor card grid (auto-fill, 290px minimum) reflow without breakpoints. Booking is a two-pane layout on desktop (date strip and slot grid beside a summary) stacked on mobile.

## Elevation & Depth

Flat and tonal. Cards are defined by a 1px Line border on a white surface over the grey ground, with a barely visible resting shadow (`0 1px 2px rgba(16,36,64,0.05), 0 1px 1px rgba(16,36,64,0.03)`). Lift is reserved for overlays and hover: the user menu uses `0 8px 24px rgba(16,36,64,0.12)`, the doctor card hover uses `0 4px 16px rgba(16,36,64,0.08)` with a teal-line border. The selected segmented option carries `0 1px 2px rgba(16,36,64,0.12)`.

### Named Rules
**The Hairline Rule.** Separation comes from 1px lines and tonal steps (ground, surface, surface-muted). Shadows are soft, blurred and low-opacity; never hard-offset.

## Shapes

Three radii only: 12px for cards, groups, panels and menus; 10px for buttons, inputs, selects, slots, segmented control, banners and nav items; pill (999px) for chips, avatars and the user-menu trigger. Small inner elements (segmented options, menu items, skeletons) use 8px. Chat bubbles are 14px with a 4px tail corner. Chart bars use a 4px rounded data end. Borders are always 1px; focus is a 3px teal outline with 2px offset.

## Components

### Buttons
- **Shape:** 10px radius, 44px minimum height, 18px side padding, weight 600, full width by default (`compact` 40px and `fit` are auto-width).
- **Primary:** Clinic Teal fill, white text; hover Clinic Teal Strong; active shifts 1px down.
- **Secondary:** white with Line Strong border; **Plain:** teal-strong text on transparent, wash on hover; **Danger:** white with danger text and a tinted border, danger wash on hover.
- **Disabled:** 45% opacity, not-allowed cursor. Loading shows a 16px spinner.

### Chips
- Pill, 12.5px weight 600, tinted background with matching text, a 13px icon and a label. Variants: booked, confirmed, completed, cancelled, no_show, neutral, accent.

### Cards / Containers
- 12px radius, white, 1px Line border, resting shadow. Optional head (16px 20px, bottom hairline), body (20px), foot (13px muted). Grouped rows (`group`) are a single card of 56px-minimum rows split by hairlines, with chevron links and 34px teal-wash icon tiles.
- Doctor card: avatar, name and specialty, hairline footer with a teal "go" link; border turns teal-line on hover.

### Inputs / Fields
- 44px, white, 1px Line Strong border, 10px radius, 13.5px weight-550 label above. Focus swaps the border to teal and adds a 3px Teal Wash halo. Invalid uses a danger border and a 13px danger message with role alert. Select has a chevron glyph; search inputs carry a leading icon.

### Navigation
- Sidebar: white, brand mark top, 42px items with 12px icon gap, ink-secondary at rest, surface-muted on hover, Teal Wash plus teal-strong 600 text when current; footer note at the bottom.
- Top bar: user menu pill (avatar, name, capitalized role) opening a 12px-radius popover.
- Mobile: fixed bottom tab bar, 22px icons over 11px labels, current item in teal-strong.

### Tables
- Header row on surface-muted, 12.5px muted labels; 14px by 20px cells; row hover on surface-muted. Under 768px each row becomes a stacked card with `data-label` captions.

### Booking (signature)
- Date strip of 60 by 70px buttons (weekday caps, day number); selected fills teal. Slot grid of 44px tabular-numeral buttons in auto-fill 96px columns: available outlined, hover teal wash, selected teal fill, taken muted with strikethrough. A legend and a summary box sit alongside; conflicts return as an error banner with the grid refreshed.

### Stat strip and charts (signature)
- Stat strip: one card, auto-fit columns separated by vertical hairlines, key (13.5px), value (28px), detail.
- Charts: one question per panel, single series in Clinic Teal, bars at most 24px (22px vertical, 16px horizontal), 4px rounded data end, hairline grid in Line, 12px Ink Secondary axis text, tooltip on hover, a text summary in the `aria-label`, and a table view in a details disclosure. No animation.

### Banners, empty and loading states
- Banners: 10px radius, tinted wash with icon, variants info, error, success, emergency (weight 600). Empty states: centred 40px muted icon, 18px heading, 38ch text, optional action. Loading is a skeleton shimmer in grouped rows; reduced motion collapses all animation.

### Assistant chat
- User bubble teal fill, white text; bot bubble surface-muted with Line border, source chips and a fine-print disclaimer; composer pinned in the card foot with suggestion pills.

## Do's and Don'ts

### Do:
- **Do** use the layer order tokens, base, layout, components, screens, and pull colours, radii and shadows from the custom properties.
- **Do** pair every status with an icon and a label, and show clinic times in UTC with the suffix.
- **Do** keep cards at 12px, controls at 10px, chips pill; keep touch targets at 44px or more.
- **Do** use tabular numerals for times, counts and table figures.
- **Do** keep charts to one teal series, bars at most 24px, with hairline grid, tooltip and a table view.
- **Do** collapse tables to stacked cards under 768px and swap the sidebar for the bottom tab bar under 1024px.

### Don't:
- **Don't** add a dark theme or dark tokens; light is locked by decision.
- **Don't** return to the iOS-style direction: no phone-width centred column, no translucent blurred bars, no grouped-inset-only layouts on desktop.
- **Don't** introduce a second accent hue or use status colours decoratively.
- **Don't** use colour alone for state, or hard-offset shadows.
- **Don't** constrain desktop content to a narrow column; use the 12-column grid up to 1800px.

## Not canonized

The build carries drift that future surfaces must not inherit: `src/pages/admin/Dashboard.tsx` references `--label-2` and `--fill`, iOS-era tokens no longer defined in `index.css` (tooltip text, bar labels and tooltip cursor fall back to inherited or unset values); about 60 inline `style={{ }}` props in pages and components bypass the layers; the chart axis and data-label sizes (12px) sit below the 13px used for other metadata.
