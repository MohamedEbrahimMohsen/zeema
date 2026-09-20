// Colouring for the YAML the site prints. A highlighter dependency would drag a grammar engine
// and a second theme into the app for a language the engine already defines: packages/core
// accepts block maps and sequences, flow maps and sequences, quoted and bare scalars, comments,
// blank lines and one optional "---", and refuses everything else. This tokenizer covers that
// subset, and treats anything outside it as plain text rather than guessing.
//
// The one hard promise: the spans of a line, concatenated, are the line. Nothing is dropped,
// added or reordered, so the rendered block can be read, selected and copied as the source.
// `apps/web/src/lib/yaml-highlight.test.ts` asserts it over every committed design.

export type Syn = "key" | "str" | "num" | "bool" | "comment" | "punct" | null;
export type Span = { t: Syn; s: string };
export type Line = Span[];

const BOOLS = new Set([
  "true",
  "false",
  "null",
  "~",
  "yes",
  "no",
  "on",
  "off",
  "y",
  "n",
  "TRUE",
  "FALSE",
  "NULL",
  "True",
  "False",
  "Null",
  "Yes",
  "No",
  "On",
  "Off",
]);

const INT = /^[-+]?(0|[1-9][0-9]*)$/;
const HEX = /^0x[0-9a-fA-F]+$/;
const OCT = /^0o[0-7]+$/;
const FLOAT = /^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/;
const SPECIAL_NUM = /^([-+]?\.inf|\.nan)$/i;

/** A block scalar header, which core refuses but the site may still be asked to print. */
const BLOCK_HEADER = /^[|>][-+]?[0-9]*$/;

function classify(t: string): Syn {
  if (!t) return null;
  if (BOOLS.has(t)) return "bool";
  if (INT.test(t) || HEX.test(t) || OCT.test(t) || FLOAT.test(t) || SPECIAL_NUM.test(t))
    return "num";
  return "str";
}

/** The index just past a quoted scalar starting at `i`, or the end of the line if it never closes. */
function endOfQuote(line: string, i: number): number {
  const q = line[i];
  let j = i + 1;
  while (j < line.length) {
    const c = line[j];
    if (q === '"' && c === "\\") {
      j += 2;
      continue;
    }
    if (c === q) {
      // In single quotes '' is an escaped quote, not the end.
      if (q === "'" && line[j + 1] === "'") {
        j += 2;
        continue;
      }
      return j + 1;
    }
    j++;
  }
  return line.length;
}

const nextNonSpace = (line: string, i: number) => {
  let j = i;
  while (j < line.length && (line[j] === " " || line[j] === "\t")) j++;
  return j;
};

/** Does the colon at `j` end a key? In a flow map it always does; in a block map it must be
 *  followed by a space or the end of the line, which is what makes `http://x` one scalar. */
const colonEndsKey = (line: string, j: number, depth: number) =>
  line[j] === ":" && (depth > 0 || j + 1 >= line.length || line[j + 1] === " ");

function tokenize(line: string): Line {
  const out: Line = [];
  const push = (t: Syn, s: string) => {
    if (s) out.push({ t, s });
  };
  let i = 0;
  let depth = 0;

  const run = (pred: (c: string) => boolean) => {
    const start = i;
    while (i < line.length && pred(line[i])) i++;
    return line.slice(start, i);
  };

  push(
    null,
    run((c) => c === " " || c === "\t"),
  );
  if (i >= line.length) return out;
  if (line[i] === "#") {
    push("comment", line.slice(i));
    return out;
  }
  // One optional document marker, then the rest of the line as usual.
  const head = line.slice(i, i + 3);
  if ((head === "---" || head === "...") && (i + 3 === line.length || line[i + 3] === " ")) {
    push("punct", head);
    i += 3;
  }
  // Block sequence markers, which nest: "- - id" is a sequence inside a sequence.
  while (line[i] === "-" && (i + 1 >= line.length || line[i + 1] === " ")) {
    push("punct", "-");
    i++;
    push(
      null,
      run((c) => c === " "),
    );
  }

  while (i < line.length) {
    const c = line[i];
    if (c === " " || c === "\t") {
      push(
        null,
        run((ch) => ch === " " || ch === "\t"),
      );
      continue;
    }
    // A comment needs whitespace in front of it, so a "#" inside a scalar stays in the scalar.
    if (c === "#" && (i === 0 || line[i - 1] === " " || line[i - 1] === "\t")) {
      push("comment", line.slice(i));
      break;
    }
    if (c === '"' || c === "'") {
      const j = endOfQuote(line, i);
      const after = nextNonSpace(line, j);
      push(colonEndsKey(line, after, depth) ? "key" : "str", line.slice(i, j));
      i = j;
      continue;
    }
    if (c === "{" || c === "[") {
      push("punct", c);
      depth++;
      i++;
      continue;
    }
    if (c === "}" || c === "]") {
      push("punct", c);
      depth = Math.max(0, depth - 1);
      i++;
      continue;
    }
    if (c === "," || c === ":") {
      push("punct", c);
      i++;
      continue;
    }
    // A plain scalar, or a plain key. It runs to a flow punctuation mark, a key colon, or a
    // comment; trailing blanks belong to nobody and are emitted untinted.
    const start = i;
    while (
      i < line.length &&
      !"{}[],".includes(line[i]) &&
      !colonEndsKey(line, i, depth) &&
      !(line[i] === "#" && i > start && (line[i - 1] === " " || line[i - 1] === "\t"))
    )
      i++;
    const raw = line.slice(start, i);
    const body = raw.replace(/[ \t]+$/, "");
    push(line[i] === ":" ? "key" : classify(body), body);
    push(null, raw.slice(body.length));
  }
  return out;
}

const indentOf = (line: string) => /^[ \t]*/.exec(line)?.[0].length ?? 0;

/**
 * Every line of a document, tokenized. `lines.map(l => l.map(s => s.s).join("")).join("\n")`
 * is the input, exactly.
 */
export function highlightYaml(text: string): Line[] {
  const src = text.split("\n");
  const out: Line[] = [];
  // Inside a block scalar every more-indented line is content, so a "#" or a ":" in there is
  // text and nothing else.
  let block: number | null = null;
  for (const line of src) {
    if (block !== null) {
      if (line.trim() === "" || indentOf(line) > block) {
        const ws = /^[ \t]*/.exec(line)?.[0] ?? "";
        const rest = line.slice(ws.length);
        out.push(
          rest
            ? [
                { t: null, s: ws },
                { t: "str", s: rest },
              ]
            : ws
              ? [{ t: null, s: ws }]
              : [],
        );
        continue;
      }
      block = null;
    }
    const spans = tokenize(line);
    out.push(spans);
    // "desc: |" opens a block scalar; the last thing said on the line is the header.
    const last = spans.filter((s) => s.t !== "comment" && s.s.trim() !== "").at(-1);
    if (last && BLOCK_HEADER.test(last.s)) block = indentOf(line);
  }
  return out;
}
