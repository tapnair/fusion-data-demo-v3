# GitHub Pages Deployment Plan

## Overview

Deploy the app as a static site on GitHub Pages at:
```
https://tapnair.github.io/fusion-data-demo-v3
```

The app uses `BrowserRouter` and the `/callback` route is the OAuth redirect URI — a real URL that Autodesk APS redirects the browser to after authentication. GitHub Pages does not support server-side routing, so direct hits to any route other than `/` return a 404. A `404.html` redirect hack (spa-github-pages pattern) is used to intercept those 404s and forward the full URL back to the SPA.

---

## Reference

Article: [Deploy your Vite + React app on GitHub Pages](https://nikujais.medium.com/deploy-your-vite-react-app-on-github-pages-b52b2ad1edd2)
(article was inaccessible during planning; steps sourced from equivalent guides and official docs)

---

## Files

### Modified Files

#### `package.json`
Install `gh-pages` as a dev dependency (see Phase 1), then add:

```json
{
  "homepage": "https://tapnair.github.io/fusion-data-demo-v3",
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist",
    ...existing scripts...
  }
}
```

- `homepage` tells gh-pages where the site will live.
- `predeploy` runs automatically before `deploy` — builds the app into `dist/`.
- `deploy` pushes the `dist/` folder to the `gh-pages` branch of the repository.

#### `vite.config.ts`
Switch to the function form of `defineConfig` to access `command`, and set `base` only when building for production. This keeps `localhost:5173/` working normally during development:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/fusion-data-demo-v3/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
  },
}))
```

- `command === 'build'` is true when running `vite build` (including `npm run deploy`)
- During `vite` (dev server), `base` is `'/'` so `localhost:5173/` works as before

#### `src/App.tsx`
Add a conditional `basename` to `BrowserRouter` using Vite's `import.meta.env.PROD` boolean, which is `true` in production builds and `false` in dev:

```tsx
// before
<Router>
// after
<Router basename={import.meta.env.PROD ? '/fusion-data-demo-v3' : '/'}>
```

This mirrors the vite.config change — local dev uses `/` and production uses the repo sub-path.

#### `index.html`
Add the SPA path-restoration script as the **first script inside `<head>`**. When the `404.html` redirect fires, this script reads the encoded path from the query string and calls `history.replaceState` to restore it before React Router initialises:

```html
<head>
  <script>
    // SPA routing on GitHub Pages — restores path forwarded by 404.html
    (function(l) {
      if (l.search[1] === '/') {
        var decoded = l.search.slice(1).split('&').map(function(s) {
          return s.replace(/~and~/g, '&')
        }).join('?')
        window.history.replaceState(null, null,
          l.pathname.slice(0, -1) + decoded + l.hash
        )
      }
    }(window.location))
  </script>
  <meta charset="UTF-8" />
  ...rest of existing head...
</head>
```

#### `.env.example`
No change needed — keep `VITE_REDIRECT_URI=http://localhost:5173/callback` as the default for local development.

### New Files

#### `.env.production`
Vite automatically loads this file when running `vite build` (i.e. `npm run deploy`), and its values override those in `.env`. This means `VITE_REDIRECT_URI` is always correct for production without any manual swapping:

```
VITE_REDIRECT_URI=https://tapnair.github.io/fusion-data-demo-v3/callback
```

- This file contains no secrets (redirect URIs are not sensitive in PKCE flows) and can be committed to git.
- Your local `.env` keeps `VITE_REDIRECT_URI=http://localhost:5173/callback` untouched.
- Vite env loading order for `vite build`: `.env.production` overrides `.env`, so the correct URI is always baked into the production bundle.

#### `public/404.html`
GitHub Pages serves this file for any URL that has no matching static file. The script below re-encodes the full URL as a query parameter and redirects to the root, where the `index.html` script above restores it:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Fusion Data Demo</title>
    <script>
      // SPA routing on GitHub Pages — forwards 404'd paths back to index.html
      // pathSegmentsToKeep = 1 keeps the repo name segment in the path
      var pathSegmentsToKeep = 1
      var l = window.location
      l.replace(
        l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
        l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') + '/?/' +
        l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
        (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
        l.hash
      )
    </script>
  </head>
  <body></body>
</html>
```

**How it works for the OAuth callback:**
1. Autodesk APS redirects the browser to `https://tapnair.github.io/fusion-data-demo-v3/callback?code=...&state=...`
2. GitHub Pages has no `callback/index.html` → serves `404.html`
3. `404.html` script redirects to `https://tapnair.github.io/fusion-data-demo-v3/?/callback?code=...~and~state=...`
4. `index.html` script calls `history.replaceState` to restore `/fusion-data-demo-v3/callback?code=...&state=...`
5. React Router matches `/callback`, renders `<AuthCallback />`, auth succeeds

---

## Manual Step (Outside the Codebase)

### Autodesk APS App Registration
In the [Autodesk Developer Portal](https://aps.autodesk.com/myapps), add the GitHub Pages callback URL as an authorised callback URL for the APS application:

```
https://tapnair.github.io/fusion-data-demo-v3/callback
```

The existing `http://localhost:5173/callback` entry can remain — APS allows multiple callback URLs per app.

---

## Implementation Phases

### Phase 1 — Install gh-pages
```bash
npm install gh-pages --save-dev
```

### Phase 2 — package.json
- Add `"homepage": "https://tapnair.github.io/fusion-data-demo-v3"`
- Add `"predeploy": "npm run build"` script
- Add `"deploy": "gh-pages -d dist"` script

### Phase 3 — vite.config.ts
- Switch to function form of `defineConfig`
- Set `base: command === 'build' ? '/fusion-data-demo-v3/' : '/'` (production only)

### Phase 4 — React Router basename
- Add `basename={import.meta.env.PROD ? '/fusion-data-demo-v3' : '/'}` to `<Router>` in `src/App.tsx`

### Phase 5 — SPA routing fix
- Create `public/404.html` with the path-forwarding script
- Add the path-restoration script to `index.html` as the first `<script>` in `<head>`

### Phase 6 — Environment
- Create `.env.production` with `VITE_REDIRECT_URI=https://tapnair.github.io/fusion-data-demo-v3/callback`
- Commit `.env.production` (no secrets — safe to track in git)

### Phase 7 — APS app registration (manual)
- Log in to Autodesk Developer Portal
- Add `https://tapnair.github.io/fusion-data-demo-v3/callback` as a callback URL

### Phase 8 — Deploy
```bash
npm run deploy
```
This runs `predeploy` (builds the app) then pushes `dist/` to the `gh-pages` branch.

### Phase 9 — Enable GitHub Pages (manual, one-time)
In the GitHub repository:
- Go to **Settings → Pages**
- Under **Build and deployment**, set **Source** to `Deploy from a branch`
- Set **Branch** to `gh-pages` / `/ (root)`
- Click **Save**

The site will be live at `https://tapnair.github.io/fusion-data-demo-v3` within ~1 minute.

---

## Non-goals (this phase)

- No custom domain
- No GitHub Actions CI/CD workflow (manual `npm run deploy` only)
- No separate staging/production environments
