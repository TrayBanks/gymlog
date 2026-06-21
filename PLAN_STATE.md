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
| 2 | F2 — Saved plans onto `#log` home (idle/no-workout state) | in progress |
| 3 | F3 — Persistent pinned workout timer (both modes) | not started |
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
- Status: in progress
- Worker verification (gym open / gym closed): —
- Auditor findings: —

### Step 3 — Persistent pinned workout timer (F3)
- Status: not started
- Worker verification (gym open / gym closed): —
- Auditor findings: —

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
