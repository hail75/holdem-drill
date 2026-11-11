# Hold'em Drill: installable app

## Put it online (free, about 3 minutes)
1. On github.com, create a new **public** repository, e.g. `holdem-drill`.
2. Click **Add file → Upload files**, drag in every file from this folder, and commit.
3. Go to **Settings → Pages**. Under "Build and deployment", choose **Deploy from a branch**, pick **main** and **/ (root)**, and save.
4. After a minute your app is live at `https://<your-username>.github.io/holdem-drill/`.

## Install on your phone
Open that address in **Chrome**, then tap **⋮ → Install app** (or **Add to home screen**).
You get the gold ♣ icon, a full-screen app without the browser bar, and it works offline after the first visit.

## Notes
- Stats are saved per web address, so this app starts with fresh stats (separate from the claude.ai link).
- To update: replace `index.html` with a newer version and commit. The app picks it up the next time it opens online.

## Working with Claude Code
- `CLAUDE.md` gives Claude Code the full context: code map, strategy rules, past mistakes, and conventions.
- `tests/verify.mjs` checks the strategy logic. Run `node tests/verify.mjs` after any change.
