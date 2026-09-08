# Imported designs

Designs brought into Arkore from an existing picture, model or infrastructure-as-code file by
the `arkore-design-import` skill (`.claude/skills/arkore-design-import/`). Each folder keeps
the original next to its Arkore encoding, so the pair can be returned to later and used as
learning material: how real boxes map to components, which boundaries appear, where the format
fell short.

```
<name>/
  source/          the original file(s), untouched
  <name>.yaml      the Arkore design; id equals the folder name
  mapping.yaml     source inventory and where every box, boundary and arrow went
  diagram.md       Mermaid rendering of the Arkore design, for side-by-side review
  notes.md         decisions, assumptions, components added, gaps, rules fired
```

The contract: `<name>.yaml` is the same design as `source/`, box for box, arrow for arrow,
boundary for boundary; only the type behind each box is new. `check_fidelity.py` enforces the
counts and the labels; `validate.mjs` checks the encoding and reports the rules that fire.

These are not rule fixtures. `designs/` holds the curated reference architectures with their
`.broken.yaml` variants; an imported design is promoted there only by a separate decision.

## Index

| design | source format | nodes | edges | groups | imported | notes |
|---|---|---|---|---|---|---|
