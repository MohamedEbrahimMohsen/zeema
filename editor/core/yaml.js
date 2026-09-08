// YAML for Arkore design documents: a parser that keeps every source span, and a serialiser
// that copies those spans back out and rewrites only what changed. An unmodified document
// therefore comes back byte for byte, comments, blank lines and quoting included.
//
//   parse(text)          -> { doc, cst }
//   serialize(cst, doc)  -> text
//
// The subset covered is the one the repository uses: a top level block map whose values are
// scalars, one nested block map (requirements) and three block sequences (groups, nodes, edges)
// whose entries are either a one line flow map or a block map with flow maps nested inside it.
// Scalars are double quoted strings, integers, booleans and null. Nothing here splits on a
// comma or a colon: flow collections are read by a character scanner that tracks quoting and
// nesting, because twelve of the repository's designs carry a comma or a colon inside a string.

const isBlank = (l) => l.trim() === "";
const isComment = (l) => l.trimStart().startsWith("#");
const indentOf = (l) => l.length - l.trimStart().length;

// ---------------------------------------------------------------- scalars

export function parseScalar(raw) {
  const t = raw.trim();
  if (t === "") return { value: null, style: "empty" };
  if (t[0] === '"') {
    let out = "";
    for (let i = 1; i < t.length; i++) {
      const c = t[i];
      if (c === "\\") { const n = t[++i]; out += n === "n" ? "\n" : n === "t" ? "\t" : n; continue; }
      if (c === '"') break;
      out += c;
    }
    return { value: out, style: "quoted" };
  }
  if (t === "true" || t === "false") return { value: t === "true", style: "bare" };
  if (t === "null" || t === "~") return { value: null, style: "bare" };
  if (/^-?\d+$/.test(t)) return { value: parseInt(t, 10), style: "bare" };
  if (/^-?\d*\.\d+$/.test(t)) return { value: parseFloat(t), style: "bare" };
  return { value: t, style: "bare" };
}

export function emitScalar(v, style) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (style === "bare" && /^-?\d+(\.\d+)?$/.test(v) === false && v !== "true" && v !== "false") return v;
  return '"' + String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

// Split a flow body (the text between { }) into top level "key: value" pairs, honouring
// quotes and nesting. This is the scanner the round trip depends on.
function splitFlow(body) {
  const parts = [];
  let depth = 0, quoted = false, start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quoted) { if (c === "\\") i++; else if (c === '"') quoted = false; continue; }
    if (c === '"') { quoted = true; continue; }
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    else if (c === "," && depth === 0) { parts.push(body.slice(start, i)); start = i + 1; }
  }
  const tail = body.slice(start);
  if (tail.trim() !== "") parts.push(tail);
  return parts;
}

function splitPair(part) {
  let depth = 0, quoted = false;
  for (let i = 0; i < part.length; i++) {
    const c = part[i];
    if (quoted) { if (c === "\\") i++; else if (c === '"') quoted = false; continue; }
    if (c === '"') { quoted = true; continue; }
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    else if (c === ":" && depth === 0) return [part.slice(0, i).trim(), part.slice(i + 1)];
  }
  return [part.trim(), ""];
}


// Cut a trailing comment from a value, honouring quotes and nesting. "a # b" is a comment,
// "a#b" is not, and a # inside a quoted scalar or a flow collection is not either.
function stripComment(raw) {
  let depth = 0, quoted = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (quoted) { if (c === "\\") i++; else if (c === '"') quoted = false; continue; }
    if (c === '"') { quoted = true; continue; }
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    else if (c === "#" && depth === 0 && (i === 0 || /\s/.test(raw[i - 1]))) {
      return { body: raw.slice(0, i), comment: raw.slice(i) };
    }
  }
  return { body: raw, comment: "" };
}

// value text -> { value, style }, where style records enough to re-emit faithfully
function parseValue(raw) {
  const cut = stripComment(raw);
  const t = cut.body.trim();
  if (t.startsWith("{")) {
    const body = t.slice(1, t.lastIndexOf("}"));
    const value = {}, keys = [], styles = {};
    for (const part of splitFlow(body)) {
      const [k, v] = splitPair(part);
      if (k === "") continue;
      const inner = parseValue(v);
      value[k] = inner.value; keys.push(k); styles[k] = inner.style;
    }
    return { value, style: { kind: "flow", keys, styles, comment: cut.comment } };
  }
  if (t.startsWith("[")) {
    const body = t.slice(1, t.lastIndexOf("]"));
    const items = splitFlow(body).map((p) => parseValue(p));
    return { value: items.map((i) => i.value), style: { kind: "flowseq", styles: items.map((i) => i.style), comment: cut.comment } };
  }
  const s = parseScalar(t);
  return { value: s.value, style: { kind: "scalar", quote: s.style, comment: cut.comment } };
}

function emitValue(v, style) {
  const trail = style && style.comment ? style.comment : "";
  return emitValueInner(v, style) + trail;
}

function emitValueInner(v, style) {
  if (Array.isArray(v)) {
    const st = style && style.kind === "flowseq" ? style.styles : [];
    return "[" + v.map((x, i) => emitValueInner(x, st[i])).join(", ") + "]";
  }
  if (v && typeof v === "object") {
    const st = style && style.kind === "flow" ? style : { keys: [], styles: {} };
    const keys = st.keys.filter((k) => k in v).concat(Object.keys(v).filter((k) => !st.keys.includes(k)));
    return "{ " + keys.map((k) => `${k}: ${emitValueInner(v[k], st.styles[k])}`).join(", ") + " }";
  }
  return emitScalar(v, style && style.kind === "scalar" ? style.quote : undefined);
}

// ---------------------------------------------------------------- parse

export function parse(text) {
  // A file checked out on Windows arrives with CRLF. Parse either, and remember which, so the
  // serialiser hands back the terminator it was given.
  const crlf = text.includes("\r\n");
  const lines = text.split(/\r?\n/);

  const doc = {}, cst = { text, crlf, header: "", sections: [], footer: "" };
  let i = 0;
  // header: the leading run of comments and blank lines
  while (i < lines.length && (isComment(lines[i]) || isBlank(lines[i]))) {
    if (isBlank(lines[i]) && lines.slice(i).some((l) => !isBlank(l) && !isComment(l)) === false) break;
    if (isBlank(lines[i]) && !isComment(lines[i + 1] ?? "")) { i++; break; }
    i++;
  }
  cst.headerLines = lines.slice(0, i);

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line) || isComment(line)) {
      cst.sections.push({ type: "trivia", text: line });
      i++; continue;
    }
    const m = /^([A-Za-z_][\w-]*):(.*)$/.exec(line);
    if (!m) { cst.sections.push({ type: "trivia", text: line }); i++; continue; }
    const key = m[1], rest = m[2];
    if (rest.trim() !== "") {                                  // scalar on the same line
      const v = parseValue(rest);
      doc[key] = v.value;
      cst.sections.push({ type: "scalar", key, style: v.style, text: line });
      i++; continue;
    }
    // block: gather the indented run
    const start = i + 1; let j = start;
    while (j < lines.length && (isBlank(lines[j]) || indentOf(lines[j]) > 0)) j++;
    while (j > start && isBlank(lines[j - 1])) j--;
    const body = lines.slice(start, j);
    const isSeq = body.some((l) => l.trimStart().startsWith("- "));
    if (isSeq) {
      const items = [];
      let pending = [];
      for (let k = 0; k < body.length; k++) {
        const l = body[k];
        if (l.trimStart().startsWith("- ")) {
          const entryLines = [l];
          const ind = indentOf(l);
          while (k + 1 < body.length && !isBlank(body[k + 1]) && !isComment(body[k + 1]) &&
                 indentOf(body[k + 1]) > ind) entryLines.push(body[++k]);
          items.push({ type: "entry", lines: entryLines, trivia: pending });
          pending = [];
        } else pending.push(l);
      }
      const entries = items.map((it) => parseEntry(it.lines));
      doc[key] = entries.map((e) => e.value);
      cst.sections.push({ type: "seq", key, items, entries, trailing: pending });
    } else {
      const map = parseBlockMap(body, indentOf(body[0] ?? "  "));
      doc[key] = map.value;
      cst.sections.push({ type: "map", key, style: map.style, lines: body });
    }
    i = j;
  }
  // footer: trailing trivia already captured as sections; nothing more to do
  cst.doc = JSON.parse(JSON.stringify(doc));
  return { doc, cst };
}

function parseEntry(entryLines) {
  const first = entryLines[0];
  const dash = first.indexOf("- ");
  const head = first.slice(dash + 2);
  if (head.trim().startsWith("{") && entryLines.length === 1) {
    const v = parseValue(head);
    return { value: v.value, style: { kind: "flow", keys: v.style.keys, styles: v.style.styles }, indent: dash };
  }
  // block entry: "- key: value" then aligned "key: value" lines
  const value = {}, keys = [], styles = {};
  const consume = (txt) => {
    const [k, v] = splitPair(txt);
    if (k === "") return;
    const parsed = parseValue(v);
    value[k] = parsed.value; keys.push(k); styles[k] = parsed.style;
  };
  consume(head);
  for (let i = 1; i < entryLines.length; i++) consume(entryLines[i].trim());
  return { value, style: { kind: "block", keys, styles }, indent: dash };
}

function parseBlockMap(lines, indent) {
  const value = {}, styles = {}, keys = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (isBlank(l) || isComment(l)) continue;
    if (indentOf(l) !== indent) continue;
    const m = /^\s*([A-Za-z_][\w-]*):(.*)$/.exec(l);
    if (!m) continue;
    const key = m[1], rest = m[2];
    if (rest.trim() !== "") {
      const v = parseValue(rest);
      value[key] = v.value; styles[key] = v.style; keys.push(key);
    } else {
      const start = i + 1; let j = start;
      while (j < lines.length && (isBlank(lines[j]) || indentOf(lines[j]) > indent)) j++;
      const sub = parseBlockMap(lines.slice(start, j), indent + 2);
      value[key] = sub.value; styles[key] = sub.style; keys.push(key);
      i = j - 1;
    }
  }
  return { value, style: { kind: "blockmap", keys, styles, indent } };
}

// ---------------------------------------------------------------- serialise

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function emitEntry(entry, style, indent) {
  const pad = " ".repeat(indent);
  if (!style || style.kind === "flow") {
    const line = `${pad}- ` + emitValue(entry, style ? { kind: "flow", keys: style.keys, styles: style.styles } : undefined);
    if (line.length <= 120 || (style && style.kind === "flow")) return [line];
  }
  const keys = style && style.keys ? style.keys.filter((k) => k in entry).concat(Object.keys(entry).filter((k) => !style.keys.includes(k)))
                                   : Object.keys(entry);
  const st = (style && style.styles) || {};
  const out = [];
  keys.forEach((k, n) => {
    const text = `${k}: ${emitValue(entry[k], st[k])}`;
    out.push(n === 0 ? `${pad}- ${text}` : `${pad}  ${text}`);
  });
  return out;
}

function emitBlockMap(value, style, indent) {
  const pad = " ".repeat(indent);
  const keys = style && style.keys ? style.keys.filter((k) => k in value).concat(Object.keys(value).filter((k) => !style.keys.includes(k)))
                                   : Object.keys(value);
  const st = (style && style.styles) || {};
  const out = [];
  for (const k of keys) {
    const v = value[k];
    if (v && typeof v === "object" && !Array.isArray(v) && (!st[k] || st[k].kind === "blockmap")) {
      out.push(`${pad}${k}:`);
      out.push(...emitBlockMap(v, st[k], indent + 2));
    } else out.push(`${pad}${k}: ${emitValue(v, st[k])}`);
  }
  return out;
}

const idOf = (e, key) => (key === "edges" ? `${e.from} ${e.to}` : e && e.id);

export function serialize(cst, doc) {
  const out = [];
  if (cst.headerLines && cst.headerLines.length) out.push(...cst.headerLines);
  const seen = new Set();
  for (const s of cst.sections) {
    if (s.type === "trivia") { out.push(s.text); continue; }
    if (s.type === "scalar") {
      seen.add(s.key);
      if (!(s.key in doc)) continue;
      out.push(same(doc[s.key], cst.doc[s.key]) ? s.text : `${s.key}: ${emitValue(doc[s.key], s.style)}`);
      continue;
    }
    if (s.type === "map") {
      seen.add(s.key);
      if (!(s.key in doc) || doc[s.key] === undefined) continue;
      if (same(doc[s.key], cst.doc[s.key])) { out.push(`${s.key}:`, ...s.lines); continue; }
      out.push(`${s.key}:`, ...emitBlockMap(doc[s.key], s.style, 2));
      continue;
    }
    // sequence
    seen.add(s.key);
    const list = doc[s.key] || [];
    const originals = new Map();
    s.items.forEach((it, n) => {
      const key = idOf(s.entries[n].value, s.key);
      const bucket = originals.get(key) || [];
      bucket.push({ it, entry: s.entries[n] });
      originals.set(key, bucket);
    });
    out.push(`${s.key}:`);
    const used = new Map();
    for (const value of list) {
      const key = idOf(value, s.key);
      const bucket = originals.get(key) || [];
      const n = used.get(key) || 0;
      const orig = bucket[n];
      used.set(key, n + 1);
      if (orig) {
        out.push(...orig.it.trivia);
        if (same(value, orig.entry.value)) out.push(...orig.it.lines);
        else out.push(...emitEntry(value, orig.entry.style, orig.entry.indent));
      } else out.push(...emitEntry(value, null, 2));
    }
    if (s.trailing && s.trailing.length) out.push(...s.trailing);
  }
  for (const key of Object.keys(doc)) {
    if (seen.has(key)) continue;
    const v = doc[key];
    if (Array.isArray(v)) { out.push(`${key}:`, ...v.flatMap((e) => emitEntry(e, null, 2))); }
    else if (v && typeof v === "object") out.push(`${key}:`, ...emitBlockMap(v, null, 2));
    else out.push(`${key}: ${emitValue(v)}`);
  }
  const nl = cst.crlf ? "\r\n" : "\n";
  let text = out.join(nl);
  if (!text.endsWith(nl)) text += nl;
  return text;
}
