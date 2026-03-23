# RepoStars Design Refresh Plan

## Goal
Refresh the overall product design of RepoStars **without changing the charts themselves**.

Charts are already the strongest part of the product. This redesign should improve:
- first impression
- information hierarchy
- controls discoverability
- visual polish
- mobile usability
- product identity

## Non-Goals
Do **not** change:
- chart rendering logic
- chart data logic
- theme math for charts
- repo loading/parsing behavior
- OG/embed API behavior

This is a **shell / UX / visual design** refresh, not a chart rewrite.

---

## Design Direction
### Recommended direction
**Modern devtool shell with subtle retro accents**

Why:
- keeps charts feeling serious and trustworthy
- avoids looking like generic shadcn demo UI
- lets the 8-bit theme remain special instead of making the whole app gimmicky
- fits GitHub analytics / builder audience better

### Core visual principles
- Clean, compact, confident
- Fewer stacked sections
- Stronger grouping of related controls
- Better empty state storytelling
- Clear “main action area” above chart
- Better desktop/mobile action ergonomics

---

## Current UX Issues
1. **Hero is too weak**
   - currently reads like a subtitle, not a product intro
   - doesn’t establish purpose quickly

2. **Controls are fragmented**
   - search, chips, theme, share/export feel separated
   - users must scan too much vertically

3. **Theme picker is buried**
   - looks like a secondary setting, but it is a core product feature

4. **Share/export is too hidden**
   - dropdown hides important actions
   - poor discoverability for a product that should encourage sharing

5. **Empty state feels placeholder-ish**
   - functional, but not productized

6. **Shell feels default**
   - layout works, but it lacks identity and premium feel

---

## Target UX Structure

### 1. Product Header / Hero
Replace the current weak intro with a compact, productized hero.

#### Content structure
- product name / small brand mark
- H1: “Compare GitHub star history beautifully”
- one-line supporting copy
- search bar directly underneath
- quick-add example repos

#### Behavior
- when no repos: full hero state
- when repos exist: hero collapses into compact search state

#### Why
This makes onboarding instant and gives the tool a clearer identity.

**Files:**
- `components/hero.tsx`
- `components/home-content.tsx`

---

### 2. Unified Top Control Bar
Create a single control bar above the chart.

#### Left side
- repo chips
- optionally repo count / comparison state

#### Right side
- theme dropdown
- visible action buttons (not dropdown-based)

#### Why
Everything needed to interact with the product should live in one place.

**Files:**
- `components/home-content.tsx`
- `components/repo-chips.tsx`
- `components/theme-picker.tsx`
- `components/export-bar.tsx`

---

### 3. Share / Export Actions Redesign
Replace the current dropdown-only share experience.

#### Desktop behavior
Show labeled buttons:
- **PNG**
- **Copy URL**
- **Share X**
- **Embed**

#### Mobile behavior
Show icon-only buttons:
- image/download icon
- link icon
- X icon
- code/embed icon

#### Interaction details
- keep handlers from current `ExportBar`
- show temporary success states:
  - “Copied” for URL/embed
- tooltips on mobile icons
- actions visible in same control cluster as theme dropdown

#### Why
These are primary actions and should not be hidden.

**Files:**
- `components/export-bar.tsx`
- `components/home-content.tsx`

---

### 4. Theme Picker Refresh
Convert theme picker from a row of buttons to a more polished control.

#### New UI
- compact dropdown / select
- current theme shown with color swatch
- each option includes small color preview
- optionally separate “8-bit” as a featured theme

#### Why
The current row takes too much space and competes with repo chips.

**Files:**
- `components/theme-picker.tsx`

---

### 5. Chart Container Polish
Keep chart internals unchanged, but redesign the framing around them.

#### New shell
- chart inside a premium card/container
- clearer top spacing
- cleaner background separation
- subtle shadow/border treatment
- optional small title row above chart:
  - “Star history comparison”
  - repo count / time range note

#### Why
Charts already look good; presentation around them needs to catch up.

**Files:**
- `components/chart-section.tsx`
- `components/home-content.tsx`

---

### 6. Better Empty State
Redesign empty state to feel like a product landing experience.

#### New empty state should include
- strong title
- search-first layout
- quick-add repo pills
- short line explaining what RepoStars does
- mention “compare up to 5 repos”
- mention themes/share capability subtly

#### Suggested quick-add repos
- `shadcn-ui/ui`
- `vercel/next.js`
- `facebook/react`
- `tailwindlabs/tailwindcss`
- `47ng/nuqs`

#### Why
Empty states are onboarding moments, not placeholders.

**Files:**
- `components/empty-state.tsx`
- `components/home-content.tsx`

---

### 7. Visual System Polish
Improve the overall feel without overdesigning it.

#### Changes
- stronger typography hierarchy
- less dead vertical spacing
- better chip styling
- improved button grouping
- more intentional muted backgrounds
- subtle borders instead of default block stacking
- cleaner footer styling

#### Why
The app should feel like a product, not assembled blocks.

**Files:**
- `app/page.tsx`
- `app/layout.tsx` (if needed)
- `app/globals.css` (light polish only)
- `components/footer.tsx`
- UI shell components as needed

---

## Mobile UX Requirements
This redesign must improve mobile significantly.

### Mobile rules
- control bar stacks cleanly
- action buttons collapse to icon-only
- chips wrap without breaking layout
- theme control remains visible and easy to tap
- search stays high on the page
- no hidden critical actions below the fold

### Specific mobile priorities
- zero overflow
- no multi-row chaos in action area
- preserve fast compare flow

---

## Desktop UX Requirements
Desktop should feel more like a polished analytics tool.

### Desktop rules
- strong horizontal rhythm
- clear left/right control grouping
- chart gets most of the space
- actions visible at a glance
- less vertical scrolling before reaching chart

---

## Implementation Phases

### Phase A — Structural Refresh
**Goal:** Reorganize layout without changing behavior.

Tasks:
- merge/upgrade hero and search area
- create unified control bar
- move theme + share controls into one cluster
- attach export bar visually to chart area

**Files:**
- `components/hero.tsx`
- `components/home-content.tsx`
- `components/chart-section.tsx`

---

### Phase B — Action UX Refresh
**Goal:** Make sharing/exporting visible and faster.

Tasks:
- replace share dropdown with inline buttons
- desktop labels, mobile icons
- add copied states and tooltips

**Files:**
- `components/export-bar.tsx`
- `components/home-content.tsx`

---

### Phase C — Theme & Empty State Refresh
**Goal:** Improve discoverability and onboarding.

Tasks:
- convert theme buttons to dropdown
- redesign empty state with quick-add repos
- improve first-run messaging

**Files:**
- `components/theme-picker.tsx`
- `components/empty-state.tsx`

---

### Phase D — Visual Polish Pass
**Goal:** Make the app feel premium and cohesive.

Tasks:
- spacing cleanup
- card shell polish
- footer polish
- typography hierarchy
- hover/focus states
- mobile refinements

**Files:**
- `app/page.tsx`
- `components/footer.tsx`
- `app/globals.css`
- supporting UI components

---

## Suggested UI Changes by Component

### `components/hero.tsx`
- current: weak subtitle only
- target: actual product intro with search-first emphasis

### `components/home-content.tsx`
- current: stacked sections
- target: search → control bar → chart card → footer flow

### `components/export-bar.tsx`
- current: dropdown + separate embed section
- target: compact inline action buttons

### `components/theme-picker.tsx`
- current: button row
- target: dropdown/select with swatches

### `components/empty-state.tsx`
- current: card with small examples
- target: onboarding-first hero state

### `components/repo-chips.tsx`
- refine visual density, spacing, and remove-button clarity

### `components/footer.tsx`
- lighten visual weight, better integration with page

---

## Success Criteria
The redesign is successful if:
- users understand what the tool does immediately
- adding repos feels like the central action
- theme + share/export are visible without hunting
- chart remains the centerpiece
- empty state feels intentional
- product looks less generic and more ownable
- mobile UX is clearly better than before

---

## Validation Checklist
- [ ] 0 repos state looks intentional
- [ ] 1 repo state feels balanced
- [ ] 3–5 repo state still looks clean
- [ ] theme picker works on mobile and desktop
- [ ] export/share actions are visible and understandable
- [ ] no layout overflow on mobile
- [ ] chart visuals unchanged
- [ ] `pnpm check`
- [ ] `pnpm build`

---

## Recommended Next Step
Start with:
1. **inline actions + theme cluster**
2. **hero/search restructure**
3. **empty state redesign**

That gives the biggest UX improvement fastest without touching chart logic.
