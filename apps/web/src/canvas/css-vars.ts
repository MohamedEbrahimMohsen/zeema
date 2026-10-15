// An exported SVG cannot lean on the page's custom properties, so every `var(--x)` is swapped
// for its computed value. That value lands in `style="…"` attributes and in `<style>` text, so it
// must be safe in both: a font stack such as `"JetBrains Mono", ui-monospace` would close the
// attribute early and the file would no longer parse. CSS takes either quote, so double quotes
// become single ones; `&`, `<` and `>` are escaped should a value ever carry them.

export const xmlSafeCssValue = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "'");

/** Replaces each `var(--name)` with `lookup(name)`, made XML-safe; an unknown name stays as is. */
export const resolveCssVars = (text: string, lookup: (name: string) => string) =>
  text.replace(/var\((--[a-z0-9-]+)\)/gi, (whole, name: string) => {
    const value = lookup(name);
    return value ? xmlSafeCssValue(value) : whole;
  });
