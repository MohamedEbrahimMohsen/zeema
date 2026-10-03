// YAML for Zeema documents: a parser that keeps a concrete syntax tree with every source span,
// and a serialiser that copies unchanged spans back out verbatim and rewrites only what changed.
//
//   parse(text)          -> { doc, cst }     throws Error("... at line N") on unsupported input
//   serialize(cst, doc)  -> text
//
// Guarantees (docs/final-plan.md, A7):
//   - an unmodified document round-trips byte for byte: comments, blank lines, quoting, flow
//     versus block style, indentation, line endings;
//   - an edited document differs only on the lines needed to express the edit;
//   - a construct outside the supported subset is refused with a line number, never parsed
//     into something else. The subset: block maps, block sequences, flow maps and sequences
//     (single or multi-line), double-quoted, single-quoted and bare scalars, comments, blank
//     lines, any consistent indentation, one optional leading "---". Refused: anchors, aliases,
//     tags, block scalars, complex keys, tabs in indentation, multiple documents, duplicate keys.
//
// The CST is a tree of nodes. Every node has `kind` and `value`; block nodes carry the source
// line range of each entry or item so the serialiser can emit it verbatim when its value is
// unchanged. Trivia (comment and blank lines) attaches to the entry that follows it, and the
// tail of a block keeps the trivia after its last entry.

// ------------------------------------------------------------------ limits
//
// A design is a few thousand nodes at most, nested a handful of levels deep. These ceilings
// sit far above any real document and far below what would hurt: past MAX_DEPTH the recursive
// descent would eventually overflow the stack, and past MAX_NODES the rule engine would spend
// seconds on one request. Both are refused with a line number, like any other unsupported input.
export const MAX_DEPTH = 64;
export const MAX_NODES = 100_000;

// The node budget of the parse in progress. parse() is synchronous, so one module-level counter
// is never shared between two parses.
let nodeCount = 0;
function countNode(line) {
  if (++nodeCount > MAX_NODES) refuse(line, `more than ${MAX_NODES} values`);
}

// ------------------------------------------------------------------ scalars

const BARE_SAFE = /^[A-Za-z_][A-Za-z0-9_./-]*$/;
const RESERVED = new Set(["true", "false", "null", "~", "yes", "no", "on", "off", "y", "n"]);
const INT = /^[-+]?(0|[1-9][0-9]*)$/;
const HEX = /^0x[0-9a-fA-F]+$/;
const OCT = /^0o[0-7]+$/;
const FLOAT = /^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/;

/** Parse one scalar's source text. Returns { value, quote } where quote is double|single|bare|empty. */
export function parseScalar(raw) {
  const t = raw.trim();
  if (t === "") return { value: null, quote: "empty" };
  if (t[0] === '"') {
    const { value, end } = readDouble(t, 0);
    if (t.slice(end).trim() !== "") throw new Error(`text after closing quote: ${t}`);
    return { value, quote: "double" };
  }
  if (t[0] === "'") {
    const { value, end } = readSingle(t, 0);
    if (t.slice(end).trim() !== "") throw new Error(`text after closing quote: ${t}`);
    return { value, quote: "single" };
  }
  return { value: bareValue(t), quote: "bare" };
}

function bareValue(t) {
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null" || t === "~") return null;
  if (INT.test(t)) return Number.parseInt(t, 10);
  if (HEX.test(t)) return Number.parseInt(t.slice(2), 16);
  if (OCT.test(t)) return Number.parseInt(t.slice(2), 8);
  if (FLOAT.test(t) && t !== "." && !/^[-+]?\.$/.test(t)) return Number.parseFloat(t);
  if (/^[-+]?\.inf$/i.test(t)) return t.startsWith("-") ? -Infinity : Infinity;
  if (/^\.nan$/i.test(t)) return Number.NaN;
  return t;
}

function readDouble(s, i) {
  let out = "";
  let j = i + 1;
  for (; j < s.length; j++) {
    const c = s[j];
    if (c === "\\") {
      const n = s[++j];
      if (n === "n") out += "\n";
      else if (n === "t") out += "\t";
      else if (n === "r") out += "\r";
      else if (n === "0") out += "\0";
      else if (n === "u") {
        out += String.fromCharCode(Number.parseInt(s.slice(j + 1, j + 5), 16));
        j += 4;
      } else if (n === "x") {
        out += String.fromCharCode(Number.parseInt(s.slice(j + 1, j + 3), 16));
        j += 2;
      } else out += n;
      continue;
    }
    if (c === '"') return { value: out, end: j + 1 };
    out += c;
  }
  throw new Error("unterminated double-quoted string");
}

function readSingle(s, i) {
  let out = "";
  let j = i + 1;
  for (; j < s.length; j++) {
    const c = s[j];
    if (c === "'") {
      if (s[j + 1] === "'") {
        out += "'";
        j++;
        continue;
      }
      return { value: out, end: j + 1 };
    }
    out += c;
  }
  throw new Error("unterminated single-quoted string");
}

/** Emit a scalar in the requested quote style, falling back to double quotes when the style would change its meaning. */
export function emitScalar(v, quote) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return String(v);
  if (typeof v === "number")
    return Number.isFinite(v) ? String(v) : Number.isNaN(v) ? ".nan" : v > 0 ? ".inf" : "-.inf";
  const s = String(v);
  if (quote === "bare" && bareIsSafe(s)) return s;
  if (quote === "single" && !/[\n\r]/.test(s)) return `'${s.replace(/'/g, "''")}'`;
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")}"`;
}

function bareIsSafe(s) {
  if (!BARE_SAFE.test(s)) return false;
  if (RESERVED.has(s.toLowerCase())) return false;
  if (INT.test(s) || FLOAT.test(s) || HEX.test(s) || OCT.test(s)) return false;
  return true;
}

// ------------------------------------------------------------------ flow collections

// Parse a flow collection or scalar starting at text[pos]. Returns { node, end }. Nodes:
//   { kind: "scalar", value, quote }
//   { kind: "flowmap", value, entries: [{ key, keyQuote, node }] }
//   { kind: "flowseq", value, items: [node] }
function parseFlowValue(text, pos, line, depth = 0) {
  const i = skipSpace(text, pos);
  const c = text[i];
  countNode(line);
  if (c === "{" || c === "[") {
    if (depth >= MAX_DEPTH) refuse(line, `nesting deeper than ${MAX_DEPTH} levels`);
    return c === "{"
      ? parseFlowMap(text, i, line, depth + 1)
      : parseFlowSeq(text, i, line, depth + 1);
  }
  if (c === '"') {
    const r = readDouble(text, i);
    return { node: { kind: "scalar", value: r.value, quote: "double" }, end: r.end };
  }
  if (c === "'") {
    const r = readSingle(text, i);
    return { node: { kind: "scalar", value: r.value, quote: "single" }, end: r.end };
  }
  if (c === "&" || c === "*" || c === "!")
    refuse(line, `${c === "!" ? "tags" : c === "&" ? "anchors" : "aliases"} are not supported`);
  // bare scalar: up to a flow terminator at depth 0
  let j = i;
  while (
    j < text.length &&
    !(
      text[j] === "," ||
      text[j] === "}" ||
      text[j] === "]" ||
      (text[j] === ":" &&
        (text[j + 1] === " " ||
          text[j + 1] === undefined ||
          text[j + 1] === "," ||
          text[j + 1] === "}"))
    )
  )
    j++;
  const raw = text.slice(i, j).trim();
  return {
    node: {
      kind: "scalar",
      value: raw === "" ? null : bareValue(raw),
      quote: raw === "" ? "empty" : "bare",
    },
    end: j,
  };
}

function parseFlowMap(text, pos, line, depth) {
  const entries = [];
  const value = {};
  let i = pos + 1;
  for (;;) {
    i = skipSpace(text, i);
    if (i >= text.length) refuse(line, "unterminated flow mapping");
    if (text[i] === "}") return { node: { kind: "flowmap", value, entries }, end: i + 1 };
    if (text[i] === ",") {
      i++;
      continue;
    }
    let key;
    let keyQuote = "bare";
    if (text[i] === '"') {
      const r = readDouble(text, i);
      key = r.value;
      keyQuote = "double";
      i = r.end;
    } else if (text[i] === "'") {
      const r = readSingle(text, i);
      key = r.value;
      keyQuote = "single";
      i = r.end;
    } else {
      let j = i;
      while (j < text.length && text[j] !== ":" && text[j] !== "," && text[j] !== "}") j++;
      key = text.slice(i, j).trim();
      i = j;
    }
    i = skipSpace(text, i);
    let node;
    if (text[i] === ":") {
      i++;
      const r = parseFlowValue(text, i, line, depth);
      node = r.node;
      i = r.end;
    } else node = { kind: "scalar", value: null, quote: "empty" };
    if (Object.hasOwn(value, key)) refuse(line, `duplicate key ${key}`);
    entries.push({ key, keyQuote, node });
    setOwn(value, key, node.value);
  }
}

function parseFlowSeq(text, pos, line, depth) {
  const items = [];
  const value = [];
  let i = pos + 1;
  for (;;) {
    i = skipSpace(text, i);
    if (i >= text.length) refuse(line, "unterminated flow sequence");
    if (text[i] === "]") return { node: { kind: "flowseq", value, items }, end: i + 1 };
    if (text[i] === ",") {
      i++;
      continue;
    }
    const r = parseFlowValue(text, i, line, depth);
    items.push(r.node);
    value.push(r.node.value);
    i = r.end;
  }
}

function skipSpace(text, i) {
  let j = i;
  while (
    j < text.length &&
    (text[j] === " " || text[j] === "\n" || text[j] === "\r" || text[j] === "\t")
  )
    j++;
  return j;
}

// Cut a trailing comment from a value, honouring quotes and flow nesting. "a # b" is a comment,
// "a#b" is not, and a # inside a quoted scalar or a flow collection is not either.
function stripComment(raw) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (quote === '"') {
      if (c === "\\") i++;
      else if (c === '"') quote = null;
      continue;
    }
    if (quote === "'") {
      if (c === "'") quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      if (i === 0 || /[\s,{[:]/.test(raw[i - 1])) quote = c;
      continue;
    }
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    else if (c === "#" && depth === 0 && (i === 0 || /\s/.test(raw[i - 1]))) {
      return { body: raw.slice(0, i).replace(/\s+$/, ""), comment: raw.slice(i) };
    }
  }
  return { body: raw.replace(/\s+$/, ""), comment: "" };
}

// Bracket balance of flow text (outside quotes), scanned incrementally: a multi-line flow
// collection is fed one line at a time, so the scan is linear in the text rather than
// rescanning everything read so far for every line. Nesting past MAX_DEPTH is refused here,
// before the recursive parser ever sees it.
function flowScanner(line) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  return {
    feed(text) {
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quote === '"') {
          if (escaped) escaped = false;
          else if (c === "\\") escaped = true;
          else if (c === '"') quote = null;
          continue;
        }
        if (quote === "'") {
          if (c === "'") quote = null;
          continue;
        }
        if (c === '"' || c === "'") {
          quote = c;
          continue;
        }
        if (c === "{" || c === "[") {
          if (++depth > MAX_DEPTH) refuse(line, `nesting deeper than ${MAX_DEPTH} levels`);
        } else if (c === "}" || c === "]") depth--;
      }
      return depth <= 0 && quote === null;
    },
  };
}

// A plain object that takes any key as data: `__proto__` included, which plain assignment would
// treat as the prototype.
function setOwn(obj, key, v) {
  if (key === "__proto__")
    Object.defineProperty(obj, key, {
      value: v,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  else obj[key] = v;
}

// ------------------------------------------------------------------ block parser

const isBlank = (l) => l.trim() === "";
const isComment = (l) => l.trimStart().startsWith("#");
const isTrivia = (l) => isBlank(l) || isComment(l);
const indentOf = (l) => l.length - l.trimStart().length;
const isDash = (l) => {
  const t = l.trimStart();
  return t === "-" || t.startsWith("- ");
};

function refuse(line, what) {
  throw new Error(`${what} at line ${line + 1}`);
}

// A key line: `key:` followed by a space or the end of the line. Keys may be bare or quoted.
function matchKey(text) {
  let m = /^([A-Za-z_][A-Za-z0-9_.-]*):(?:\s(.*))?$/.exec(text);
  if (m) return { key: m[1], keyQuote: "bare", rest: m[2] ?? "" };
  m = /^"((?:[^"\\]|\\.)*)":(?:\s(.*))?$/.exec(text);
  if (m) return { key: readDouble(`"${m[1]}"`, 0).value, keyQuote: "double", rest: m[2] ?? "" };
  m = /^'((?:[^']|'')*)':(?:\s(.*))?$/.exec(text);
  if (m) return { key: readSingle(`'${m[1]}'`, 0).value, keyQuote: "single", rest: m[2] ?? "" };
  return null;
}

class Parser {
  constructor(text) {
    this.crlf = text.includes("\r\n");
    this.trailingNewline = text === "" || /\r?\n$/.test(text);
    const lines = text.split(/\r?\n/);
    if (this.trailingNewline && lines.length && lines[lines.length - 1] === "") lines.pop();
    this.orig = lines;
    this.work = lines.slice();
    this.pos = 0;
    this.depth = 0;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*\t/.test(lines[i]) || /^ *\t/.test(lines[i]))
        refuse(i, "tab indentation is not supported");
    }
  }

  // Skip trivia; return the index of the next content line or lines.length.
  nextContent(from) {
    let i = from;
    while (i < this.work.length && isTrivia(this.work[i])) i++;
    return i;
  }

  parseDocument() {
    let start = 0;
    let i = this.nextContent(0);
    if (i < this.work.length && /^---(\s|$)/.test(this.work[i])) {
      const rest = this.work[i].slice(3).trim();
      if (rest !== "" && !rest.startsWith("#"))
        refuse(i, "content on the document marker line is not supported");
      this.work[i] = `#${this.work[i].slice(1)}`; // treat the marker as trivia from here on
      start = 0;
      i = this.nextContent(i + 1);
    }
    for (let k = i; k < this.work.length; k++) {
      if (/^(---|\.\.\.)(\s|$)/.test(this.work[k]))
        refuse(k, "multiple documents are not supported");
    }
    let root;
    if (i >= this.work.length)
      root = {
        kind: "blockmap",
        value: {},
        indent: 0,
        entries: [],
        after: this.orig.slice(start),
        lineStart: start,
        lineEnd: this.orig.length,
      };
    else if (isDash(this.work[i])) refuse(i, "a top-level sequence is not supported");
    else {
      root = this.parseBlockMap(i, indentOf(this.work[i]), -1);
      root.lineStart = start;
    }
    // Everything after the root block is its tail trivia.
    const tailFrom = root.lineEnd;
    root.after = this.orig.slice(tailFrom);
    root.lineEnd = this.orig.length;
    if (root.entries.length)
      root.entries[0].before = this.orig.slice(start, root.entries[0].lineStart);
    return root;
  }

  // Parse a block map whose keys sit at column `indent`, starting at content line `i`.
  // `parentIndent` is the column of the enclosing block; a line at or below it ends this map.
  // `from` is the first line after the owning key or dash line: the trivia between it and `i`
  // belongs to the first entry, so a re-emitted parent keeps it.
  parseBlockMap(i, indent, parentIndent, from = i) {
    const node = {
      kind: "blockmap",
      value: {},
      indent,
      entries: [],
      after: [],
      lineStart: i,
      lineEnd: i,
    };
    let cursor = from;
    for (;;) {
      const next = this.nextContent(cursor);
      if (next >= this.work.length) {
        node.after = this.orig.slice(cursor, next);
        node.lineEnd = next;
        return node;
      }
      const line = this.work[next];
      const ind = indentOf(line);
      if (ind < indent) {
        node.after = [];
        node.lineEnd = cursor;
        return node;
      }
      if (ind > indent) refuse(next, "unexpected indentation");
      if (isDash(line)) {
        // A sequence at the same column as its parent key is handled by the entry that owns
        // it; reaching one here means this map is finished.
        node.after = [];
        node.lineEnd = cursor;
        return node;
      }
      const km = matchKey(line.trimStart());
      if (!km) {
        if (/^\s*\?/.test(line)) refuse(next, "complex keys are not supported");
        refuse(next, "expected a `key:` line");
      }
      if (Object.hasOwn(node.value, km.key)) refuse(next, `duplicate key ${km.key}`);
      countNode(next);
      const entry = {
        key: km.key,
        keyQuote: km.keyQuote,
        before: this.orig.slice(cursor, next),
        lineStart: next,
        lineEnd: next + 1,
        comment: "",
        node: null,
      };
      const { body, comment } = stripComment(km.rest);
      entry.comment = comment;
      if (body.trim() !== "") {
        const r = this.parseInlineValue(
          next,
          body,
          line.length - km.rest.length + (km.rest.length - km.rest.trimStart().length),
        );
        entry.node = r.node;
        entry.lineEnd = r.lineEnd;
      } else {
        // The value is whatever follows at a deeper indent, a sequence at this indent, or null.
        const after = this.nextContent(next + 1);
        if (after < this.work.length) {
          const aind = indentOf(this.work[after]);
          if (
            aind > indent ||
            (aind === indent && isDash(this.work[after]) && parentIndent < indent)
          ) {
            const child = this.parseBlock(after, aind, indent, next + 1);
            entry.node = child;
            entry.lineEnd = child.lineEnd;
          }
        }
        if (!entry.node) entry.node = { kind: "empty", value: null };
      }
      setOwn(node.value, km.key, entry.node.value);
      node.entries.push(entry);
      cursor = entry.lineEnd;
    }
  }

  // Parse a block sequence whose dashes sit at column `indent`; `from` as for parseBlockMap.
  parseBlockSeq(i, indent, from = i) {
    const node = {
      kind: "blockseq",
      value: [],
      indent,
      items: [],
      after: [],
      lineStart: i,
      lineEnd: i,
    };
    let cursor = from;
    for (;;) {
      const next = this.nextContent(cursor);
      if (next >= this.work.length) {
        node.after = this.orig.slice(cursor, next);
        node.lineEnd = next;
        return node;
      }
      const line = this.work[next];
      const ind = indentOf(line);
      if (ind < indent || (ind === indent && !isDash(line))) {
        node.after = [];
        node.lineEnd = cursor;
        return node;
      }
      if (ind > indent) refuse(next, "unexpected indentation");
      countNode(next);
      const item = {
        before: this.orig.slice(cursor, next),
        lineStart: next,
        lineEnd: next + 1,
        node: null,
        comment: "",
      };
      const dashCol = ind;
      // Each further `- ` on this line opens one more compact nested sequence. Count them up
      // front, reading no more than MAX_DEPTH of them, so a hostile chain is refused before
      // every level rescans the whole line.
      let extra = 0;
      for (let j = dashCol + 1; extra + this.depth <= MAX_DEPTH; extra++) {
        while (line[j] === " ") j++;
        if (line[j] !== "-" || (line[j + 1] !== " " && j + 1 < line.length)) break;
        j++;
      }
      if (this.depth + extra > MAX_DEPTH) refuse(next, `nesting deeper than ${MAX_DEPTH} levels`);
      const afterDash = line.slice(dashCol + 1);
      const contentCol = dashCol + 1 + (afterDash.length - afterDash.trimStart().length);
      const content = line.slice(contentCol);
      const { body, comment } = stripComment(content);
      if (body.trim() === "") {
        item.comment = comment;
        const after = this.nextContent(next + 1);
        if (after < this.work.length && indentOf(this.work[after]) > dashCol) {
          const child = this.parseBlock(after, indentOf(this.work[after]), dashCol, next + 1);
          item.node = child;
          item.lineEnd = child.lineEnd;
        } else item.node = { kind: "empty", value: null };
      } else if (isDash(body) || matchKey(body)) {
        // Compact nested block: blank the dash and parse the rest as a block at contentCol.
        this.work[next] = " ".repeat(contentCol) + line.slice(contentCol);
        const child = this.parseBlock(next, contentCol, dashCol);
        item.node = child;
        item.lineEnd = child.lineEnd;
      } else {
        const r = this.parseInlineValue(next, body, contentCol);
        item.node = r.node;
        item.lineEnd = r.lineEnd;
        item.comment = comment;
      }
      node.value.push(item.node.value);
      node.items.push(item);
      cursor = item.lineEnd;
    }
  }

  parseBlock(i, indent, parentIndent, from = i) {
    if (++this.depth > MAX_DEPTH) refuse(i, `nesting deeper than ${MAX_DEPTH} levels`);
    try {
      return isDash(this.work[i])
        ? this.parseBlockSeq(i, indent, from)
        : this.parseBlockMap(i, indent, parentIndent, from);
    } finally {
      this.depth--;
    }
  }

  // A value on the same line as its key or dash: a scalar, or a flow collection that may
  // continue over following lines until its brackets balance.
  parseInlineValue(i, body, _col) {
    const t = body.trim();
    if (t[0] === "|" || t[0] === ">") refuse(i, "block scalars are not supported");
    if (t[0] === "&") refuse(i, "anchors are not supported");
    if (t[0] === "*") refuse(i, "aliases are not supported");
    if (t[0] === "!") refuse(i, "tags are not supported");
    if (t[0] === "{" || t[0] === "[") {
      const parts = [t];
      const scan = flowScanner(i);
      let balanced = scan.feed(t);
      let end = i + 1;
      while (!balanced) {
        if (end >= this.work.length) refuse(i, "unterminated flow collection");
        const more = `\n${stripComment(this.work[end]).body}`;
        parts.push(more);
        balanced = scan.feed(more);
        end++;
      }
      const text = parts.join("");
      const r = parseFlowValue(text, 0, i, this.depth);
      if (text.slice(r.end).trim() !== "") refuse(i, "text after a flow collection");
      r.node.multiline = end > i + 1;
      return { node: r.node, lineEnd: end };
    }
    let s;
    try {
      s = parseScalar(t);
    } catch (e) {
      refuse(i, e.message);
    }
    return { node: { kind: "scalar", value: s.value, quote: s.quote }, lineEnd: i + 1 };
  }
}

export function parse(text) {
  nodeCount = 0;
  const p = new Parser(text);
  const root = p.parseDocument();
  const cst = { root, lines: p.orig, crlf: p.crlf, trailingNewline: p.trailingNewline };
  return { doc: clone(root.value), cst };
}

/**
 * The 1-based line a path points at in a parsed text: `path` is keys and indexes, like
 * `["nodes", 3, "component"]`. It walks block maps and block sequences and stops at the deepest
 * step it can follow (a flow collection keeps its own line), so a path that runs out early still
 * names the closest line. Null when not even the first step is found, or for an empty path.
 */
export function lineAt(cst, path) {
  let node = cst?.root;
  let line = null;
  for (const step of path ?? []) {
    let next = null;
    if (node?.kind === "blockmap") next = node.entries.find((e) => e.key === String(step));
    else if (node?.kind === "blockseq" && Number.isInteger(step)) next = node.items[step];
    if (!next) break;
    line = next.lineStart + 1;
    node = next.node;
  }
  return line;
}

// ------------------------------------------------------------------ serialiser

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const present = (v) => v !== undefined;

class Emitter {
  constructor(cst) {
    this.lines = cst.lines;
    this.out = [];
  }

  verbatim(from, to) {
    for (let i = from; i < to; i++) this.out.push(this.lines[i]);
  }

  push(...lines) {
    this.out.push(...lines);
  }

  emitBlockMap(node, value, indent) {
    const pad = " ".repeat(indent);
    const seen = new Set();
    for (const entry of node.entries) {
      seen.add(entry.key);
      const v = value[entry.key];
      if (!present(v)) continue; // key removed: its lines and the trivia above it go with it
      this.push(...entry.before);
      if (same(v, entry.node.value)) {
        this.verbatim(entry.lineStart, entry.lineEnd);
        continue;
      }
      this.emitEntry(entry.key, entry.keyQuote, v, entry.node, entry.comment, indent, pad);
    }
    for (const key of Object.keys(value)) {
      if (seen.has(key) || !present(value[key])) continue;
      this.emitEntry(key, "bare", value[key], null, "", indent, pad);
    }
    this.push(...node.after);
  }

  emitEntry(key, keyQuote, v, style, comment, indent, pad) {
    const k = keyQuote === "bare" ? key : emitScalar(key, keyQuote);
    const trail = comment ? ` ${comment}` : "";
    if (isObj(v)) {
      if (style && style.kind === "blockmap") {
        this.push(`${pad}${k}:${trail}`);
        this.emitBlockMap(style, v, style.indent);
        return;
      }
      if (style && style.kind === "flowmap") {
        this.push(`${pad}${k}: ${emitFlow(v, style)}${trail}`);
        return;
      }
      if (Object.keys(v).length === 0) {
        this.push(`${pad}${k}: {}${trail}`);
        return;
      }
      this.push(`${pad}${k}:${trail}`);
      this.emitBlockMap({ entries: [], after: [] }, v, indent + 2);
      return;
    }
    if (Array.isArray(v)) {
      if (style && style.kind === "blockseq" && v.length) {
        this.push(`${pad}${k}:${trail}`);
        this.emitBlockSeq(style, v, style.indent);
        return;
      }
      if (style && style.kind === "flowseq" && (v.length === 0 || !v.every(isObj))) {
        this.push(`${pad}${k}: ${emitFlow(v, style)}${trail}`);
        return;
      }
      if (v.length === 0) {
        // A block sequence with nothing in it has no block form: "edges:" alone is null.
        this.push(`${pad}${k}: []${trail}`);
        return;
      }
      if (v.every(isObj)) {
        this.push(`${pad}${k}:${trail}`);
        this.emitBlockSeq({ items: [], after: [], indent: indent + 2 }, v, indent + 2);
        return;
      }
      this.push(`${pad}${k}: ${emitFlow(v, null)}${trail}`);
      return;
    }
    if (v === null && style && style.kind === "empty") {
      this.push(`${pad}${k}:${trail}`);
      return;
    }
    const quote = style && style.kind === "scalar" ? style.quote : undefined;
    this.push(`${pad}${k}: ${emitScalar(v, quote)}${trail}`);
  }

  emitBlockSeq(node, list, indent) {
    const pad = " ".repeat(indent);
    const originals = node.items.map((it) => ({ it, used: false }));
    const findExact = (v) => originals.find((o) => !o.used && same(o.it.node.value, v));
    const findById = (v) => {
      const id = identity(v);
      return id === null
        ? undefined
        : originals.find((o) => !o.used && identity(o.it.node.value) === id);
    };
    // The style new items take: flow if every existing item is a one-line flow map, else block.
    const flowSiblings =
      node.items.length > 0 &&
      node.items.every((it) => it.node.kind === "flowmap" && !it.node.multiline);
    // Match every value to the original it came from, in passes so a weaker match never takes
    // an original a stronger one wants: the same value, then the same identity, then the unused
    // original at the same position, which is what an edit that changes an identity
    // (reconnecting or reversing an edge) leaves behind.
    const matched = list.map(() => undefined);
    const pass = (find) =>
      list.forEach((v, i) => {
        if (matched[i]) return;
        const o = find(v, i);
        if (o) {
          o.used = true;
          matched[i] = o;
        }
      });
    pass(findExact);
    pass(findById);
    pass((v, i) => {
      const o = originals[i];
      return o && !o.used && isObj(v) === isObj(o.it.node.value) ? o : undefined;
    });
    for (const [i, v] of list.entries()) {
      const o = matched[i];
      if (o) {
        this.push(...o.it.before);
        if (same(v, o.it.node.value)) {
          this.verbatim(o.it.lineStart, o.it.lineEnd);
          continue;
        }
        this.emitItem(v, o.it.node, o.it.comment, indent, pad);
        continue;
      }
      this.emitItem(
        v,
        flowSiblings || !isObj(v) ? { kind: "flowmap", entries: [] } : null,
        "",
        indent,
        pad,
      );
    }
    this.push(...node.after);
  }

  emitItem(v, style, comment, indent, pad) {
    const trail = comment ? ` ${comment}` : "";
    if (isObj(v)) {
      if (style && style.kind === "flowmap") {
        this.push(`${pad}- ${emitFlow(v, style)}${trail}`);
        return;
      }
      // compact block map: first key on the dash line, the rest at the content column
      const sub =
        style && style.kind === "blockmap" ? style : { entries: [], after: [], indent: indent + 2 };
      const before = this.out.length;
      this.emitBlockMap(sub, v, sub.indent);
      if (this.out.length === before) {
        this.push(`${pad}- {}${trail}`);
        return;
      }
      // The first emitted line belongs on the dash line. Trivia before the first entry would
      // otherwise land above the dash; keep it there and put the dash on the first key line.
      let first = before;
      while (first < this.out.length && isTrivia(this.out[first])) first++;
      if (first >= this.out.length) {
        this.out.splice(before, 0, `${pad}-${trail}`);
        return;
      }
      const line = this.out[first];
      this.out[first] = `${pad}- ${line.slice(sub.indent)}`;
      return;
    }
    if (Array.isArray(v)) {
      this.push(`${pad}- ${emitFlow(v, style && style.kind === "flowseq" ? style : null)}${trail}`);
      return;
    }
    const quote = style && style.kind === "scalar" ? style.quote : undefined;
    this.push(`${pad}- ${emitScalar(v, quote)}${trail}`);
  }
}

// Identity of a sequence item for matching edits: a node's id, an edge's endpoints, a group's id.
function identity(v) {
  if (!isObj(v)) return null;
  if (typeof v.id === "string") return `id:${v.id}`;
  if (typeof v.from === "string" && typeof v.to === "string") return `edge:${v.from}>${v.to}`;
  return null;
}

// Emit a value in flow style, taking per-entry quoting and key order from `style` when given.
function emitFlow(v, style) {
  if (Array.isArray(v)) {
    const items = style && style.kind === "flowseq" ? style.items : [];
    return `[${v.map((x, i) => emitFlow(x, items[i])).join(", ")}]`;
  }
  if (isObj(v)) {
    const entries = style && style.kind === "flowmap" ? style.entries : [];
    const order = entries.map((e) => e.key).filter((k) => present(v[k]));
    for (const k of Object.keys(v)) if (present(v[k]) && !order.includes(k)) order.push(k);
    if (order.length === 0) return "{}";
    const parts = order.map((k) => {
      const e = entries.find((x) => x.key === k);
      const key = e && e.keyQuote !== "bare" ? emitScalar(k, e.keyQuote) : k;
      return `${key}: ${emitFlow(v[k], e ? e.node : null)}`;
    });
    return `{ ${parts.join(", ")} }`;
  }
  return emitScalar(v, style && style.kind === "scalar" ? style.quote : undefined);
}

export function serialize(cst, doc) {
  const em = new Emitter(cst);
  const root = cst.root;
  em.emitBlockMap(root, doc, root.indent);
  const nl = cst.crlf ? "\r\n" : "\n";
  let text = em.out.join(nl);
  if (cst.trailingNewline || em.out.length) text += nl;
  return text;
}
