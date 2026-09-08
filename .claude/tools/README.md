# Arkore tooling for the `.claude` skills

Helper scripts used by `.claude/skills/arkore-design-import` and
`.claude/skills/arkore-catalogue-add`. They are maintenance tooling for the catalogue, not part
of the Arkore format and not the future linter. v1 of the repository ships no product code;
these scripts only read and write the YAML, Markdown and SVG that make up the specification.

Setup once (Node 20+ and Python 3 with PyYAML):

```bash
cd .claude/tools && npm install
```

Run everything from the repository root.

| Command | Purpose |
|---|---|
| `node .claude/tools/validate.mjs` | Whole repository: schemas, kinds, components, locale both ways, icons, rules, reference designs (must trip exactly their header rules), imported designs under `designs/imported/`. Ends with `all checks passed` or lists problems and exits 1. |
| `node .claude/tools/validate.mjs --design <file>` | One design: schema, references, then the rules that fire with their messages. Exits 1 only on structural problems. |
| `python .claude/tools/catalogue.py find <words>` | Components and inventory rows matching the words (name, id, description). Inventory hits show `skip:` reasons. |
| `python .claude/tools/catalogue.py component <id>` | Print a component and its effective property set. |
| `python .claude/tools/catalogue.py kind <id>` / `kinds` / `providers <kind>` | Kind properties and components per provider; all kinds; provider coverage of one kind. |
| `python .claude/tools/catalogue.py inventory <words>` | Inventory rows only. |
| `python .claude/tools/install_kinds.py <proposal.yaml>` | Install kind proposals: `kinds/<id>.yaml`, locale entry, glyph in `kindglyphs-extra.mjs`, row in `docs/catalogue-v1.md`. Existing ids are skipped. |
| `python .claude/tools/arkore_locale.py add <snippet.yaml>` / `check` / `prune` | Merge locale entries into `locales/en.yaml` (kept sorted); report or drop entries without files. |
| `node .claude/tools/icons.mjs [--force]` | Write missing kind icons and component icons (badge from `badges-extra.json`, then `providers.mjs`, then the provider folder). |
| `python .claude/tools/design_to_mermaid.py <design.yaml> [-o diagram.md]` | Render a design as a Mermaid flowchart (groups as subgraphs, sync solid, async dotted). |
| `node .claude/tools/check_icon_paths.mjs` | Walk every `d` attribute in `icons/` command by command and fail on a path a browser would refuse to draw. |
| `node .claude/tools/editor_test.mjs` | The canvas acceptance gate: parser, round trip, rules, structure, layout, bundle, icon paths, the full repository gate and the performance budgets. |
| `node .claude/tools/build_editor_data.mjs` | Regenerate `editor/data/` from the catalogue. |
| `python .claude/tools/design_to_svg.py <design.yaml> [-o out.svg]` | Render a design as a standalone SVG: boxes carrying the real component icon, coloured by the kind's category, dashed group frames, solid arrows for sync and dashed for async. Layout is computed (layered ranks, barycentre ordering, group members on one rank); the format stores none. |
| `python .claude/tools/check_fidelity.py designs/imported/<name>` | Prove an imported design matches its `mapping.yaml`: counts, every item mapped both ways, labels verbatim, no unmapped items. |

Data files:

- `kindglyphs.mjs`, `kindglyphs-extra.mjs`: the 24x24 stroke glyph of every kind (the icon generator's source of truth; `install_kinds.py` appends here).
- `providers.mjs`: provider key to Simple Icons slug, the original neutral marks for AWS and Azure, and component id to badge overrides for the first catalogue.
- `badges-extra.json`: component id to Simple Icons slug for `default` products with a brand mark.
- `iac-map.yaml`: Terraform (azurerm, aws, google, oci, cloudflare), ARM/Bicep and CloudFormation resource types to component ids. `null` means the type is not a node; `"todo"` means it is a node with no component yet.

`node_modules/` is git-ignored; nothing here is published.
