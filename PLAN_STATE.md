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

## Plan (4 steps → 5 features)

| Step | Feature(s) | Status |
|------|-----------|--------|
| 1 | F1 — Settings panel (wake-lock toggle, light/dark theme), new `gymlog_settings` key | not started |
| 2 | F2 + F3 — Saved plans onto `#log` home + persistent pinned workout timer | not started |
| 3 | F4 — Set completion check-off (new UI on existing `_done`, both modes) | not started |
| 4 | F5 — Running last-weight/sets memory (completed vs attempted), both modes | not started |

Order rationale:
- **Step 1 first** because the theme system refactors global `:root` CSS vars; landing it first
  means every later step is built against a theme-aware baseline (no rework).
- **Step 2** reshapes the `#log` view in two mutually-exclusive states (idle = saved plans;
  active = pinned timer), so one worker owns that layout coherently.
- **Step 3** before **Step 4** per the soft dependency above.

---

## Step Log
### Step 1 — Settings panel
- Status: not started
- Worker verification (gym open / gym closed): —
- Auditor findings: —

### Step 2 — Saved plans on home + pinned timer
- Status: not started
- Worker verification (gym open / gym closed): —
- Auditor findings: —

### Step 3 — Set completion check-off
- Status: not started
- Worker verification (gym open / gym closed): —
- Auditor findings: —

### Step 4 — Last-weight/sets memory
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
