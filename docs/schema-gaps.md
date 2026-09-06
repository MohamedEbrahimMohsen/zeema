# Schema gaps

A running log of things the v1 format could not express while encoding real designs.
Each entry drives the v2 agenda. Nothing is added to the format without an entry here
first.

Format for an entry:

```
## <short title>
- Design: designs/<id>.yaml
- Missing: what could not be said
- Workaround: what the design does instead
- Proposed change: kind / property / predicate / requirement path, and why
- Status: open | accepted | rejected
```

---

## Only six kinds exist
- Design: designs/multi-region-web.yaml, designs/order-processing.yaml
- Missing: load balancer, CDN, web client, mobile client, worker, NoSQL database,
  object store. Both reference designs stop at the API gateway and treat workers as
  `app-server`.
- Workaround: omit clients and CDN; model workers as `container-service`.
- Proposed change: the remaining kinds from the MVP document, in the order real designs
  need them.
- Status: open, expected

## Protocol is a free string
- Design: all
- Missing: a fixed vocabulary for `edge.protocol`, so a rule could say "sync edge over a
  message protocol is suspicious".
- Workaround: none needed yet; no rule reads protocol.
- Proposed change: promote to enum once the user's designs show the real set.
- Status: open
