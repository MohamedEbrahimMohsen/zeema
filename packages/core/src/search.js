// Component search: the words a person types against the rows `searchRows` in @zeema/catalogue
// builds. One implementation for every search box: the canvas picker, quick actions (Ctrl+K), the
// icon picker and the CLI's `catalogue find`.

/**
 * A typed word and the other words that mean the same thing to someone looking for a component.
 * Only the shorthand people actually type; a synonym widens the hits, it never narrows them.
 */
export const SYNONYMS = Object.freeze({
  db: ["database"],
  database: ["db"],
  vm: ["virtual machine"],
  k8s: ["kubernetes"],
  lb: ["load balancer"],
  fn: ["function"],
  func: ["function"],
  mq: ["queue"],
  nosql: ["document", "key-value", "wide-column"],
  storage: ["blob", "object store", "bucket"],
});

/** The word and its synonyms, the word first. Lower-case in, lower-case out. */
export function alternatives(word) {
  const w = String(word).toLowerCase();
  return Object.hasOwn(SYNONYMS, w) ? [w, ...SYNONYMS[w]] : [w];
}

/** True when the haystack holds the word or one of its synonyms. */
export function matchesWord(hay, word) {
  return alternatives(word).some((a) => hay.includes(a));
}

/**
 * How well a search row ([id, name, kind, category, provider, haystack, aliases]) answers the
 * words: 0 when any word (and every synonym of it) is missing, else the sum per word of its best
 * alternative. 3: the id, the name or an alias starts with it. 2: the id holds it or a word of the
 * name starts with it. 1: only the haystack (description, kind name) holds it. So name and alias
 * hits rank above description hits, and a synonym ranks as the word it stands for.
 */
export function scoreRow(row, words) {
  const [id, name, , , , hay, aliases] = row;
  if (!words.length) return 1;
  // An alias is a name the vendor uses, so it weighs what the name weighs: typing `dcr` should
  // put the data collection rule first, not behind every description that mentions it.
  const alias = (aliases ?? "").split(" ").filter(Boolean);
  const lname = String(name).toLowerCase();
  const spaced = ` ${lname}`;
  let s = 0;
  for (const w of words) {
    let best = 0;
    for (const a of alternatives(w)) {
      if (!hay.includes(a)) continue;
      const t =
        id.startsWith(a) || lname.startsWith(a) || alias.some((x) => x.startsWith(a))
          ? 3
          : id.includes(a) || spaced.includes(` ${a}`)
            ? 2
            : 1;
      if (t > best) best = t;
    }
    if (!best) return 0;
    s += best;
  }
  return s;
}
