# RepoStars UX Redesign Plan

## Problem
Current UI is functional but feels default/generic:
- Linear vertical stack with no visual hierarchy
- Hero is just a subtitle — no presence
- Theme picker buried below chart (easy to miss)
- Export/share feels disconnected from chart
- Empty state is inside a card but doesn't guide the user
- No visual polish or personality

## Goal
Make RepoStars feel like a polished, purpose-built tool — not a shadcn template.

---

## Phase 1: Layout Restructure

### 1.1 Merge Hero + Search into one focused block
**Current:** Separate `Hero` (just subtitle) + `RepoSearch` below it.
**New:** Single top block with:
- Logo/brand mark inline (small)
- Title: "Compare GitHub Star History"
- Search bar directly underneath, full width
- When repos are loaded, this section collapses to just the search bar (compact mode)

**Files:** `components/hero.tsx`, `components/home-content.tsx`

### 1.2 Control bar (chips + theme + share)
**Current:** Chips → Chart → Theme → Export (4 separate vertical sections)
**New:** Single toolbar row between search and chart:
- Left: repo chips (scrollable if many)
- Right: theme dropdown + share button

**Files:** `components/home-content.tsx`, `components/repo-chips.tsx`, `components/theme-picker.tsx`

### 1.3 Theme picker → compact dropdown
**Current:** Row of buttons (takes full width, lots of space)
**New:** `Select` dropdown with color dot + theme name. Compact, single line.

**Files:** `components/theme-picker.tsx`

### 1.4 Chart section — make it the visual centerpiece
**Current:** Chart inside `mb-6` div, default height
**New:**
- Slightly taller default (450px → 500px)
- Subtle border/shadow treatment
- Export actions attached as a mini-toolbar at bottom-right of chart card

**Files:** `components/chart-section.tsx`, `components/export-bar.tsx`

### 1.5 Export bar → chart-attached toolbar
**Current:** Separate section below theme picker
**New:** Compact icon row pinned to bottom-right of chart card:
- Share icon (dropdown: Copy URL, Share on X, Export PNG)
- Embed icon (copies README badge)
- No separate "Share" / "README Embed" sections

**Files:** `components/export-bar.tsx`, `components/chart-section.tsx`

---

## Phase 2: Empty State & Onboarding

### 2.1 Better empty state
**Current:** Card with star emoji, "Add a repo" text, 2 example buttons
**New:**
- Full hero treatment when empty:
  - Big title
  - Search bar (same one, prominent)
  - "Popular repos" row with 4-5 clickable suggestions
  - Subtle animation or illustration
- When repos load → transitions to compact layout

**Files:** `components/empty-state.tsx`, `components/home-content.tsx`

### 2.2 Popular repos suggestions
Add a row of popular repo suggestions (chips/buttons):
- `facebook/react`, `vercel/next.js`, `shadcn-ui/ui`, `denoland/deno`, `tailwindlabs/tailwindcss`
- Click to auto-add

**Files:** `components/empty-state.tsx`

---

## Phase 3: Visual Polish

### 3.1 Typography & spacing
- Use Geist font consistently (already in deps)
- Tighten vertical spacing between sections
- Add subtle section dividers where needed

### 3.2 Card treatments
- Chart card: subtle border + shadow
- Embed code: code block with copy icon, not a separate section

### 3.3 Dark/light mode polish
- Verify all states look good in both modes
- Theme picker dropdown should show color dots correctly in both

### 3.4 Mobile responsiveness
- Control bar stacks vertically on mobile
- Theme dropdown works well on small screens
- Chart is scrollable/responsive on mobile

---

## Phase 4: Micro-interactions

### 4.1 Loading states
- Skeleton chart while fetching
- Smooth transition when chart data arrives

### 4.2 Transitions
- Smooth collapse of hero when repos load
- Chip add/remove animations

### 4.3 Keyboard shortcuts
- `/` to focus search
- `Esc` to clear search

---

## Implementation Order
1. **Phase 1.1** — Hero + Search merge (biggest impact)
2. **Phase 1.3** — Theme picker dropdown (quick win)
3. **Phase 1.2** — Control bar layout
4. **Phase 1.4 + 1.5** — Chart prominence + export attachment
5. **Phase 2** — Empty state upgrade
6. **Phase 3** — Visual polish pass
7. **Phase 4** — Micro-interactions (optional/later)

## Files touched (estimate)
- `components/hero.tsx` — rewrite
- `components/home-content.tsx` — restructure layout
- `components/theme-picker.tsx` — convert to dropdown
- `components/repo-chips.tsx` — minor layout adjustment
- `components/chart-section.tsx` — card treatment + export integration
- `components/export-bar.tsx` — compact toolbar mode
- `components/empty-state.tsx` — full redesign
- `app/page.tsx` — minor (layout adjustments)
- `app/globals.css` — spacing/typography tokens if needed

## Notes
- No new dependencies needed (shadcn Select already available or easy to add)
- Keep all existing functionality intact
- Don't break URL sharing / embed / OG generation
- Test with 0, 1, 3, and 5 repos to verify all states
