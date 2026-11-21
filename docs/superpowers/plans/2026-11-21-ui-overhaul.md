# UI Overhaul Implementation Plan

> **For agentic workers:** Follow superpowers:executing-plans or focused independent domain delegation. Track verification before completion; do not commit unrelated work.

**Goal:** Deliver a coherent card-focused interface across home, modes, catalog, battle, dialogs and mobile layouts using mature Vue primitives.

**Architecture:** Semantic tokens + existing Vue SFCs, shared Reka AppDialog and CardPreviewDialog, native controls, Lucide icons, async page boundaries. No frontend stack replacement.

**Tech Stack:** Vue3/Vite/Pinia/Tailwind, reka-ui, @lucide/vue.

**Spec:** docs/superpowers/specs/2026-11-21-ui-overhaul-design.md

## Global Constraints

Preserve all V1.9 assets/data, existing backend contract and supported gameplay; no fake data, external fonts, raster UI screenshots or unsupported mode claims. Use real card metadata when concepts contain inaccurate details. No commits or reverting existing work. Root owns shared components/style/App/Home/Select; catalog worker owns only CardGalleryPage.vue; battle worker owns GameBoard/CardView/CardHand/DeployZone/PlayerInfo/BattleLog/ActionPanel/ActionModal.

## Review Focus

Keyboard/focus and touch inspection; stale selection and duplicated loading submissions; 320px overflow with5 slots; missing card data/duplicate mushroom effects; homepage eagerly importing entire catalog. Browser tests verify these.

### Task 1: Shared foundations and entry (root)
- [x] Install mature primitives; add semantic tokens and native control states.
- [x] Create components/ui/AppDialog.vue (modelValue,title,description,wide; default/footer slots), components/CardPreviewDialog.vue (v-model:cardId string|null; complete data lookup and full WebP).
- [x] Generate lightweight card-pack-summary.generated.ts for homepage faction/version/showcase data without eager full catalog.
- [x] Rebuild PageHeader/Home/Select, lazy page imports and clear loading/error states in App.

### Task 2: Full catalog (catalog worker)
- [x] Rebuild CardGalleryPage.vue to the concept with full existing data, Reka Tabs and native filters/search/sort.
- [x] Use shared CardPreviewDialog; show complete content for all6 tabs and useful empty results.
- [x] Keep WebP thumbs, semantic controls and compact mobile layout. Do not modify data or shared components.

### Task 3: Play surface (battle worker)
- [x] Rebuild owned component styling to tokens and battle concept while preserving all events, props and action flow.
- [x] Replace hover-only inspection with independent native select/inspect controls and shared CardPreviewDialog.
- [x] Replace ActionModal/gameover overlays with shared AppDialog; native keyboard selection buttons, alt text, loading controls.
- [x] Keep5 slots, readable scrolling hand, small-screen guides/log flow and reduced motion.

### Task 4: Integration and evidence (root)
- [x] Build app, repair integration, test real flows and accessibility with Playwright plus axe where useful.
- [x] Inspect concept and rendered screenshots; revise three weakest concrete issues.
- [x] Verify mobile/tablet/desktop, WebP requests, no framework overlay/errors, and initial bundle split.
- [x] Independent code review, final builds/tests, document source-backed choices and measured limitations.
