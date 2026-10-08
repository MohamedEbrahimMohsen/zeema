"use client";

/**
 * One look for every on/off choice in the canvas chrome: the app's pill switch (globals.css
 * `.switch`, the same one as "Act as admin" in the user menu), accent when on, grey when off.
 * The words sit beside it inside the same button, so a click anywhere on the row flips it, and
 * Space and Enter do what a button does. The toolbar's "auto" save and the menus' toggles
 * (Hover cards, Dim edges, the panes) all use it.
 */
export function Switch({
  label,
  checked,
  onChange,
  title,
  hint,
  className = "",
  role = "switch",
}: {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  title?: string;
  /** Muted words under the label (a menu row's note, such as how "auto" decides). */
  hint?: string;
  className?: string;
  /** "menuitemcheckbox" inside a menu, where a screen reader expects menu items. */
  role?: "switch" | "menuitemcheckbox";
}) {
  const props = {
    type: "button" as const,
    title,
    className: `switch-row ${className}`.trim(),
    onClick: () => onChange(!checked),
  };
  const body = (
    <>
      <span className="switch-text">
        <span className="switch-label">{label}</span>
        {hint ? <span className="switch-hint">{hint}</span> : null}
      </span>
      <span className={`switch${checked ? " on" : ""}`} aria-hidden="true" />
    </>
  );
  return role === "menuitemcheckbox" ? (
    <button {...props} role="menuitemcheckbox" aria-checked={checked}>
      {body}
    </button>
  ) : (
    <button {...props} role="switch" aria-checked={checked}>
      {body}
    </button>
  );
}
