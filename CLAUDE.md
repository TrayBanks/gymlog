# GymLog — Claude Code Guidelines

## Stack
Single-file PWA: `index.html` (HTML + CSS + JS inline), `sw.js` (service worker), `manifest.json`. No build step, no dependencies.

## Branch & Deploy Rules

**NEVER push to or merge into `main` without explicit user confirmation.**

Development flow:
1. All changes go on a feature branch (e.g. `claude/feature-name-xxxx`)
2. Start a preview server so the user can test before approving
3. User says "looks good, merge it" → then and only then merge to main and push

## Preview Server

When starting a new session with pending changes, spin up a preview on the feature branch:

```bash
# In the repo root, on the feature branch:
python3 -m http.server 4000
```

Tell the user the local preview URL and which branch it reflects.
The preview server should be running before reporting a task as done.

## Service Worker Cache

Bump `CACHE_NAME` in `sw.js` with every commit that changes `index.html`
(e.g. `gymlog-v5` → `gymlog-v6`). This forces installed PWAs to pick up changes.

## Key localStorage Keys
- `gymlog_workouts` — completed workouts array
- `gymlog_exercises` — known exercise name list
- `gymlog_plans` — saved AI-pasted workout plans

## Workout Object Shape
```json
{
  "id": 1234567890,
  "date": "ISO string",
  "startTime": 1234567890,
  "duration": 3600,
  "warmups": [{ "name": "", "sets": [{ "weight": "", "reps": "", "rpe": "", "_done": false }], "_rest": 90, "_notes": "" }],
  "exercises": [{ "name": "", "sets": [...], "_rest": 90, "_notes": "" }]
}
```
