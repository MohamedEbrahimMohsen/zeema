// The palette. One search box over a prebuilt index of 1,623 components, grouped by category.
// Tokens provider: and kind: filter, which is why there are no provider tabs. Dragging a row
// creates a node where it lands.

const LIMIT = 60;

export class Palette {
  constructor(root, { search, catalogue, icons, onCreate }) {
    this.root = root;
    this.results = root.querySelector("#palette-results");
    this.input = root.querySelector("#palette-search");
    this.rows = search;                       // [id, name, kind, category, provider, haystack]
    this.catalogue = catalogue;
    this.icons = icons || {};
    this.onCreate = onCreate;
    this.input.addEventListener("input", () => this.run());
    this.run();
  }

  setIcons(icons) { this.icons = icons; this.run(); }

  parseQuery(q) {
    const filters = {};
    const words = [];
    for (const token of q.toLowerCase().split(/\s+/).filter(Boolean)) {
      const m = /^(provider|kind|category):(.+)$/.exec(token);
      if (m) filters[m[1]] = m[2]; else words.push(token);
    }
    return { filters, words };
  }

  score(row, words) {
    const [id, name, , , , hay] = row;
    if (!words.length) return 1;
    let s = 0;
    for (const w of words) {
      if (!hay.includes(w)) return 0;
      if (id.startsWith(w) || name.toLowerCase().startsWith(w)) s += 3;
      else if (id.includes(w)) s += 2;
      else s += 1;
    }
    return s;
  }

  run() {
    const { filters, words } = this.parseQuery(this.input.value);
    const hits = [];
    for (const row of this.rows) {
      if (filters.provider && row[4] !== filters.provider) continue;
      if (filters.kind && row[2] !== filters.kind) continue;
      if (filters.category && row[3] !== filters.category) continue;
      const s = this.score(row, words);
      if (s) hits.push([s, row]);
    }
    // group by category so the headers mean something, strongest match first inside each
    hits.sort((a, b) => a[1][3].localeCompare(b[1][3]) || b[0] - a[0] || a[1][1].localeCompare(b[1][1]));
    this.draw(hits.slice(0, LIMIT).map((h) => h[1]), hits.length);
  }

  draw(rows, total) {
    const frag = document.createDocumentFragment();
    let category = null;
    for (const row of rows) {
      const [id, name, kind, cat] = row;
      if (cat !== category) {
        category = cat;
        const h = document.createElement("div");
        h.className = "pal-group";
        h.textContent = cat;
        frag.append(h);
      }
      const el = document.createElement("div");
      el.className = "pal-row";
      el.draggable = true;
      el.title = `${id} · ${kind}`;
      const icon = this.icons[id];
      el.innerHTML =
        (icon ? `<svg viewBox="0 0 24 24">${icon}</svg>` : `<svg viewBox="0 0 24 24"></svg>`) +
        `<span class="name"></span><span class="kind"></span>`;
      el.querySelector(".name").textContent = name;
      el.querySelector(".kind").textContent = kind;
      el.addEventListener("dragstart", (ev) => ev.dataTransfer.setData("text/arkore-component", id));
      el.addEventListener("dblclick", () => this.onCreate(id, null));
      frag.append(el);
    }
    this.results.textContent = "";
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.style.padding = "12px 4px";
      empty.textContent = "Nothing matches. Try a product name, or kind:queue.";
      this.results.append(empty);
      return;
    }
    this.results.append(frag);
    if (total > rows.length) {
      const more = document.createElement("div");
      more.className = "muted";
      more.style.padding = "8px 4px";
      more.textContent = `${total - rows.length} more, keep typing`;
      this.results.append(more);
    }
  }
}
