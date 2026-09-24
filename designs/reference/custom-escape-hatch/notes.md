# custom-escape-hatch

A minimal system: a web client calls one API service over HTTPS inside a platform boundary. Its
broken twin adds a legacy billing mainframe that the catalogue has no component for, drawn as a
custom node.

Why this design exists: it is the evidence for the `custom` kind and the two rules that watch
it. The clean twin places only catalogue components. The broken twin replaces one dependency
with a `custom` node, and the linter answers the way it must — a warning on the node and a
warning on the design, neither of which blocks a save.

A custom node is deliberately poor. It has an id, a label, a group and edges, so the diagram
stays complete data and a reader still sees the dependency. It has no properties, so no rule
reads anything from it: everything a rule would want to know about a 1987 billing mainframe is
in the label, and the linter does not read labels.

The label is the intake evidence. When the same word keeps turning up in custom nodes across
public designs, that is the case for a new kind or a new component; see `docs/governance.md`.
