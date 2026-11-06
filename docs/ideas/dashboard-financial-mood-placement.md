# Financial Mood Placement & Diagnostic Modal

## Problem Statement

How might we surface the owner's holistic financial health (Financial Mood) on the dashboard so it feels insightful, contextual, and earned—without cluttering the personal greeting header?

## Recommended Direction

**Option 1: Financial Health Status Ribbon (Pre-KPI Banner)**

Relocating the Financial Mood from the greeting row to a dedicated, interactive banner positioned directly between the user header and the primary 4-stat KPI strip.

### Why this works:

1. **Separates Identity from Analytics**: The greeting row remains uncluttered (`Halo, [Nama]`, date, bio, and month switcher).
2. **Natural Context**: The banner bridges the high-level greeting and the granular numbers in the KPI stat strip, framing the financial overview before users inspect individual figures.
3. **Clear Affordance**: Instead of an ambiguous badge next to a person's name, the ribbon features a live pulse indicator, mood tag, contextual summary sentence, and an explicit action (`Lihat analisis →`).
4. **Modal Deep Dive**: Clicking opens a dialog containing custom SVG illustrations tailored to the active status (`THRIVING`, `BALANCED`, `ATTENTION`), accompanied by cashflow totals, budget utilization percentages, and concrete, actionable recommendations.

## Key Assumptions to Validate

- [ ] Users recognize the status ribbon as an interactive diagnostic summary rather than a static alert.
- [ ] The custom SVG illustrations and plain-language financial guidance improve understanding of budget pacing.
- [ ] The banner layout is comfortable on both 320px mobile viewports and large desktop screens.

## MVP Scope

- `FinancialMoodBanner` component in `apps/web/components/ledger/financial-mood-modal.tsx`.
- Integrated directly above `<DashboardStatStrip />` on the main dashboard page (`apps/web/app/app/page.tsx`).
- Diagnostic modal with status-specific SVG illustrations, live numbers (Arus Kas Masuk, Keluar, Net, Anggaran Tertinggi), and practical financial guidance.
- Clean responsive layout and full keyboard/ARIA accessibility.

## Not Doing (and Why)

- **Inline editing of budgets from the modal**: The modal is an analytical diagnostic surface; editing belongs on `/app/budgets` via the primary "Atur Anggaran" CTA.
- **Dismissible/closeable state for the banner**: The banner reflects current financial health calculated from the database; hiding it would obscure active overbudget or deficit warnings.
