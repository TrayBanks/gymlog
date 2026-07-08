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
Artifact so the user can live-test in the browser:

1. Strip the outer document tags (the artifact wrapper adds its own
   `<html>/<head>/<body>` skeleton): concatenate the inner content of
   `<head>` (styles, meta) and `<body>` (markup, scripts) into a single
   fragment file.
2. Append `preview-feedback-widget.html` (in the repo root) to the fragment.
   It adds a tap-to-annotate feedback mode: the user taps elements, writes
   notes, and hits "Copy report" to paste structured feedback (element
   selectors included) back into the session. Never ship the widget in the
   real `index.html`.
3. Publish the fragment with the Artifact tool. Republish to the same file
   path after each fix so the URL stays stable.

Artifact sandbox caveats to relay to the user: the service worker fails
silently (no PWA-install/offline testing) and **all external network
requests are blocked** — e.g. warm-up demo images fetched from the wger.de
API will always show the placeholder in previews even though they work in
the deployed app. localStorage works but is separate from the phone's data.

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
