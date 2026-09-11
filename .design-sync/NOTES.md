# design-sync notes

- This repo **pulls** from Claude Design; it does not push. The design system is authored in
  the "Arkore Design System" project (`1fc6c5b7-2e13-4b31-94e1-f9365bc4c98c`) and mirrored into
  `design-system/` so the web app can be brought in line with it. `/design-sync` here means
  re-read the project and refresh `design-system/`.
- The remote project contains a stray `uploads/2Arkore/` copy of its own tree (a nested
  re-upload). It is ignored on pull.
- `assets/icons/` in the remote is a 47-file subset copied verbatim from this repo's `icons/`.
  On pull they are copied from `icons/` rather than downloaded.
- `_ds_bundle.js` (the compiled bundle) is not pulled; the source `.jsx` files are, and the
  cards/kit fall back to compiling them in the browser via `ds-ns.js`.
