# AGENTS.md — Mesa OP

## Project Overview

HTML/vanilla JS app for running "Ordem Paranormal" RPG sessions online. No build tools, no package.json, no server — just open `index.html` in a browser.

## Key Facts

- **Language**: Portuguese (pt-BR). All UI labels, inputs, placeholders, and data fields are in Portuguese.
- **No build pipeline**: edit files directly, refresh browser to see changes.
- **No Firebase SDK**: uses raw `fetch()` + `EventSource` (SSE) against Firebase Realtime Database REST API (no Firebase Auth either — custom login stored in DB).
- **Works offline**: Firebase config is optional. Data is saved to `localStorage` (keys: `op_users`, `op_char`, `op_mestre`, `op_firebase_config`).
- **CSS in `style.css`**, HTML in `index.html`, JS in `js/` folder. The CSS uses base64-inlined SVG data URIs for backgrounds and elemental symbols.

## File Structure

```
index.html          — HTML structure, loads CSS + all JS files
style.css           — All CSS rules (~350 lines, dark horror theme)
js/
  firebase.js       — Firebase REST API (fetch, SSE, polling). Namespace: appFirebase
  app.js            — All application logic (auth, DB, tabs, ficha, dados, inventário,
                      missão, trilhas, rituais, token, mapa, mestre, audio, criaturas).
                      Namespace: appMesa
```

## JS Namespaces

Each `js/*.js` file wraps its functions in a `const` namespace (e.g., `appFirebase.fbTestConfig()`, `appMesa.showTab()`). All functions are also exposed on `window` for HTML `onclick` compatibility. Load order: `firebase.js` → `app.js`.

## App Screens/Tabs

| Tab ID | Purpose |
|---|---|
| `ficha` | Character sheet (stats, NEX, origin, attributes, skills) |
| `dados` | Dice rolling with log |
| `inventario` | Inventory/items |
| `missao` | Mission notes |
| `trilhas` | Class paths/progression |
| `rituais` | Rituals/spells |
| `token` | Token creator (canvas-based) |
| `mapa` | Interactive battle map with tokens, layers, drawing |
| `elementos` | Elemental symbols reference |
| `criaturas` | Bestiary & relics encyclopedia |
| `mestre` | GM panel (hidden by default, `.mestre-only`) |

## Data Flow

- login/register → user+pass stored in `localStorage['op_users']` + synced to Firebase `gamedata.users`
- character data → `localStorage['op_char']` + synced to Firebase `gamedata.characters`
- GM data → `localStorage['op_mestre']` + synced to Firebase `gamedata.mestre`
- map tokens/state → Firebase `mapstate` (SSE real-time sync)
- presence/broadcast → Firebase `presence` / `broadcast` (polling)
- kicks → Firebase `kicks/{user}` (SSE instant)

## Firebase Config

- Stored in `localStorage['op_firebase_config']` as JSON: `{ apiKey, databaseURL, projectId, appId, messagingSenderId }`
- Test with `appFirebase.fbTestConfig()` — fires HTTP GET to `{databaseURL}/presence.json?shallow=true`

## Style Conventions

- CSS custom properties in `:root` for the dark horror theme (`--bg-void`, `--crimson`, `--blood`, etc.)
- UI components: `.panel`, `.btn-ritual`, `.btn-add`, `.die-btn`, `.tool-btn`, `.state-btn`, `.cond-chip`
- Custom SVG pentagram cursor on all interactive elements via inline `url(data:image/svg+xml;...)`
- No external dependencies beyond Google Fonts

## Common Operations

- Run: open `index.html` in any modern browser (Chrome/FF/Edge).
- To test offline behavior: open in browser without Firebase config → click "Usar offline".
- To reset all local data: clear `localStorage` keys above.
- Characters and GM passwords are plaintext in localStorage (no server-side validation).
