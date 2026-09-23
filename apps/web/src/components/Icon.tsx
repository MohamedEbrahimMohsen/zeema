const escapeText = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

// Inline SVG for a catalogue icon. `markup` is the inner markup from the icon map (sanitised at
// build); vendor marks carry their own fills, line glyphs draw in currentColor via .ic.
export function Icon({
  markup,
  size,
  muted,
  className = "",
  title,
}: {
  markup: string | undefined;
  size?: "sm" | "lg";
  muted?: boolean;
  className?: string;
  title?: string;
}) {
  const cls = ["ic", size ?? "", muted ? "muted" : "", className].filter(Boolean).join(" ");
  return (
    <svg
      viewBox="0 0 24 24"
      className={cls}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: catalogue icon markup, sanitised at build
      dangerouslySetInnerHTML={{
        __html:
          (title ? `<title>${escapeText(title)}</title>` : "") +
          (typeof markup === "string" ? markup : ""),
      }}
    />
  );
}
