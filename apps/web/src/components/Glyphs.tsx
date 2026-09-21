// The line glyphs used by the section toolbars. One file, so the About and YAML panels draw the
// same pencil rather than two that drift a pixel apart. Sized and stroked by `.btn-icon svg`.

export const Raw = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path d="M14 4h6v6" />
    <path d="M20 4 11 13" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);

export const Download = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path d="M12 3v12" />
    <path d="m7 11 5 5 5-5" />
    <path d="M4 20h16" />
  </svg>
);

/** Callout marks. One per severity of aside the documentation uses. */
export const Info = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 7.5h.01" />
  </svg>
);

export const Bulb = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path d="M9 18h6" />
    <path d="M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.3.2.5.6.5 1V15h6v-.1c0-.4.2-.8.5-1A6 6 0 0 0 12 3Z" />
  </svg>
);

export const Alert = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20.4h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4" />
    <path d="M12 16.5h.01" />
  </svg>
);

/** Documentation chrome: the sidebar drawer, the search field, the anchor beside a heading. */
export const Menu = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </svg>
);

export const Close = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path d="M6 6 18 18" />
    <path d="M18 6 6 18" />
  </svg>
);

export const Search = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <circle cx="11" cy="11" r="6" />
    <path d="m15.5 15.5 4 4" />
  </svg>
);

export const Anchor = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.1.1l3-3A5 5 0 0 0 13 3l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.1-.1l-3 3A5 5 0 0 0 11 21l1.7-1.7" />
  </svg>
);

export const ArrowLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path d="M19 12H5" />
    <path d="m11 6-6 6 6 6" />
  </svg>
);

export const ArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

export const Pencil = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="M15 6.5 17.5 9" />
  </svg>
);

/** The design panel's toolbar: the canvas, a raster export, and the fit/actual-size switch. */
export const Canvas = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <rect x="3" y="4" width="7" height="6" rx="1.5" />
    <rect x="14" y="14" width="7" height="6" rx="1.5" />
    <path d="M10 7h4a3 3 0 0 1 3 3v4" />
  </svg>
);

export const Picture = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <rect x="3" y="4" width="18" height="13" rx="2" />
    <circle cx="8.5" cy="9" r="1.5" />
    <path d="m4 16 5-4 4 3 3-2 4 3" />
    <path d="M12 20h6" />
  </svg>
);

export const Fit = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path d="M4 9V5a1 1 0 0 1 1-1h4" />
    <path d="M20 9V5a1 1 0 0 0-1-1h-4" />
    <path d="M4 15v4a1 1 0 0 0 1 1h4" />
    <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
  </svg>
);

export const Actual = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path d="M9 4H5a1 1 0 0 0-1 1v4" />
    <path d="M15 4h4a1 1 0 0 1 1 1v4" />
    <path d="M9 20H5a1 1 0 0 1-1-1v-4" />
    <path d="M15 20h4a1 1 0 0 0 1-1v-4" />
    <path d="m4 4 5 5" />
    <path d="m20 20-5-5" />
  </svg>
);

/** History's own toolbar: throwing the draft away and going back to the release. */
export const Undo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path d="M4 5v6h6" />
    <path d="M4 11a8 8 0 1 1 2.3 6" />
  </svg>
);
