# Zeema app — UI kit

A six-screen click-through recreation of the Zeema product, composed entirely from the
published primitives in `components/`. Open `index.html`.

| Screen | File | What it shows |
|---|---|---|
| Canvas editor | `EditorScreen.jsx` | Palette, dotted canvas with nodes/edges/boundary, right-click menu, inspector. Click a node to inspect it; right-click for the menu; edit a field to see the save state go `unsaved`. |
| Findings | `FindingsScreen.jsx` | Severity tally, filterable findings, rule detail with the properties it checks. Click a finding to jump to its node in the editor. |
| Browse | `BrowseScreen.jsx` | Gallery of published designs with live search and provider filters; all three thumbnail treatments. |
| Design detail | `DetailScreen.jsx` | Read-only diagram, component list, requirements table with met/failing status. |
| Catalog | `CatalogScreen.jsx` | All 26 catalog components, searchable, with the selected kind's schema. |
| Sign in / empty | `AuthScreen.jsx` | Sign-in card and the three empty-state treatments. |

Supporting files: `App.jsx` (router + theme), `Chrome.jsx` (`TopBar`, `Panel`),
`Thumb.jsx` (the three thumbnail treatments), `data.js` (fixtures).

The **dark / light** toggle sits at the top right and flips `data-theme` on `<html>` — every
screen is authored once and themed by tokens alone.

## How it loads components

`index.html` calls `window.dsReady()` from `ds-ns.js`. When the compiled `_ds_bundle.js` exists
it uses that; otherwise it compiles the `components/**/*.jsx` sources directly, so the kit renders
identically at author time and after the system is published. Screens read primitives off
`window.DS`.

## Known gaps

Behaviour beyond what the source specimen sheet demonstrated is inferred: drag-to-place from the
palette, edge routing, pan/zoom, and multi-select are not implemented. Node positions are fixed
fixtures in `data.js`.
