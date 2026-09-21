// Colouring for the non-YAML code the documentation prints: shell commands, JSON bodies and
// HTTP request lines. The YAML highlighter next door covers the format itself; this covers the
// three other languages the docs actually use, in the same span model and with the same
// `--syn-*` tints, so a `bash` block and a `yaml` block look like one system.
//
// A grammar engine is not worth a dependency for three small languages, and a wrong tint is
// cheaper than a wrong byte: anything the tokenizer does not recognise stays plain text.
//
// The one hard promise, the same one yaml-highlight.ts makes: the spans of a line, concatenated,
// are the line. `apps/web/src/lib/code-highlight.test.ts` asserts it character for character.

import type { Line, Span, Syn } from "./yaml-highlight";

export type { Line, Span, Syn };

/** The languages that get tinted. Anything else renders as plain text with a label. */
export type CodeLang = "bash" | "json" | "http" | "text";

export const LANGS: Record<string, CodeLang> = {
  bash: "bash",
  sh: "bash",
  shell: "bash",
  console: "bash",
  json: "json",
  http: "http",
};

/** What the label in the corner of a block says. `yaml` never reaches here; YamlView draws it. */
export const LANG_LABEL: Record<string, string> = {
  bash: "bash",
  sh: "bash",
  shell: "bash",
  console: "bash",
  json: "json",
  http: "http",
  yaml: "yaml",
  text: "text",
};

const NUMBER = /^[-+]?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][-+]?[0-9]+)?$/;

class Emitter {
  readonly out: Span[] = [];
  push(t: Syn, s: string) {
    if (!s) return;
    const last = this.out[this.out.length - 1];
    if (last && last.t === t) last.s += s;
    else this.out.push({ t, s });
  }
}

/** The index just past a quoted run starting at `i`, or the end of the line if it never closes. */
function endOfQuote(line: string, i: number): number {
  const q = line[i];
  let j = i + 1;
  while (j < line.length) {
    if (line[j] === "\\" && q !== "'") {
      j += 2;
      continue;
    }
    if (line[j] === q) return j + 1;
    j++;
  }
  return line.length;
}

/* ------------------------------------------------------------------------------------ bash */

// A shell line: an optional `$` prompt, a comment from an unquoted `#`, quoted runs as strings,
// `--flag` and `-f` as keys, bare numbers as numbers, everything else plain.
function bashLine(line: string): Line {
  const e = new Emitter();
  let i = 0;
  while (i < line.length && (line[i] === " " || line[i] === "\t")) i++;
  e.push(null, line.slice(0, i));
  if (line[i] === "#") {
    e.push("comment", line.slice(i));
    return e.out;
  }
  if (line[i] === "$" && (i + 1 === line.length || line[i + 1] === " ")) {
    e.push("punct", "$");
    i++;
  }
  let start = i;
  const flush = (end: number) => {
    const word = line.slice(start, end);
    if (!word) return;
    for (const part of word.split(/( +)/)) {
      if (!part) continue;
      if (/^ +$/.test(part)) e.push(null, part);
      else if (/^--?[A-Za-z0-9][A-Za-z0-9-]*$/.test(part)) e.push("key", part);
      else if (NUMBER.test(part)) e.push("num", part);
      else if (part === "|" || part === "&&" || part === "||" || part === ">" || part === ">>")
        e.push("punct", part);
      else e.push(null, part);
    }
  };
  while (i < line.length) {
    const c = line[i];
    if (c === "#" && (line[i - 1] === " " || line[i - 1] === "\t")) {
      flush(i);
      e.push("comment", line.slice(i));
      return e.out;
    }
    if (c === '"' || c === "'") {
      flush(i);
      const j = endOfQuote(line, i);
      e.push("str", line.slice(i, j));
      i = j;
      start = i;
      continue;
    }
    i++;
  }
  flush(line.length);
  return e.out;
}

/* ------------------------------------------------------------------------------------ json */

// A JSON line: a quoted run followed by a colon is a key, any other quoted run is a string,
// true/false/null are booleans, bare numbers are numbers, structure is punctuation.
function jsonLine(line: string): Line {
  const e = new Emitter();
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === " " || c === "\t") {
      const s = i;
      while (i < line.length && (line[i] === " " || line[i] === "\t")) i++;
      e.push(null, line.slice(s, i));
      continue;
    }
    if (c === '"') {
      const j = endOfQuote(line, i);
      let k = j;
      while (k < line.length && (line[k] === " " || line[k] === "\t")) k++;
      e.push(line[k] === ":" ? "key" : "str", line.slice(i, j));
      i = j;
      continue;
    }
    if ("{}[],:".includes(c)) {
      e.push("punct", c);
      i++;
      continue;
    }
    const s = i;
    while (i < line.length && !' \t"{}[],:'.includes(line[i])) i++;
    const word = line.slice(s, i);
    if (word === "true" || word === "false" || word === "null") e.push("bool", word);
    else if (NUMBER.test(word)) e.push("num", word);
    else e.push(null, word);
  }
  return e.out;
}

/* ------------------------------------------------------------------------------------ http */

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

// An HTTP block: a request line (METHOD path), header lines (Name: value), a blank line, then a
// JSON body. The body is handed to the JSON tokenizer, which is why this one is line-stateful.
function httpLine(line: string, inBody: boolean): Line {
  if (inBody) return jsonLine(line);
  const e = new Emitter();
  if (line.startsWith("#")) {
    e.push("comment", line);
    return e.out;
  }
  const req = /^([A-Z]+)( +)(\S+)(.*)$/.exec(line);
  if (req && METHODS.has(req[1])) {
    e.push("bool", req[1]);
    e.push(null, req[2]);
    e.push("str", req[3]);
    e.push(null, req[4]);
    return e.out;
  }
  const status = /^(HTTP\/[0-9.]+)( +)([0-9]{3})(.*)$/.exec(line);
  if (status) {
    e.push("bool", status[1]);
    e.push(null, status[2]);
    e.push("num", status[3]);
    e.push(null, status[4]);
    return e.out;
  }
  const header = /^([A-Za-z][A-Za-z0-9-]*)(:)(.*)$/.exec(line);
  if (header) {
    e.push("key", header[1]);
    e.push("punct", header[2]);
    e.push("str", header[3]);
    return e.out;
  }
  e.push(null, line);
  return e.out;
}

/* ------------------------------------------------------------------------------------- api */

/**
 * Every line of a block, tokenized. `lines.map(l => l.map(s => s.s).join("")).join("\n")` is the
 * input, exactly, for every language including the unknown one.
 */
export function highlightCode(lang: string, text: string): Line[] {
  const kind = LANGS[lang] ?? "text";
  const src = text.split("\n");
  if (kind === "text") return src.map((l) => (l ? [{ t: null as Syn, s: l }] : []));
  if (kind === "bash") return src.map(bashLine);
  if (kind === "json") return src.map(jsonLine);
  let inBody = false;
  return src.map((l) => {
    const out = httpLine(l, inBody);
    if (!inBody && l.trim() === "") inBody = true;
    return out;
  });
}
