# Intake: Google Maps (map building pipeline, traffic prediction, routing)

## Source
- Primary: https://blog.google/products-and-platforms/products/maps/google-maps-101-how-we-map-world/ (official, 2019: imagery, authoritative data, contributions, ML extraction)
- Primary: https://blog.google/products-and-platforms/products/maps/google-maps-101-how-imagery-powers-our-map/ (official, 2019: Street View, satellite, photogrammetry)
- Primary: https://blog.google/products/maps/google-maps-101-how-ai-helps-predict-traffic-and-determine-routes/ (official, 2020: live and historical traffic, routing factors)
- Primary: https://deepmind.google/blog/traffic-prediction-with-advanced-graph-neural-networks/ (official DeepMind, 2020: route analyser, supersegments, GNN)
- Not used for architecture claims: interview-style write-ups that assert Bigtable/Spanner/Kafka usage without Google attribution
- Verified by: four official Google/DeepMind posts
- Confidence: high for the data and ML pipeline as described; low for serving infrastructure (tile storage, routing engine, datastores), which Google does not publish. Serving components below are marked inferred.
- Date of source: 2019-2020

## System in three lines
A planet-scale map built from four inputs (Street View and satellite imagery, 1,000+ vetted authoritative sources, community edits, and ML feature extraction) through human-reviewed data operations, then served as tiles and routes to over a billion users. Live traffic comes from aggregated anonymised location data merged with historical patterns; ETAs are predicted by a graph neural network over "supersegments" built by a route analyser from terabytes of travel data. Hard because the ground truth changes constantly, inputs range from lidar to sheep-mounted cameras, and routing must fold real-time predictions into a static road graph at query time.

## Scale (only if stated)
- Users / DAU: over one billion people use Google Maps
- Requests per second: not stated
- Data volume: "more than 170 billion images from 87 countries"; 10M+ miles of Street View; 36M+ square miles of satellite imagery covering ~98% of population; "terabytes" of traffic data into the route analyser
- Message throughput: not stated
- Accuracy: ETAs "consistently accurate for over 97% of trips"; GNN cut remaining inaccuracy by up to 50% in named cities
- Building extraction: "map as many buildings in one year as we mapped in the previous 10"; 7M buildings addressed in 2019 from community Street View

## Requirements stated or clearly implied
- Availability target: not stated (global consumer service)
- Consistency: map edits published only "if we have a high degree of confidence"; authoritative sources vetted; eventual propagation of map updates
- Latency target: route and ETA at interactive latency; not quantified
- Ordering needs: none stated
- Replay or reprocessing: historical traffic windows re-weighted (COVID: prioritise last 2-4 weeks); model retraining
- Retention: imagery retained since 2007
- Compliance / residency: location data aggregated and anonymised
- Freshness: live traffic in near real time; map updates continuous with review

## Boundaries
- Regions / zones: global (Google datacenters, not detailed)
- Trust zones: user devices (location telemetry, edits) -> Google services; third-party authoritative sources; human data-ops review
- Named subsystems: Imagery capture and photogrammetry, Authoritative data ingestion, Community edits and review, ML feature extraction, Map base data, Traffic (aggregation, historical patterns, route analyser, GNN ETA), Routing, Serving (tiles, APIs, app)

## Components
| # | Box name in source | Role (one line) | Real product if named | Candidate kind | Properties stated |
|---|---|---|---|---|---|
| 1 | Maps app and web | Navigation clients; source of aggregated location data and edits | Android, iOS, web | mobile-client, web-client | telemetry: aggregated-anonymised |
| 2 | Google Maps Platform API | External API for tiles, routes, ETAs | Maps Platform | api-gateway | |
| 3 | Street View capture fleet | Cars with nine cameras and lidar; trekkers | in-house hardware | edge capture (not a runtime kind) | |
| 4 | Satellite and aerial imagery feed | Third-party and Google imagery | various providers | third-party-api (data feed) | |
| 5 | Imagery store | 170B+ images | Google storage (inferred) | object-store | |
| 6 | Photogrammetry pipeline | Aligns and stitches imagery; extracts roads, lanes, buildings | in-house | etl-job | |
| 7 | ML extraction | Building outlines, addresses, signs from imagery | in-house models | ml-inference (batch) + etl-job | |
| 8 | Authoritative data ingestion | 1,000+ vetted sources (USGS, INEGI) | in-house | etl-job + third-party-api | sources: 1000 |
| 9 | Community edits and review | Send Feedback, Local Guides; internal review before publish | in-house | workflow-engine (review queue) | humanReview: true |
| 10 | Map base data store | Roads, places, addresses (product not public) | inferred: Bigtable/Spanner class | nosql-database / sql-database (inferred) | |
| 11 | Tile generation and serving | Raster/vector tiles to clients | inferred | worker + cdn (inferred) | |
| 12 | Traffic aggregation | Aggregate anonymised location data into live road conditions | in-house | stream-processor | anonymised: true |
| 13 | Historical traffic patterns | Per-road time-of-day patterns; window re-weighting | in-house | data-warehouse | |
| 14 | Route analyser | Builds supersegments from terabytes of traffic data | in-house (DeepMind collaboration) | etl-job | |
| 15 | GNN ETA model | Message-passing over supersegment graphs; trained with MetaGradients | in-house | ml-inference | accuracy: 97%+ trips |
| 16 | Routing engine | Chooses routes using road quality, size, authoritative limits, incidents, predicted traffic | in-house | app-server | |
| 17 | Incident feeds | User-reported closures, construction, hazards | in-house | queue / stream (inferred) | |

## Edges
| From | To | Protocol | sync / async | Delivery guarantee | Notes |
|---|---|---|---|---|---|
| app | maps platform api / serving | https | sync | | routes, tiles |
| app | traffic aggregation | telemetry | async | at-most-once | aggregated, anonymised |
| traffic aggregation | live traffic state | internal | async | | near real time |
| live traffic + historical | gnn eta model | internal | sync | | prediction per route |
| route analyser (batch) | gnn training | batch | async | | supersegments |
| routing engine | gnn eta | rpc | sync | | rank routes |
| routing engine | map base data | read | sync | | road graph |
| street view fleet | imagery store | upload | async | | |
| imagery store | photogrammetry / ml extraction | batch | async | | |
| ml extraction | map base data (candidate edits) | batch | async | | reviewed |
| authoritative sources | ingestion | pull | async | | vetted |
| users | edits review | https | async | | published on confidence |
| review | map base data | write | sync | | |
| map base data | tile generation | batch | async | | |
| tile generation | cdn / serving | push | async | | inferred |
| incident reports | routing engine | stream | async | | closures, hazards |

## Failure modes, incidents, tradeoffs the source discusses
- Concept drift: COVID changed patterns so the system "automatically prioritizing historical traffic patterns from the last two to four weeks, and deprioritizing patterns from any time before that". Source: Maps 101 traffic.
- Training instability: graph sizes from two to 100+ nodes caused variance; MetaGradients "dynamically adapt the learning rate during training". Source: DeepMind.
- Generalisation: multi-loss objective improved held-out results without changing training metrics. Source: DeepMind.
- Data trust: "Our teams carefully vet every authoritative data source"; community edits published only with "a high degree of confidence". Source: Maps 101 world.
- Coverage vs access: trekkers on boats, camels and sheep to reach unmapped terrain; hardware must survive Death Valley to Himalayas. Source: Maps 101 imagery.
- ML leverage: building detection went from "fuzzy buildings" to polygons, 10x mapping throughput. Source: Maps 101 world.
- Privacy: traffic derived from aggregated anonymised data only. Source: Maps 101 traffic.

## Unknowns
- Serving datastores, tile storage and routing engine internals (not public)
- Real-time traffic pipeline products and latency
- Model serving infrastructure and refresh cadence
- Global distribution and CDN specifics

## Candidates
- New kinds: none strictly new; sightings: ml-inference (7th), etl-job (11th), data-warehouse (12th), workflow-engine (5th: human review queue), third-party-api (5th: data feeds), stream-processor (10th), object-store (17th)
- New properties on existing kinds: ml-inference.training (batch, online), inputs (live, historical); stream-processor.anonymised (boolean); workflow-engine.humanReview (boolean); third-party-api.role (data-feed, execution, notification)
- New edge properties: aggregatedAnonymised (boolean); reviewedBeforePublish (boolean)
- New requirement paths: privacy.telemetryAggregated (boolean); data.freshnessWindowDays (integer); data.sourceVetting (boolean)
- New rules:
  - raw-location-telemetry-without-aggregation: client telemetry edge with aggregatedAnonymised false while privacy.telemetryAggregated true
  - crowd-edits-published-without-review: user-contributed data edge into system of record with reviewedBeforePublish false while data.sourceVetting true
  - model-on-stale-history-under-drift: ml-inference inputs historical with no re-weighting window while data.freshnessWindowDays set
  - unverified-third-party-feed-into-record: third-party-api data-feed edge to system of record with no vetting or etl stage (informational)

## Verification 2026-09-14

All four primary sources were fetched on 2026-09-14; all four were reachable.

| URL | Reachable | Outcome |
|---|---|---|
| blog.google .../google-maps-101-how-we-map-world/ | yes | Confirms 170 billion images from 87 countries, more than 1,000 third-party sources, Send Feedback, vetting of every authoritative source, edits published only with "a high degree of confidence", and "map as many buildings in one year as we mapped in the previous 10". |
| blog.google .../google-maps-101-how-imagery-powers-our-map/ | yes | Confirms nine cameras plus lidar on Street View cars, trekkers carried by boats and animals, 10 million miles of Street View, more than 36 million square miles of satellite imagery, more than 98 percent of the population, photogrammetry alignment and stitching, and roughly 7 million buildings given addresses in 2019. |
| blog.google .../google-maps-101-how-ai-helps-predict-traffic-and-determine-routes/ | yes | Confirms aggregate location data as the traffic input, live plus historical combination, "consistently accurate for over 97 percent of trips", the COVID re-weighting to "the last two to four weeks", and the routing factors: road quality, size, speed limits, tolls, restrictions, incident reports. |
| deepmind.google/blog/traffic-prediction-with-advanced-graph-neural-networks/ | yes | Confirms the route analyser, Supersegments, "terabytes of traffic information", GNN message passing, MetaGradients for learning-rate adaptation over graphs of 2 to 100+ nodes, the multi-loss objective, up to 50 percent improvement in the named cities, and over one billion users. |

Not confirmed, therefore not encoded as fact:

- Imagery "retained since 2007": the imagery post dates Street View to "over 12 years" before 2019 but states no retention policy. Assumed; no retention property is set from it.
- All serving infrastructure (tile storage, map base datastore product, routing engine internals, CDN, incident transport). Google publishes none of it, so every one of those boxes uses a vendor-neutral generic component.
- No requests-per-second, throughput or latency figure appears in any source, so no node carries nfr.rps and the design states no latency.p95Ms.
