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

export const Pencil = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="M15 6.5 17.5 9" />
  </svg>
);
