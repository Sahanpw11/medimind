> UPDATE 2026-11-17: the user rejected the iOS-in-a-window direction. Current direction: clinical light theme, one teal accent, full-width app shell (sidebar, top bar, 12-column content grid), cards and tables, Geist. The contract below describes the superseded direction; DESIGN.md records what is shipped.

---
version: 1
slug: "frontend"
primary_target: "frontend"
related_targets: []
---

# Surface brief: MediMind app (all authenticated screens)

Mode: Operate. Build path: code-led (no image generation available). Direction pinned by the user (Apple Health / iOS HIG), so the concept roll was skipped.

Audience and job: patients book and review care; doctors manage assigned visits; admins read aggregates. Shown to assessors on a laptop projector and as an installed phone PWA.
Constraints: real API data only, role-gated routes, loading/empty/error states, 44pt targets, light+dark, reduced motion, medical data never cached.
Memorable moment: booking a slot: the slot grid shows available/taken/selected, and a taken slot returns a plain-language conflict message with the grid refreshed.
Unresolved: none.

## Direction contract

THESIS: A calm, native-feeling Health-style app where every rule (availability, permission, booking conflict, AI limit) is shown as a plain-language state. It refuses the dashboard template: no KPI tiles, no icon-card grids; grouped lists and one clear chart per question.

OWN-WORLD: iOS grouped-inset system. Ground #F2F2F7 / #000 dark; rows #FFFFFF / #1C1C1E, radius 12, hairline separators. SF system font stack at iOS text-style sizes (34 large title, 22, 17 headline/body, 15, 13, 12). One teal accent (#00798C light, #40C8D8 dark) reserved for actions and selection. Status chips always carry icon + label: blue booked, green confirmed, gray completed, red cancelled, orange no-show. Translucent blurred navigation and tab bars. Lucide icons, one stroke weight.

STORY: Within seconds a patient knows their next appointment, how to book, and what the assistant will not do. Trust comes from visible limits and honest empty/error states; admins see the same data truthfully aggregated.

FIRST VIEWPORT: Mobile (390): large title with greeting, a grouped "Next appointment" row with status chip and a filled teal "Find a doctor" button beneath, an inset list (Ask the assistant, My records, Documents), translucent bottom tab bar with five items. Desktop (1440): 240px source-list sidebar with the wordmark, content column max 760 centred for patient/doctor, wide two-column chart grid for admin; primary action stays in the content, not the chrome.

FORM: Apple HIG grouped-inset application (user-pinned; roll skipped per the pinned-direction rule). Seed key: none.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
