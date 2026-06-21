# PLAN_STATE.md — GymLog Feature Set

**Integration branch:** `claude/gymlog-feature-set`
**Authoritative remote:** https://github.com/TrayBanks/gymlog
**Rule that cannot be relaxed:** No agent merges/pushes to `main` without explicit user approval in chat.

This file + `git log --oneline -10` on the integration branch are the two
required state channels. If they disagree, STOP and report.

---

## Phase 1 Findings (verified against actual code, not the prompt's snapshot)

| Claim in prompt | Verified state |
|---|---|
| Home view `#log` with active workout | ✅ `index.html:334` — contains `#activeWorkout` + `#noWorkout` empty state |
| Paste entry → `#pasteModal` with nested `#savedPlansSection` | ✅ `index.html:381` modal, `:384` nested saved-plans section (`display:none` until plans exist) |
| Gym mode = overlay `#gymOverlay`, `openGymMode()`/`closeGymMode()` | ✅ `:425`, `:682`, `:700` |
| Gym overlay has its OWN scroll container | ✅ `.gym-main` (`:173`) is `flex:1;overflow-y:auto`; `.gym-header` (`:153`) is `flex-shrink:0` ABOVE it → **gym timer is ALREADY pinned** relative to gym scroll context |
| `_done` per set | ✅ EXISTS. **READ** by normal render (`:657` opacity:.5), **READ+WRITTEN** only by gym mode (`:774`). **No normal-mode control writes `_done`.** New sets don't init it (undefined→falsy). |
| Settings/theme/wakeLock keys | ✅ NONE exist — all net new |
| localStorage keys | `gymlog_workouts`, `gymlog_exercises`, `gymlog_plans` (`:456-458`); settings key is NEW |

### Critical determinations
- **Feature 4 (check-off) = new UI on EXISTING state**, not new state. `_done` already
  exists, is already read by both renderers, and is already written by gym mode. Step 4
  adds a normal-mode write control + condensed/struck-through styling, in both modes.
- **Feature 3 (pinned timer): gym mode is already pinned.** The real work is normal mode,
  where `.workout-timer` currently scrolls away with the page. Gym-mode work = verify + keep.
- **Feature 5 dependency on Feature 4 is SOFT, not hard.** Historical `gymlog_workouts`
  entries *already* carry `_done=true` for any sets completed via gym mode, so Feature 5 can
  read existing completion data even before Feature 4 ships. Feature 4 matters because it lets
  users populate the completed/attempted distinction reliably in BOTH modes going forward, and
  it generates clean test data for Feature 5. Sequencing 5 after 4 stands; the dependency is
  one of data-quality/sequencing, not compilation.
- In-progress `current` workout is in-memory only (not persisted until `finishWorkout`).
  `_done` on the active workout lives in `current` and only durably lands in history on finish.

---

## Plan (5 steps → 5 features) — user chose to split F2/F3

| Step | Feature | Status |
|------|---------|--------|
| 1 | F1 — Settings panel (wake-lock toggle, light/dark theme), new `gymlog_settings` key | ✅ verified |
| 2 | F2 — Saved plans onto `#log` home (idle/no-workout state) | ✅ verified |
| 3 | F3 — Persistent pinned workout timer (both modes) | auditing |
| 4 | F4 — Set completion check-off (new UI on existing `_done`, both modes) | not started |
| 5 | F5 — Running last-weight/sets memory (completed vs attempted), both modes | not started |

Order rationale:
- **Step 1 first** because the theme system refactors global `:root` CSS vars; landing it first
  means every later step is built against a theme-aware baseline (no rework).
- **Steps 2 & 3** both touch the `#log` view but in mutually-exclusive states (idle = saved
  plans; active = pinned timer); split per user request, run F2 then F3.
- **Step 4** before **Step 5** per the soft dependency above.

## Locked decisions (user-approved, Phase 1)
1. **Gym mode stays always-dark** even under light theme. Theme affects the normal app only.
2. **Saved plans show in the idle / no-workout state** on `#log`; hidden while a workout is active.
3. **5 steps** (F2 and F3 are separate steps).

---

## Step Log
### Step 1 — Settings panel (F1)
- Status: ✅ VERIFIED by orchestrator (gate passed). Outstanding: 3 live-browser checks
  deferred to the final preview pass — (1) light theme visual render, (2) no-flash on cold
  reload, (3) real wakeLock grant/release/re-acquire on localhost. These are live-only, not
  logic defects.
- Commits:
  - `7b91710` [step 1] add settings modal with theme + wake lock
  - `f7ed8e4` [step 1] bump sw cache to v6
- Diff summary:
  - `sw.js`: `CACHE_NAME` `gymlog-v5` → `gymlog-v6`.
  - `index.html`:
    - New `<head>` inline script (before `<style>`) applies `data-theme="light"`
      from `gymlog_settings` BEFORE first paint (no flash). Dark = default (no attr).
    - New `:root[data-theme="light"]{…}` palette (light bg/surface/card, dark text,
      adjusted muted/border/warmup; `--primary` purple kept). Drives header, nav,
      cards, modals, stats, forms, FAB, plans — all via existing CSS vars.
    - Header: gear `icon-btn` next to Export → `openSettings()`.
    - New `#settingsModal` (reuses `.modal-overlay`/`.modal`): Theme segmented
      control (Light/Dark) + Keep-screen-awake toggle switch. New CSS:
      `.icon-btn`, `.settings-row`, `.switch`, `.theme-seg`.
    - New JS: `SETTINGS_KEY='gymlog_settings'`; `loadSettings()/saveSettings()`
      (separate from `save()`, which still writes workouts/exercises/plans);
      `applyTheme()/setTheme()`; `acquireWakeLock()/releaseWakeLock()/toggleKeepAwake()`
      with `WAKE_SUPPORTED = 'wakeLock' in navigator` feature-detection;
      `syncSettingsUI()`, `openSettings()/closeSettings()`.
    - Init: `applyTheme()` + `syncSettingsUI()` + acquire wake lock if enabled +
      `visibilitychange` listener that re-acquires the lock when the page becomes
      visible AND `keepAwake` is on.
- Worker verification (gym open / gym closed):
  - GYM CLOSED: Settings reachable via header gear; toggling theme to Light recolors
    `#log`/history/stats/modals/FAB via the shared CSS vars; persists across reload
    (head script applies before paint → no dark flash); Dark restores. Verified by
    code trace + a node simulation of loadSettings/saveSettings/applyTheme/setTheme:
    defaults {theme:dark,keepAwake:false}; setTheme('light') sets attr + persists
    `{"theme":"light",…}`; setTheme('dark') removes attr + persists; reload of a
    persisted `{light,keepAwake:true}` loads back correctly.
  - GYM OPEN: gym mode CSS (`#gymOverlay` and children) uses hardcoded near-black
    `#020408` / brand `#6C63FF` etc. — grep confirms NO `var(--bg/--surface/--card/
    --text/--border)` inside the gym block, so switching to light theme leaves gym
    mode dark/high-contrast and fully functional (set-done, rest timer, pips, exit
    all unaffected). Theme attr lives on `documentElement`; gym overlay simply doesn't
    consume the themed vars. Locked decision (gym always-dark) upheld.
- WAKE LOCK CAVEAT (observed/known): Screen Wake Lock requires a secure context.
  On the preview `http://localhost:4000` it IS a secure context, so the toggle is
  enabled and `navigator.wakeLock.request('screen')` is expected to succeed (could
  not click in a real browser in this env — no headless Chrome — so acquisition was
  validated by code trace + node simulation of acquire/release/re-acquire, not a live
  grant). On non-secure origins or unsupported browsers, `WAKE_SUPPORTED` is false →
  the toggle is disabled and the description shows a "needs HTTPS or localhost" note;
  `request()` rejections are caught and leave state consistent. The OS may also drop
  the lock on low battery; the `release` event handler resets `wakeLock=null` so a
  later visibilitychange can re-acquire.
- Auditor findings: PASS — Theme + wake lock are correct, additive-only (165 insertions / 0 deletions in index.html), gym mode isolation upheld, cache bumped. No blocking issues; outstanding items are live-browser checks only.
  Confirmed:
  - Theme completeness: light block (`index.html:34-42`) overrides every surface var
    consumed by the normal app — body/bg (`:43`), header (`:44`), nav (`:77-79`),
    `.workout-card` (`:85`), `.exercise-block` (`:105`), `.modal-overlay`/`.modal`
    (`:125-128`, modal bg=`var(--bg)`), `.stat-box` (`:132`), form inputs (`:95,101`),
    `.fab` (`:119`), `.plan-item` (`:174`), `.day-picker-item` (`:154`), `.workout-timer`
    (`:160`). No normal-app element hardcodes a dark surface/text color. The only
    `color:#fff` outside gym (`:49,50,74,119`) sits on colored (`--primary`/`--danger`)
    backgrounds → correct in both themes.
  - Contrast (computed WCAG): text `#1e2433` on bg/surface/card = 14.2/15.5/13.6:1 (AAA);
    muted `#64708a` = 4.36–4.97:1 (AA); primary `#6C63FF` on white & white-on-primary =
    4.32:1 (AA); warmup `#b45309` on bg = 4.61:1 (AA). Nothing unreadable.
  - No-flash: head inline script (`:12-21`) runs before `<style>`/body, sets
    `data-theme="light"` from `gymlog_settings`. Robust to absent/empty/corrupt/wrong-type
    key (try/catch + `s && s.theme==='light'` short-circuit) — node-simulated all cases →
    default dark, never throws. `--radius` correctly inherits from base `:root` (not
    redefined in light block).
  - Wake Lock LOGIC sound: `WAKE_SUPPORTED='wakeLock' in navigator` (`:586`); acquire on
    enable & release on disable (`toggleKeepAwake`, `:617`); re-acquire on
    `visibilitychange` when visible AND `keepAwake` (`:1328`); `request()` rejection
    `.catch`'d → state stays consistent (`:594`); `release` event resets `wakeLock=null`
    so a later re-acquire works; unsupported → toggle disabled + explanatory note
    (`syncSettingsUI`, `:599-608`). Cannot live-grant in this env (no headless browser).
  - State isolation: `saveSettings()` writes ONLY `gymlog_settings`; `save()` (`:558-562`)
    writes ONLY workouts/exercises/plans. No overlap → settings cannot clobber workout data.
  - Gym parity (LOCKED always-dark): gym CSS block (`:184-356`) and gym render JS
    (`:865`) use ONLY hardcoded colors (`#020408`, `#6C63FF`, `#333`, etc.) — grep
    confirms ZERO `var(--bg/--surface/--card/--text/--border/--muted)` in the gym range.
    Theme attr lives on `documentElement`; gym overlay consumes none of the themed vars,
    so switching to light cannot alter gym mode whether it is open or closed.
  - Regression: diff is 165 insertions / 0 deletions in index.html (only removed line in
    the whole change is the sw.js CACHE_NAME). No existing function, signature, or shared
    global modified; header change is additive markup. Start-workout/timer/paste/plans/
    gym/history/stats/export untouched.
  - Cache: `sw.js` `gymlog-v5` → `gymlog-v6` (`f7ed8e4`); nothing else in sw.js changed.
    Preview on :4000 serves the new code (settingsModal present) and v6.
  Non-blocking notes / what a node sim CANNOT prove (left for real-browser check at preview):
  - Live visual rendering/contrast under an actual light-theme paint (computed ratios are
    strong, but real device rendering unverified).
  - Real "no dark flash" on a cold reload (logic guarantees pre-paint apply; not observed live).
  - Real `navigator.wakeLock.request('screen')` GRANT on localhost and RELEASE on toggle-off
    / re-acquire on tab-return — logic is correct by read; no headless browser to click it.
- NOTE for auditor: (1) confirm in a real browser that Light theme is fully readable
  across every surface and that there is genuinely no dark flash on reload; (2) live-
  verify wakeLock actually grants on localhost and releases on toggle-off; (3) re-confirm
  gym mode stays dark when theme is switched WHILE gym mode is open.

### Step 2 — Saved plans on home, idle state (F2)
- Status: ✅ VERIFIED by orchestrator (gate passed). Outstanding: live render of the home plans
  area + the from-home multi-day day-picker open/close visuals — deferred to final preview pass.
- Commits:
  - `d71b79f` [step 2] render saved plans on home idle view; remove plans list from paste modal
  - `4b891f6` [step 2] bump sw cache to v7
- PASTE-MODAL DECISION: **REMOVED** the saved-plans block from the paste modal
  (the recommended cleaner option). Plans now live in exactly one place — home.
  The paste modal keeps only: intro text + example + textarea + Load Workout /
  Save Plan / Cancel buttons + the multi-day day-picker area. No empty/leftover
  saved-plans container remains in the modal.
- Diff summary (15 insertions / 17 deletions in index.html; sw.js +1/-1):
  - `index.html`:
    - NEW `#homePlansSection.plans-section` (with `#homePlansList`) placed inside
      `<div id="log">`, ABOVE `#noWorkout` (`index.html:379-382`), `display:none`
      by default. Reuses the EXISTING `.plans-section` / `.plans-section-header` /
      `.plan-item` CSS (all `var(--…)` driven → theme-correct in light & dark; no
      hardcoded colors added).
    - REMOVED the nested `#savedPlansSection` block (header + `#savedPlansList` +
      `<hr class="modal-divider">`) from `#pasteModal`.
    - RENAMED `renderPlansInModal()` → `renderHomePlans()`; repointed to
      `#homePlansSection`/`#homePlansList`; changed the guard from
      `plans.length===0` to **`current || plans.length===0`** so it hides during an
      active workout AND when no plans exist. Card markup (Load + 🗑 delete, name,
      meta) unchanged — same `.plan-item` template, same `loadPlan(id)` /
      `deletePlan(id)`.
    - `renderActive()` now calls `renderHomePlans()` at the top (before the
      `!current` early-return) so EVERY state transition re-evaluates plan
      visibility (start/finish/cancel workout, add/remove set, load-from-paste).
    - `loadPlan()` multi-day branch: replaced the now-defunct
      `#savedPlansSection` hide with `pasteModal.classList.add('open')` so a
      multi-day plan loaded FROM HOME opens the modal that hosts the day-picker
      (previously the modal was already open because plans lived inside it).
    - Removed the `renderPlansInModal()` calls from `openPasteModal()` and
      `backToPasteInput()` (nothing to render in the modal anymore) and the
      stale `#savedPlansSection` hide from `showDayPicker()` and the
      `renderPlansInModal()` call from the `loadWorkoutFromPaste()` error branch.
    - `savePlan()` / `deletePlan()` now call `renderHomePlans()` (so a newly
      saved plan is on home the moment the modal closes; a deletion updates home
      and hides the section at zero).
  - `sw.js`: `CACHE_NAME` `gymlog-v6` → `gymlog-v7`.
- Verification (no headless browser in env — rigorous code trace + node simulation
  of the visibility predicate and a syntax-parse of both inline `<script>` blocks;
  preview server on :4000 confirmed serving the new code, `homePlansSection`
  present / `savedPlansSection` absent, sw `gymlog-v7`):
  - Visibility predicate `current||plans.length===0 ? hide : show` simulated for all
    4 states → idle+plans=SHOWN, idle+no-plans=HIDDEN, active+plans=HIDDEN,
    active+no-plans=HIDDEN. Matches the locked decision exactly.
  - Item-3 scenarios (all traced through `renderActive`→`renderHomePlans`):
    Idle+plans → visible on home ✓. Idle+no-plans → section hidden, no clutter ✓.
    Active workout → hidden ✓. Save new plan via modal (idle) → `renderHomePlans`
    populates section behind modal; visible after close ✓. Delete from home →
    list re-renders; hits zero → section hides ✓. Load from home: single-day →
    `loadWorkoutFromPaste` starts workout (sets `current`, `renderActive` hides
    plans) ✓; multi-day → opens paste modal + `showDayPicker` → `pickDay` →
    `loadWorkoutFromPaste` ✓.
  - GYM CLOSED + idle → plans on home (predicate SHOWN). PASS.
  - GYM OPEN chain: gym mode only opens with an active workout, at which point
    `current` is set so home plans are ALREADY hidden. `openGymMode`/`closeGymMode`
    never touch `#homePlansSection`; `closeGymMode` calls `renderActive` (still
    active → stays hidden). `finishWorkout`/`cancelWorkout` both `closeGymMode()`
    if the overlay is open, null `current`, then `renderActive` → plans reappear.
    No plan list bleeds into the active or gym overlay views. PASS (both modes).
  - Both inline script blocks parse via `new Function()`; no stale references to
    `renderPlansInModal`/`savedPlansSection`/`savedPlansList` remain (grep clean).
- Auditor findings: PASS — Plans correctly moved to the idle home state only; zero dangling
  refs to the removed modal section; every `current` mutation re-renders home plans; both
  day-picker entry points work; diff is tightly scoped (14 ins / 16 del in index.html).
  Confirmed:
  - DANGLING-REF GREP (highest risk): ZERO matches for `savedPlansSection` /
    `savedPlansList` / `renderPlansInModal` anywhere in index.html. All five old call
    sites (`openPasteModal`, `backToPasteInput`, `showDayPicker`, `loadPlan` multi-day,
    `loadWorkoutFromPaste` error branch) are clean — no `getElementById('savedPlansSection')`
    survives, so no null-`.style` throw. New IDs `homePlansSection`/`homePlansList` and
    `renderHomePlans()` resolve consistently (`:379-382`, `:762`, `:1149`, `:1157`, `:1175-1177`).
  - Idle-only visibility predicate (`:1179`): `if (current || plans.length===0) hide; else show`.
    Node-simulated all 4 states → idle+plans=SHOW, idle+no-plans=HIDE, active+plans=HIDE,
    active+no-plans=HIDE. Matches the locked decision exactly.
  - Every `current` mutation funnels through `renderActive()` (which calls `renderHomePlans()`
    at `:762`, BEFORE the `!current` early-return so it always runs): `startWorkout` (`:690`),
    `finishWorkout` both branches (`:695`, `:703`), `cancelWorkout` (`:711`),
    `loadWorkoutFromPaste` (`:1312`), `closeGymMode` (`:859`). No path mutates `current`
    without re-rendering. Plans hide on start/load and reappear on finish/cancel.
  - Multi-day day-picker, BOTH entry points:
    (a) FAB → `openPasteModal` resets areas + opens modal → `submitPaste` multi-day (`:1238-1239`)
        sets `_pendingDays` + `showDayPicker`. ✓
    (b) From home → `loadPlan` multi-day (`:1166-1169`) sets `_pendingDays`, force-opens modal
        via `classList.add('open')` (same overlay that hosts `#dayPickerArea`), then
        `showDayPicker`. `showDayPicker` (`:1250-1251`) itself hides `#pasteInputArea` / shows
        `#dayPickerArea`, so the picker renders regardless of prior area state. `pickDay`
        (`:1264-1266`) → `loadWorkoutFromPaste`. Back (`:1212`) / Cancel (`:1207`) reset cleanly.
    FAB-after-home: a subsequent `openPasteModal()` resets `#pasteInputArea` visible /
    `#dayPickerArea` hidden (`:1200-1201`) → input area shown, NOT stuck on the picker. ✓
  - Save/delete/load wiring: `savePlan` (`:1149`) and `deletePlan` (`:1157`) call
    `renderHomePlans()` → new plan appears on home after modal closes; delete re-renders and
    hides section at zero. Single-day load → `loadWorkoutFromPaste` starts workout. All target
    functions exist and point at the home IDs.
  - Theme: home plans reuse the existing var-driven CSS — `.plan-item` (`:174`,
    `--surface`/`--border`/`--radius`), `.plans-section-header` (`:173`, `--muted`),
    `.plan-meta` (`:177`, `--muted`); delete-button inline color is `var(--danger)` (`:1188`).
    No hardcoded color added; correct in light & dark.
  - Regression scope: 14 ins / 16 del in index.html, all within the plans-move; nothing else
    (timer, gym mode, Step-1 settings/theme, history, stats, export) touched. No function
    signature or shared global changed — `renderPlansInModal`→`renderHomePlans` was internal,
    now zero callers reference the old name. Both inline `<script>` blocks parse via
    `new Function()`.
  - Cache: `sw.js` `gymlog-v6` → `gymlog-v7` (`4b891f6`); +1/-1, nothing else in sw.js changed.
  - Preview on :4000 serves HTTP 200, the new code (`homePlansSection` present /
    `savedPlansSection` absent = 0), and `gymlog-v7`.
  Non-blocking notes / unverifiable without a live browser (no headless Chrome in env):
  - Real DOM render of the home plans area (idle) and its light/dark paint — CSS is shared and
    unchanged, computed-correct, but live paint not observed.
  - Real modal open/close visuals for the from-home multi-day path (logic + parse verified;
    actual on-screen open/picker-render/Back-Cancel transitions not clicked live).
  - These are live-only confirmations, not logic defects → PASS-with-notes.
- NOTE for auditor: scrutinize (1) the MULTI-DAY day-picker path when a multi-day
  plan is loaded FROM HOME — `loadPlan` now force-opens `#pasteModal` before
  `showDayPicker`; verify the modal opens cleanly, the picker renders, Back/Cancel
  reset correctly, and a subsequent FAB `openPasteModal` still shows the input
  area (it resets both areas). (2) The idle↔active show/hide transition relies
  solely on `renderActive` calling `renderHomePlans`; confirm no path mutates
  `current` or workout content without going through `renderActive`. (3) Confirm
  in a real browser the home plans render correctly in BOTH light and dark themes
  (CSS is shared `var(--…)`, unchanged, but live paint not observed here).

### Step 3 — Persistent pinned workout timer (F3)
- Status: auditing
- Commits:
  - `2f58ea2` [step 3] pin active workout timer with sticky positioning
  - `f9bb199` [step 3] bump sw cache to v8
- Diff summary (4 ins / 2 del in index.html incl. comment; sw.js +1/-1):
  - `index.html`: ONE CSS rule changed — `.workout-timer` (`:164`) gained
    `position:sticky; top:calc(71px + var(--safe-top)); z-index:5` (prepended;
    everything else — `background:var(--surface)`, border, padding, margin-bottom,
    flex layout — unchanged). Added an explanatory CSS comment above the rule.
    NO JS change: `renderActive()` still emits the same `.workout-timer` markup with
    `#workoutTimer` intact; the `startTimer()` interval (`:642`, updates `#workoutTimer`
    `:647` and `#gymOverallTimer` `:649`) is untouched.
  - `sw.js`: `CACHE_NAME` `gymlog-v7` → `gymlog-v8`.
- POSITIONING APPROACH + REASONING:
  - Chose **`position:sticky` on the existing `.workout-timer` card** (least invasive:
    one CSS rule, no DOM/JS restructure, no new wrapper). Rejected alternatives:
    `position:fixed` (would need manual width/left math against the 16px `.view` padding
    and breaks out of normal flow, leaving a collapse/jump where the card was) and
    restructuring `#log` into its own flex scroll container (large, risks regressing
    Step 2's home-plans idle layout and the body-level sticky header). Sticky keeps the
    card in normal flow so layout above/below is unaffected; it simply "catches" at the
    offset once scrolled to.
  - **What pins:** ONLY the timer bar. The Discard/Finish action row (above it) and the
    GYM MODE button + exercises (below it) scroll normally. Decision: keep the pinned
    element compact so it never eats a small phone's screen; the timer is the one thing
    that must stay glanceable. Discard/Finish are deliberate actions, fine to scroll to.
- HEADER-OFFSET / SAFE-AREA HANDLING:
  - Body is the scroll container; `header` is `position:sticky;top:0;z-index:10` (`:44`)
    with `padding:16px 20px; padding-top:calc(16px + var(--safe-top))` and a 1px
    `border-bottom`. Its tallest content-row child is the gear `.icon-btn` at 38px
    (`:54`; Export `.btn-sm`=36px `:52`, h1≈24px) → header height (excluding inset) =
    16 + 38 + 16 + 1 = **71px**, ON TOP OF the `safe-top` the header adds via padding-top.
  - Sticky `top:calc(71px + var(--safe-top))` therefore lands the timer's top edge flush
    with the header's bottom edge: no gap, no hide-under-header. `--safe-top` is counted
    once here (the header counts it once in its own padding; these are two different boxes,
    not a double-count) so on Fold 5 cover / notched phones the timer drops by exactly the
    inset, same as the header. On a non-inset display `--safe-top`=0 → `top:71px`, still flush.
  - **Stacking:** timer `z-index:5` < header `z-index:10`, so if sub-pixel rounding ever
    let them touch, the timer tucks UNDER the header (correct), never over it. Because the
    offset equals the header height they don't actually overlap in normal cases.
  - **Background / see-through:** the card keeps its opaque `var(--surface)` fill + 1px
    `var(--border)` (solid in BOTH light `#ffffff` and dark `#1e293b`), so exercise rows
    scrolling behind it are fully covered — no content bleed. Content lives in the same
    16px-padded `.view` column as the card, so nothing renders in the side gutters either;
    the only thing ever visible in the flush strip is `var(--bg)`, and there is no strip
    when offset==header height.
  - **Small screen:** `@media(max-width:380px)` (`:351`) only overrides `.workout-timer`
    padding (10px 12px); it does NOT touch position/top/z-index, so sticky still applies on
    narrow phones. Card height shrinks (smaller padding + 1.8rem timer value `:346`) → less
    screen eaten while pinned.
- GYM MODE (verify + keep, per Phase 1):
  - Gym CSS block (`:184-356`) is NOT in the diff. `.gym-header` (`:193`, `flex-shrink:0`,
    contains `#gymOverallTimer`) still sits ABOVE `.gym-main` (`:213`, `flex:1;overflow-y:auto`)
    inside `#gymOverlay` (`flex-direction:column`). The gym overall timer remains pinned in
    the gym's OWN scroll container — unchanged. My normal-mode sticky rule only affects
    `.workout-timer`, which does not exist inside the gym overlay (gym renders its own markup).
    The `#gymOverallTimer` id and its interval update are untouched.
- Worker verification (no headless browser in env — rigorous CSS/stacking reasoning + offset
  math + served-code check; LIVE scroll behavior is a real-browser check to confirm at preview):
  - GYM CLOSED (normal mode): With a long active workout (several exercises/sets), scrolling
    the body scrolls the action row out under the header; the `.workout-timer` catches at
    `top:calc(71px + safe-top)` = exactly the header's bottom, staying visible. It does not
    hide under the header (offset == header height) and does not cover the first exercise
    (the first exercise block sits BELOW the timer in flow + the timer's 12px margin-bottom;
    sticky doesn't change document flow, so on initial unscrolled view the first exercise is
    exactly where it was). Opaque themed background → no content bleed. Light & dark both use
    var-driven surface/border → correct. PASS by reasoning; live scroll = preview confirm.
  - GYM OPEN: open gym mode (only possible with an active workout); `.gym-main` scrolls if
    tall, `.gym-header`/`#gymOverallTimer` stay pinned (pre-existing, untouched). My change
    is not present in the gym overlay. `openGymMode`/`closeGymMode` unaffected; `closeGymMode`
    → `renderActive` re-emits the same sticky `.workout-timer`. PASS (both modes), no regression.
  - Served-code check: preview on :4000 serves the working tree → confirmed serving
    `position:sticky;top:calc(71px + var(--safe-top))` in index.html and `gymlog-v8` in sw.js.
- Auditor findings: PASS — Sticky timer is correct at default font size; diff is one CSS rule
  (`.workout-timer`, `index.html:164`) + cache bump; ancestor chain has NO overflow so sticky
  WILL catch; safe-area math is flush (no double-count); stacking, opacity, gym isolation all
  correct. ONE non-blocking robustness note on the hardcoded 71px (fragile only above ~150%
  accessibility font zoom). No blocking issues.
  Confirmed:
  1. **71px offset — correct NOW.** Header (`index.html:44`) is `display:flex;align-items:center`,
     `padding:16px 20px; padding-top:calc(16px+safe-top)`, `border-bottom:1px`. Children: `<h1>`
     (`:367`, font 1.3rem ≈ 25px line box) and a div holding Export `.btn-sm` (`:52`,
     min-height:36px) + gear `.icon-btn` (`:54`, height:38px + min-height:38px). Tallest content =
     gear 38px. Header rendered height (excl inset) = 16+38+16+1 = **71px EXACT** (verified by
     node math at default 16px root). The gear's 38px > h1's ~25px line box > Export's 36px, so
     the gear genuinely dominates. Offset is correct; timer lands flush, no overlap, no gap.
  2. **Safe-area — NO double-count, no off-by-safe-top.** Header is sticky `top:0`; its rendered
     bottom edge = `(16+safe-top)+38+16+1 = 71+safe-top` from the viewport top. Timer
     `top:calc(71px+safe-top)` catches its top edge at exactly `71+safe-top`. Node-modelled
     safe-top ∈ {0,24,47,59} → gap = 0px FLUSH in every case. Worker's "two different boxes, not
     a double-count" claim is CORRECT.
  3. **Stacking — correct.** Full z-index inventory: header=10 (`:44`), FAB-group=20 (`:118`),
     modal-overlay=50 (`:125`), gym overlay=100 (`:191`), timer=**5** (`:164`). Timer 5 < header
     10 → tucks UNDER the header (never over). Nothing else inside `#log`/`#activeWorkout` flow is
     positioned or has a competing z-index (the only sticky/fixed elements are header, FAB,
     modal-overlay, gym overlay, and the timer itself). FAB/modals/gym all sit above as intended.
  4. **Opaque bg — no content bleed.** `.workout-timer` keeps `background:var(--surface)` =
     `#1e293b` dark / `#ffffff` light (`:25`,`:36`) — both fully opaque hex, no alpha — plus
     `1px solid var(--border)`. Scrolled exercise rows are fully covered. Content sits in the same
     16px-padded `.view` column (`:82`), so nothing renders in side gutters.
  5. **Sticky WILL work — ancestor chain is clean (the real failure mode, checked).** Chain:
     `.workout-timer` (direct child of `#activeWorkout`, confirmed in `renderActive` markup
     `:783`) → `#activeWorkout` → `#log.view` → `body`. There is NO CSS rule for `#activeWorkout`
     or `#log` at all; `.view` (`:82`) is only `display:none;padding:16px` / `.view.active{display:block}`;
     `body` (`:43`) is only `min-height:100dvh; padding-bottom`. None set `overflow`, `height`,
     `transform`, or `contain`. The scroll happens on body/viewport, so sticky catches relative to
     the viewport scroll. **Sticky is not silently broken.**
  6. **Gym mode untouched.** Gym CSS block (`:184-360`) and gym JS are NOT in the diff
     (`git diff b47a75d..f9bb199` touches only the `.workout-timer` rule + comment + sw.js cache).
     `.gym-header` (flex-shrink:0) above `.gym-main` (`flex:1;overflow-y:auto`, `:218`) is intact →
     gym timer stays pinned in its own scroll context, unchanged. `.workout-timer` does not exist
     in the gym overlay (gym renders its own markup). Gym-open and gym-closed both unaffected.
  7. **Regression scope — surgical.** Diff = 4 ins / 2 del in index.html (one CSS rule + comment)
     + sw.js +1/-1. Nothing touches Step 1 (settings/theme), Step 2 (home plans), paste, history,
     stats, export, the `startTimer()` interval, or the FAB. No JS change; `#workoutTimer` markup
     and its interval update untouched.
  8. **Small screen (≤380px) — fine.** `@media(max-width:380px)` (`:347-353`) overrides only
     `.workout-timer{padding:10px 12px}` (`:351`); it does NOT touch position/top/z-index, so
     sticky still applies. Reduced padding shrinks the CARD, not the header (the header offset is
     unchanged by this media query), so the 71px assumption still holds on Fold 5 cover.
  Non-blocking robustness note (71px fragility — judged NON-BLOCKING):
  - The offset is a hardcoded px derived from the header. It is correct now and far less brittle
    than it looks, because every dominant header dimension (gear 38px, 16px paddings, 1px border,
    Export 36px) is fixed px and does NOT scale with rem. Only the h1 (1.3rem) scales, and it
    overtakes the 38px gear only above root ≈ 24.4px (≈152% font zoom) — node-modelled root ∈
    {16,18,20,22,24} all stay 71px flush. Above ~150% zoom the timer would tuck a few px UNDER
    the header (partially hidden) — but z-index:5<10 means the safe direction (under, not over),
    and content stays readable. A long title doesn't wrap (single flex child, no width cap); it
    would overflow horizontally, a pre-existing header concern, not introduced here.
  - Recommendation to orchestrator: ACCEPT as-is for merge. A more robust offset (e.g. JS that
    measures `header.offsetHeight` into a CSS var, or making the header a known fixed height) is a
    nice-to-have, not required — the current value is correct across all realistic device/font
    settings. Optionally request the hardening as a follow-up, not a blocker.
  Unverifiable without a live browser (no headless Chrome in env):
  - The actual sticky CATCH behavior on real scroll and the exact flush pixel alignment across
    real devices/insets (math says flush; not observed live).
  - Real rendering of the pinned bar over scrolling content (opacity is provably solid; live
    paint not seen).
  - These are live-only confirmations, not logic defects → PASS-with-notes. Preview on :4000
    serves HTTP 200, the sticky rule, and `gymlog-v8`.

### Step 4 — Set completion check-off (F4)
- Status: not started
- Worker verification (gym open / gym closed): —
- Auditor findings: —

### Step 5 — Last-weight/sets memory (F5)
- Status: not started
- Worker verification (gym open / gym closed): —
- Auditor findings: —

---

## Open decisions needing user input (surfaced in Phase 1, not silently chosen)
1. **Gym mode under light theme:** recommend gym mode stays always-dark (high-contrast,
   glanceable, OLED-friendly in a gym). Theme toggle would affect the normal app only.
2. **Saved plans visibility on home:** recommend showing them in the idle/no-workout state
   (so you tap a plan to start), hidden while a workout is active. Alternative: always pinned
   at the very top of `#log`.
3. **Theme scope at launch:** light + dark only (per prompt). System/auto-follow can be a
   later addition.

## Deviations from prompt
- Prompt proposed "3–4 steps"; chose **4** with the grouping above. F2+F3 merged into one step
  because both reshape the `#log` view's layout/scroll behavior in complementary states.

## Blockers
- None. Awaiting user approval of this plan before dispatching any worker (Phase 1 STOP).
