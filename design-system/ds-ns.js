/* Resolves the generated design-system bundle namespace without hard-coding it.
   The compiler exposes every component under one window object; we find it by
   probing for the names the caller asked for.

   dsNS(...names)        → synchronous; use in @dsCard HTML, where _ds_bundle.js is present.
   dsReady(root, paths)  → promise; falls back to compiling the component sources
                           directly when the bundle has not been generated yet
                           (author-time preview). Same components either way. */

window.dsNS = function (...names) {
  for (const k of Object.keys(window)) {
    try {
      const v = window[k];
      if (v && typeof v === "object" && names.every((n) => typeof v[n] === "function")) return v;
    } catch (_) { /* cross-origin frame on window — skip */ }
  }
  return null;
};

window.dsReady = function (root, paths) {
  const names = paths.map((p) => p.split("/").pop().replace(/\.jsx$/, ""));
  const hit = window.dsNS(...names);
  if (hit) return Promise.resolve(hit);

  return Promise.all(paths.map((p) => fetch(root + p).then((r) => r.text()))).then((sources) => {
    const src = sources
      .map((s) => s.replace(/^\s*import[^\n]*\n/gm, "").replace(/^export\s+function/gm, "function"))
      .join("\n");
    const code = window.Babel.transform(src, { presets: ["react"] }).code;
    return new Function("React", code + "\n;return {" + names.join(",") + "};")(window.React);
  });
};
