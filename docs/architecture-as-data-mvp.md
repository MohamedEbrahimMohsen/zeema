# Architecture-as-Data — MVP Requirements

> Working name: TBD. Check npm package availability before buying the domain.
> Status: pre-implementation. Every decision below is revisable except the thesis.

---

## 1. Thesis

Architecture diagrams today are dead artifacts — PNGs, PDFs, and drawio files that no
tool can reason about. Existing modelling tools (IcePanel, Structurizr) hold a real
semantic model, but their vocabulary stops at C4 abstractions: System, Container,
Component. To them, "Kafka" is a label on a box.

The missing artifact is **architecture as structured, typed, queryable data** — where a
node genuinely knows that SNS has no replay and Kafka has consumer groups, so that
linters, cost estimators, generators, and agents can all read from one representation.

The MVP exists to test one hypothesis:

> A typed architecture model can catch design problems that a picture cannot.

If a deterministic linter finds real issues in real designs, the thesis holds. If the
rules are all trivial or unenforceable, it doesn't — and that's worth knowing in eight
weeks rather than two years.

---

## 2. Goals and non-goals

### Primary goal
Reputation and community standing — being the person behind a well-argued format.
Revenue is a possible later outcome, not the near-term objective.

### Secondary goal (long-horizon, unproven)
If the format gains traction, an org-level enforcement layer becomes sellable:
multi-repo CI gates, drift detection, private catalogs, SSO/RBAC/audit. Explicitly
out of scope for the MVP.

### Non-goals for v1
- No canvas, no drag-and-drop authoring
- No AI features of any kind
- No backend, no database, no accounts
- No cost estimation
- No Terraform generation
- No GitHub repo import
- No interview/evaluation mode
- No runtime plugin registry for components

Every one of these is downstream of the schema being right.

---

## 3. Scope of the MVP

Five deliverables:

1. **Schema** — component definitions and design definitions
2. **~30 curated components**, authored in-repo
3. **`arch lint design.yaml`** — deterministic linter, no AI
4. **GitHub Action** that comments on PRs when a design violates a rule
5. **5–10 reference architectures** encoded in the format

That's the whole thing. It is finishable solo in evenings.

---

## 4. Technical decisions

### Format
- **YAML for authoring** — comments, readable diffs, no bracket noise
- **JSON Schema for validation** — gives editor autocomplete in VS Code, and validators
  in every language for anyone building tooling against the format
- Quote enum values in all examples (`region: "NO"` parses as boolean `false` otherwise —
  the Norway problem)

### Language and runtime
- **TypeScript on Node**
- Distributed via **npm**, run with **`npx`** — zero-install adoption is the point
- GitHub Action written in TypeScript, same codebase
- Use `tsx` or Bun during prototyping to skip build-step config friction

Rationale: .NET is the stronger language personally, but `dotnet tool install` as an
adoption step costs users in a JS-dominated dev-tool ecosystem. If the TypeScript
toolchain threatens the ship date, write it in .NET and ship — adoption friction only
matters for a tool that exists.

### Architecture of the tool
- **No backend. No frontend.** The MVP is a CLI that reads files off disk and exits
  with a status code.
- Absence of a server is a feature: nothing to operate, no cost, no signup, and it works
  inside a company's private repo without them trusting anyone with their architecture.
- Later, if justified: static viewer (React + Vite on Cloudflare Pages, fetching YAML
  from GitHub raw URLs). A real backend comes last, or never.

### License
**MIT on everything.** The open-core split (permissive CLI, BSL server) only makes sense
if protecting revenue, which is not the current goal. Don't carry that complexity for a
business that isn't being built.

---

## 5. Schema design

Three layers:

| Layer | Purpose | Format |
|---|---|---|
| Component definitions | The vocabulary — what a queue *is* | One YAML file per component |
| Designs | Instances + edges — a specific system | One YAML file per design |
| Rules | The linter's checks | YAML, so contributors add rules without writing code |

### Component definitions
- **One file per component**, in-repo. Contributions arrive as PRs and get reviewed.
- Curation is not optional — it is the product. A runtime registry where anyone can
  register components produces three incompatible Kafkas and a linter that can't reason
  over any of them. That failure mode is draw.io's stencil library with extra steps.
- Build an extension mechanism when someone asks for a missing component — month six,
  not week one.

### Kind vs implementation (the important one)
Split the abstract kind from the concrete product:

- `queue` — abstract: ordering, delivery guarantee, DLQ, replay
- `kafka`, `sqs`, `rabbitmq` — concrete: inherit the kind, add specifics
  (partitions, visibility timeout, consumer groups)

Consequences of getting this right:
- Lint rules are written against the **abstract kind** — one DLQ rule covers every queue,
  instead of one rule per vendor
- The same design file serves vendor-neutral use cases (evaluation) and vendor-specific
  ones (cost, IaC) later

### Versioning
Every component file carries `schemaVersion` from day one. Once anyone writes a tool
against the format, renaming a property is a breaking change. One line now, no migration
later.

### Internationalisation
Keep i18n **out of** component definitions. Component files carry a stable ID and typed
properties; display names and descriptions live in `locales/en.yaml`, `locales/ar.yaml`,
keyed by that ID.

Otherwise: every new language means editing 30 component files, translators must touch
the semantic layer, and diffs become unreadable.

### Edges
Edges carry protocol, sync/async, and delivery guarantee. Nodes carry NFRs where
relevant — RPS, latency target, consistency model.

---

## 6. Component coverage

Roughly 30 components cover the overwhelming majority of real designs. Starting set:

Load balancer · API gateway · App server · Worker · Cron/scheduler · SQL database ·
NoSQL database · Cache · Object store · CDN · Queue · Pub/sub topic · Stream ·
Search index · Blob storage · DNS · WAF · Identity provider · Secrets manager ·
Rate limiter · Service mesh · Data warehouse · ETL job · Notification service ·
Webhook endpoint · Third-party API · Mobile client · Web client · Monitoring ·
Feature flag service

The long tail is not the bottleneck. This is a weekend of authoring, not a platform
problem.

---

## 7. Linter rules

Deterministic only. No model calls. Examples of the shape:

- Async edge into a queue with no DLQ configured
- Single-region datastore behind a multi-region SLA
- Cache with no eviction policy declared
- A pub/sub component used where the design declares a replay requirement
- Synchronous call chain deeper than N hops with a stated latency target
- Datastore with no stated backup or retention policy

These are the proof that structure beats pixels. A multimodal model looking at a
screenshot cannot do this reliably or repeatably.

---

## 8. Build order

1. Write the schema for **six** components — not thirty
2. Encode **two** real architectures using them
3. Fix everything the schema got wrong (it will be wrong in unpredictable ways)
4. Expand to ~30 components
5. Build the linter with 5–10 rules
6. Wrap it in the GitHub Action
7. Encode the remaining reference architectures
8. Ship publicly + publish the argument

**Do not spend three weeks on the perfect ontology before step 2.** The feedback loop
from encoding real designs is worth more than upfront design.

---

## 9. Distribution and presence

- **Buy the domain now** — names get taken, it's cheap. Check npm package name
  availability *first*; the CLI command matters more than the domain.
- **No download landing page.** Nobody downloads a CLI from a website; they run `npx`.
- **Repo README carries the argument** at launch: why diagrams-as-images is the wrong
  artifact, a 10-line YAML example, one command.
- **At ship time:** point the domain at a docs site — VitePress or Docusaurus, free on
  Cloudflare Pages or GitHub Pages. Docs matter far more than marketing copy for a
  dev tool.
- **Later, if traction:** an interactive playground — paste a design, see lint output in
  the browser. Static, no backend. That's the demo that converts.
- Skip hero sections and pricing tiers entirely. For this audience they signal the
  opposite of what's intended.

### Importers (high priority, post-MVP)
A format that must be hand-authored from scratch dies. One that can be converted *into*
spreads. Priority order: Mermaid, draw.io, Structurizr, Terraform state.

---

## 10. Risks, stated honestly

| Risk | Note |
|---|---|
| Nobody authors in a config file | The MVP audience is narrower than a canvas would reach. Watch whether anyone actually writes a design file. If not, the format is too heavy — and that's the signal, before six months on a canvas. |
| Formats don't win on merit | OpenAPI, Mermaid, and HCL each rode a forcing function. The linter + PR comment is the candidate forcing function here. If it isn't compelling, the standard ambition fails. |
| Standards take 3–5 years, if ever | Any revenue sits at the far end of that. Solo and unfunded, that's a long runway. |
| Drift | The dominant failure mode for a project with no deadline and no paying user. Neither revenue nor reputation results from an abandoned repo. |
| Abandoned repo is worse than no repo | 11 stars and no commits in a year reads as someone who starts things. Small and finished beats big and half-built. |

---

## 11. Commitments

- **Ship publicly within 6–8 weeks of evening work.** Not because the date is sacred —
  because drift is the real enemy.
- **Publish the argument alongside the code.** The post explaining why architecture-as-data
  matters travels further than the repo does. The scarce asset is a practicing
  architect's opinion, not the tool.
- **Before building further: talk to five people** who hit this pain recently and find out
  what they did instead.

---

## 12. Open questions

- Available hours per week — this determines whether the 6–8 week scope is real
- Name (npm package + CLI command + domain, in that order of priority)
- Do the lint rules survive contact with architectures actually built in the past?
  This is the one thing personal domain expertise can answer and research can't.
