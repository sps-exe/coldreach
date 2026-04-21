# ColdReach

Production-grade cold outreach message generator that pulls GitHub repos, understands context, and generates personalized outreach drafts with Claude.

## Run locally

No install needed.

1. Open [index.html](index.html) in a modern browser.
2. Add your Anthropic API key in Settings.
3. Fill the form, fetch repos, and generate messages.

## Anthropic API key

Create or manage your API key at:

https://console.anthropic.com

## File structure

- [index.html](index.html) — app shell, full UI markup, CSS and JS links
- [src/app.js](src/app.js) — main app state, event listeners, orchestration, generate/regenerate flow
- [src/styles/reset.css](src/styles/reset.css) — baseline reset rules
- [src/styles/tokens.css](src/styles/tokens.css) — design tokens for colors, spacing, radius, typography
- [src/styles/main.css](src/styles/main.css) — page layout, header, hero, footer, section-level styles
- [src/styles/components.css](src/styles/components.css) — form controls, cards, buttons, toggles, settings panel, output UI
- [src/utils/storage.js](src/utils/storage.js) — localStorage helpers (`get`, `set`, `clear`)
- [src/utils/github.js](src/utils/github.js) — GitHub API fetch + repo parsing
- [src/utils/claude.js](src/utils/claude.js) — Claude API call and strict JSON parsing
- [src/components/settings.js](src/components/settings.js) — settings panel behavior and persistence
- [src/components/repoFetcher.js](src/components/repoFetcher.js) — fetch repos + chip rendering + shared repo state
- [src/components/outputRenderer.js](src/components/outputRenderer.js) — output cards, copy actions, tips/warnings rendering

## Environment notes

- API key is stored in browser `localStorage` only.
- GitHub repository data is fetched from the public GitHub REST API without auth.
- Anthropic requests are sent directly from the browser to the Messages API.
