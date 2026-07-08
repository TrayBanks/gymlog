# GymLog — Claude Code Guidelines

## Stack
Single-file PWA: `index.html` (HTML + CSS + JS inline), `sw.js` (service worker), `manifest.json`. No build step, no dependencies.

## Branch & Deploy Rules

**`main` is production.** Every push to `main` auto-deploys to GitHub Pages via
`.github/workflows/pages.yml`. Branch protection requires a pull request —
never push or merge to `main` directly.

Development flow:
1. Feature ideas and bugs live as **GitHub Issues**
2. All changes go on a feature branch (e.g. `claude/feature-name-xxxx`)
3. When the work is done, **open a pull request**, with `Fixes #N` in the
   description when it resolves an issue
4. Give the user a way to live-test the branch before merging (see
   "Previewing a branch" below)
5. The user reviews the PR diff and merges it in GitHub — merging closes the
   linked issue, deletes the branch, and deploys to production

Never merge a PR yourself. The user's merge in the GitHub UI is the approval.

## Previewing a branch

**Remote/web sessions:** publish the branch's `index.html` as a Claude
Artifact so the user can live-test in the browser. The artifact wrapper adds
its own `<html>/<head>/<body>` skeleton, so strip the outer document tags
first: concatenate the inner content of `<head>` (styles, meta) and `<body>`
(markup, scripts) into a single fragment file and publish that. The service
worker registration fails silently in artifacts (`.catch` is already in
place) and localStorage works, so the app is fully testable except for
PWA-install/offline behavior — note that caveat to the user.

**Local sessions:** run a preview server on the feature branch and share the
URL:

```bash
python3 -m http.server 4000
```

Final PWA behavior (install, offline, service worker updates) can only be
verified on a real device after merge.

## Service Worker Cache

Bump `CACHE_NAME` in `sw.js` with every commit that changes `index.html`
(e.g. `gymlog-v5` → `gymlog-v6`). This forces installed PWAs to pick up
changes. PR reviews should check the bump is present.

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
