# Designs

One folder per design; the folder name is the design id. Two tiers.

```
designs/
  reference/<id>/     curated by Arkore, rule fixtures
    design.yaml         must trip no rule
    design.broken.yaml  must trip exactly the rules named in its header
    source/             the intake card, or a note on the origin
    diagram.md          Mermaid rendering of design.yaml
    diagram.svg         drawn rendering with the component icons (design.broken.yaml gets diagram.broken.svg)
    notes.md            what the design shows, what the broken variant breaks
  imported/<id>/      brought in from a real source by the arkore-design-import skill
    design.yaml         the same design as the source, expressed in Arkore components
    source/             the original file(s), untouched
    mapping.yaml        every source box, boundary and arrow and where it went; machine checked
    diagram.md          Mermaid rendering of design.yaml, for side-by-side review
    diagram.svg         drawn rendering with the component icons, for comparing against the source
    notes.md            decisions, assumptions, gaps, rules fired
```

`mapping.yaml` is the audit trail between the source and the model: one row per source item,
its node/group/edge, the component chosen and the confidence (exact, close, assumed). The
fidelity checker (`.claude/tools/check_fidelity.py`) fails when counts differ, a label drifts or
an item is left unmapped. Accumulated across designs, the rows are learning data: which drawn
box maps to which component.

`notes.md` is the human record: why choices were made, what was assumed, what the format could
not express, observations that were deliberately not encoded, and the rules that fired.

Both renderings are generated, never hand-drawn: `design_to_mermaid.py` writes `diagram.md` and
`design_to_svg.py` writes `diagram.svg`, which places the real component icons and computes a
layout, because the format stores none. Regenerate them after editing a design.

An imported design becomes a reference design only by a separate decision that adds
`design.broken.yaml`. The validator (`node .claude/tools/validate.mjs`) checks both tiers.

## Reference

| design | nodes | edges | groups | source |
|---|---|---|---|---|
| [doordash-delivery](reference/doordash-delivery/) | 15 | 19 | 3 | intake card |
| [multi-region-web](reference/multi-region-web/) | 8 | 8 | 2 | composed for v1 |
| [object-storage](reference/object-storage/) | 13 | 16 | 4 | intake card |
| [order-processing](reference/order-processing/) | 9 | 10 | 2 | composed for v1 |
| [payment-system](reference/payment-system/) | 15 | 18 | 3 | intake card |
| [slack-messaging](reference/slack-messaging/) | 16 | 21 | 5 | intake card |
| [twitter-timeline](reference/twitter-timeline/) | 15 | 18 | 3 | intake card |

## Imported

Eleven come from one system design textbook, one chapter each; the twelfth is a diagram the
user supplied. The book itself is not in the repository: each `source/` holds a citation and a
factual transcription of the boxes, boundaries and arrows.

| design | system | source | nodes | edges | groups | unresolved |
|---|---|---|---|---|---|---|
| [chat-system](imported/chat-system/) | Chat system | book ch 12, fig 12-8 | 9 | 13 | 2 | none |
| [google-drive](imported/google-drive/) | Google Drive | book ch 15, fig 15-10 | 10 | 11 | 0 | none |
| [key-value-store](imported/key-value-store/) | Key-value store | book ch 6, fig 6-17 | 9 | 8 | 1 | none |
| [news-feed](imported/news-feed/) | News feed | book ch 11, fig 11-4, 11-7 | 20 | 26 | 2 | none |
| [notification-system](imported/notification-system/) | Notification system | book ch 10, fig 10-10, 10-14 | 27 | 27 | 2 | none |
| [notification-system-design](imported/notification-system-design/) | Notification system (user's diagram) | image, transcribed | 13 | 13 | 1 | none |
| [rate-limiter](imported/rate-limiter/) | Rate limiter | book ch 4, fig 4-13 | 8 | 9 | 0 | none |
| [scale-to-millions](imported/scale-to-millions/) | Scale from zero to millions of users | book ch 1, fig 1-23 | 15 | 11 | 3 | none |
| [search-autocomplete](imported/search-autocomplete/) | Search autocomplete | book ch 13, fig 13-9, 13-11 | 10 | 10 | 1 | none |
| [url-shortener](imported/url-shortener/) | URL shortener | book ch 8, fig 8-7, 8-8 | 5 | 5 | 0 | none |
| [web-crawler](imported/web-crawler/) | Web crawler | book ch 9, fig 9-2, 9-4 | 11 | 13 | 0 | 1 assumed |
| [youtube](imported/youtube/) | YouTube | book ch 14, fig 14-3, 14-4, 14-5, 14-6, 14-7, 14-10 | 17 | 21 | 0 | 1 assumed |
