# 3D Model Generator

A browser-based modelling tool: drop in primitives, transform them, combine them
with boolean operations, and export the result as STL. No build step — the app is
plain ES modules and pulls three.js from a CDN via an import map.

## Running

```bash
npm run serve   # serves the project, prints a localhost URL
```

Opening `index.html` directly from the filesystem will not work: ES modules and the
import map need an HTTP origin.

## Tests

```bash
npm install
npm test
```

`npm test` runs two suites from one entry point (`tests/run.mjs`):

- **Static contract** (`tests/static.test.mjs`) — checks that every element id and
  class `app.js` reaches for exists in `index.html`, that the import map resolves
  every bare specifier, and that the palette in `style.css` stays within its
  contrast floors and brightness ceiling.
- **End to end** (`tests/browser.test.mjs`) — drives the real app in headless
  Chromium: primitives, picking, the properties panel, undo/redo, boolean
  operations, STL export (the downloaded files are parsed and verified),
  keyboard shortcuts, reference images and camera presets.

The browser suite serves the CDN modules out of `node_modules`, so it runs offline
and always tests the exact pinned versions of three.js and three-bvh-csg.

## Shortcuts

| Key | Action |
| --- | --- |
| `G` / `R` / `S` | Move / Rotate / Scale |
| `1` / `3` / `7` / `5` | Front / Right / Top / Perspective view |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / Redo |
| `Ctrl+D` | Duplicate |
| `Delete` | Delete selection |
| `Esc` | Deselect |
