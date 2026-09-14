# google-maps: notes

- Tier: reference design curated by Arkore; `design.yaml` must trip no rule, `design.broken.yaml` must trip exactly the rules named in its header.
- Source: `source/google-maps.md` (four official Google and DeepMind posts, 2019-2020, all re-fetched and reachable on 2026-09-14).
- Size: 22 nodes, 28 edges, 5 groups.

## Clean variant (header of design.yaml)

Reference architecture 29, clean variant: the Google Maps map-building pipeline and the traffic
stack that feeds it — imagery, vetted authoritative sources, community edits and ML feature
extraction flowing into the map base data, and aggregated anonymised location data flowing
through a windowed aggregator, a route analyser that builds Supersegments and the GNN ETA model
that the routing engine ranks routes with.

Fixes relative to google-maps.broken.yaml:
  - traffic-aggregator windows by event time with a declared watermark and sidelines late pings,
    so a location report that arrives minutes after the drive still lands in the right window
  - tile-cache is rebuilt by tile-builder from map-base-data, so rendered tiles are derived data
    and not the only copy; the cache is not used as a primary store
  - edit-queue and incident-queue both declare a dead-letter queue, so a poison edit or a
    malformed incident report is parked for the data-ops team instead of retried forever
  - routing-engine breaks its circuit on eta-model and degrades instead of retrying blindly
This file MUST trip no rule.

## Broken variant (header of design.broken.yaml)

Reference architecture 29, broken variant: the same Google Maps pipeline with the traffic
aggregator windowing by event time and dropping every late location ping, rendered tiles that
exist only inside the tile cache, a map-edit queue with nowhere to park a poison edit, and a
routing engine that retries the ETA model at full tilt.

This file MUST trip:
  - windowed-aggregation-without-watermark   (traffic-aggregator: event-time windows, no watermarkSeconds)
  - cache-as-primary-store-without-persistence (tile-cache: usedAsPrimaryStore true, persistence false)
  - materialised-cache-without-rebuild-path  (tile-cache is materialised; only a cdn and an app-server feed it)
  - queue-missing-dlq                        (edit-queue takes async edits with deadLetterQueue false)
  - retry-without-adaptive-shedding          (routing-engine -> eta-model retries with no circuit breaker)
and MUST NOT trip:
  - cache-missing-eviction-policy            (tile-cache still declares lru)
  - read-heavy-path-without-cache            (a cache exists, and no readWriteRatio is stated)
  - derived-store-without-cdc-or-rebuild, business-updates-without-index-propagation (no search index)
  - datastore-missing-backup, datastore-single-region, read-replica-as-sole-scaling,
    single-writer-primary-at-peak-qps        (no sql-database node, and no rps is stated anywhere)
  - sync-chain-too-deep                      (no latency.p95Ms requirement, and the deepest sync chain is 3)
  - pubsub-replay-required                   (replay is required but there is no pubsub-topic)
  - credentials-without-rotation             (the design still states credentialRotationDays)
  - stateful-node-without-zone-redundancy, stateful-engine-pinned-to-single-zone (no availability-zone group)
  - multi-leader-store-without-conflict-policy (every store is multi-region-single-leader)
  - external-call-inline-without-durable-path (no app-server calls a third-party-api synchronously)

The broken twin swaps `tile-builder` (a worker) for `tile-renderer` (an app-server that renders a
tile once and keeps it only in the cache), so the node count is unchanged at 22.

## Mapping

| Source box | Node | Component | Kind | Confidence |
|---|---|---|---|---|
| Maps app and web | `maps-client` | `mobile-app` | client | exact |
| Street View capture fleet (cars with nine cameras and lidar, trekkers) | `street-view-fleet` | `iot-device` | client | close |
| Satellite and aerial imagery feed | `satellite-imagery-providers` | `supplier-api` | third-party-api | close |
| Authoritative data ingestion, 1,000+ vetted sources | `authoritative-sources` | `supplier-api` | third-party-api | exact |
| Authoritative data ingestion (the pipeline half of the same row) | `authoritative-ingest` | `container-worker` | worker | close |
| Google Maps Platform API | `maps-platform-api` | `envoy-gateway` | api-gateway | assumed |
| Tile generation and serving (serving half) | `tile-cdn` | `content-delivery-network` | cdn | assumed |
| Tile generation and serving (cache in front of the origin) | `tile-cache` | `cache-cluster` | cache | assumed |
| Tile generation and serving (generation half) | `tile-builder` | `container-worker` | worker | assumed |
| Routing engine | `routing-engine` | `container-service` | app-server | close |
| Imagery store, 170B+ images | `imagery-store` | `blob-store` | object-store | assumed |
| Photogrammetry pipeline | `photogrammetry` | `container-worker` | worker | close |
| ML extraction | `ml-extraction` | `container-worker` | worker | close |
| Community edits and review (queue half) | `edit-queue` | `message-queue` | queue | assumed |
| Community edits and review (human review half) | `edit-review` | `container-worker` | worker | close |
| Map base data store | `map-base-data` | `nosql-store` | nosql-database | assumed |
| Traffic aggregation | `traffic-aggregator` | `beam` | stream-processor | assumed |
| Live traffic state | `live-traffic-state` | `nosql-store` | nosql-database | assumed |
| Historical traffic patterns | `historical-traffic` | `nosql-store` | nosql-database | assumed |
| Route analyser | `route-analyser` | `container-worker` | worker | close |
| GNN ETA model | `eta-model` | `tensorflow-serving` | ml-inference | assumed |
| Incident feeds | `incident-queue` | `message-queue` | queue | assumed |

Confidence tally: 3 exact, 8 close, 11 assumed. Every `assumed` row is a box whose product Google
does not publish; the card already flags all of them as inferred. No `assumed` row claims a vendor
product beyond the vendor-neutral stand-in named in `work/designs/google-maps/gaps.md`.

The card's box 3 (Street View capture fleet) is marked in the card as "edge capture (not a runtime
kind)". It is encoded as a `client` node because the format has no capture-device kind and the
fleet is genuinely the origin of an edge into the imagery store.

## Catalogue gaps

| product | kind it would need | used instead |
|---|---|---|
| vendor-neutral API gateway (Google Maps Platform API) | api-gateway, provider default | `envoy-gateway`, the stand-in the other reference designs use for an unnamed gateway |
| vendor-neutral stream processor (traffic aggregation) | stream-processor, provider default | `beam` |
| vendor-neutral model server (GNN ETA model) | ml-inference, provider default | `tensorflow-serving`, as in `tiktok-recommendation` |
| vendor-neutral analytical store (historical traffic patterns) | data-warehouse, provider default | `nosql-store` |

No component was added and no kind installed.

## Values set to satisfy a rule rather than taken from the source

- `requirements.security.credentialRotationDays: 90` — Google states no rotation period. Ninety days
  is the value the other reference designs use, and without it `credentials-without-rotation` fires
  on any design that holds data.
- `traffic-aggregator.watermarkSeconds: 60` and `lateDataPolicy: "sideline"` — Google states no
  watermark figure. The mechanism (late location reports must still land in their window) is what
  the rule asks for; the number is a design decision, not a published one.
- `tile-cache` eviction, replication and `persistence: false` — no product is named, so the cache is
  described as a derived cache rebuilt by `tile-builder`, which is what "tile generation and
  serving" implies.
- Backup and encryption flags on the stores are ordinary practice, not source statements.

## Not encoded

- Every stated scale number (170 billion images, 87 countries, 10 million miles of Street View,
  36 million square miles of satellite imagery, 98% of the population, 1,000+ sources, over one
  billion users, terabytes of traffic data). The format carries `nfr.rps` and a few requirement
  integers; it has no place for corpus sizes or coverage percentages.
- ETA accuracy ("over 97% of trips", up to 50% improvement in Berlin, Jakarta, São Paulo, Sydney,
  Tokyo, Washington D.C., 51% in Taichung, 16% in London and Copenhagen). There is no accuracy
  requirement path.
- The COVID window re-weighting ("prioritise the last two to four weeks") lives only in the label
  on the `eta-model` -> `historical-traffic` edge. There is no freshness-window requirement path
  that expresses "weight recent history more heavily".
- MetaGradients (learning-rate adaptation over graphs of 2 to 100+ nodes) and the multi-loss
  objective. Training-time techniques are below the level the format models.
- The human review step is a property of `edit-review`, not a modelled actor: the format has no way
  to say "a person approves this before it is published".
- Privacy: the location telemetry edge is labelled "aggregated anonymised location data", but there
  is no requirement path or edge field for aggregation or anonymisation.
- Physical capture detail (nine athermal cameras, lidar, trekkers on boats, camels and sheep) beyond
  the label on `street-view-fleet` and on its edge.
