import React from "react";

/** Zeema ships two icon classes and renders them differently on purpose:
 *  - "component": vendor brand marks, full colour, never recoloured
 *  - "kind": monochrome category glyphs, masked so they take --ink or any tone
 *  - "provider": vendor logos in chrome, tinted through --icon-filter in dark
 */
export function Icon({ src, kind = "component", size = "var(--icon)", color = "var(--ink)", alt = "", style, ...rest }) {
  const box = { width: size, height: size, display: "block", flexShrink: 0 };
  if (kind === "kind") {
    return (
      <span
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        style={{
          ...box,
          background: color,
          mask: `url(${src}) center / contain no-repeat`,
          WebkitMask: `url(${src}) center / contain no-repeat`,
          ...style,
        }}
        {...rest}
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      style={{ ...box, ...(kind === "provider" ? { filter: "var(--icon-filter)" } : null), ...style }}
      {...rest}
    />
  );
}
