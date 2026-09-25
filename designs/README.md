# Designs

One folder per design; the folder name is the design id. Three tiers.

```
designs/
  reference/<id>/     curated by Zeema, rule fixtures
    design.yaml         must trip no rule
    design.broken.yaml  must trip exactly the rules named in its header
    source/             the intake card, or a note on the origin
    diagram.md          Mermaid rendering of design.yaml
    diagram.svg         drawn rendering with the component icons (design.broken.yaml gets diagram.broken.svg)
    notes.md            what the design shows, what the broken variant breaks
  authored/<id>/      made in the Zeema canvas
    design.yaml         the design; no external source, so no mapping.yaml, and no broken twin
    design.layout.json  node positions, edge bows and ports, written by the editor
  imported/<id>/      brought in from a real source by the zeema-design-import skill
    design.yaml         the same design as the source, expressed in Zeema components
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

An authored or imported design becomes a reference design only by a separate decision that adds
`design.broken.yaml`. The validator (`node .claude/tools/validate.mjs`) checks both tiers.

## Reference

| design | nodes | edges | groups | source |
|---|---|---|---|---|
| [ad-click-aggregation](reference/ad-click-aggregation/) | 20 | 24 | 5 | intake card |
| [airbnb-search](reference/airbnb-search/) | 24 | 31 | 5 | intake card |
| [amazon-order](reference/amazon-order/) | 22 | 26 | 5 | intake card |
| [booking-search](reference/booking-search/) | 25 | 36 | 6 | intake card |
| [canva-uploads](reference/canva-uploads/) | 23 | 31 | 4 | intake card |
| [cloudflare-edge](reference/cloudflare-edge/) | 20 | 26 | 5 | intake card |
| [coinbase-exchange](reference/coinbase-exchange/) | 25 | 32 | 7 | intake card |
| [datadog-husky](reference/datadog-husky/) | 23 | 29 | 6 | intake card |
| [digital-wallet](reference/digital-wallet/) | 21 | 25 | 5 | intake card |
| [discord-messages](reference/discord-messages/) | 14 | 19 | 5 | intake card |
| [distributed-email](reference/distributed-email/) | 22 | 29 | 5 | intake card |
| [distributed-message-queue](reference/distributed-message-queue/) | 15 | 20 | 5 | intake card |
| [doordash-delivery](reference/doordash-delivery/) | 15 | 19 | 3 | intake card |
| [dropbox-sync](reference/dropbox-sync/) | 25 | 34 | 5 | intake card |
| [duolingo-backend](reference/duolingo-backend/) | 23 | 24 | 4 | intake card |
| [etsy-search](reference/etsy-search/) | 24 | 26 | 5 | intake card |
| [facebook-messenger](reference/facebook-messenger/) | 23 | 34 | 5 | intake card |
| [facebook-tao](reference/facebook-tao/) | 23 | 34 | 5 | intake card |
| [figma-multiplayer](reference/figma-multiplayer/) | 16 | 21 | 6 | intake card |
| [github-mysql](reference/github-mysql/) | 24 | 28 | 6 | intake card |
| [gitlab-architecture](reference/gitlab-architecture/) | 25 | 44 | 8 | intake card |
| [gojek-platform](reference/gojek-platform/) | 24 | 30 | 3 | intake card |
| [google-maps](reference/google-maps/) | 22 | 28 | 5 | intake card |
| [grab-geo](reference/grab-geo/) | 19 | 22 | 5 | intake card |
| [hotel-reservation](reference/hotel-reservation/) | 23 | 31 | 4 | intake card |
| [hotstar-streaming](reference/hotstar-streaming/) | 24 | 33 | 5 | intake card |
| [instagram-feed](reference/instagram-feed/) | 23 | 27 | 5 | intake card |
| [khan-academy-goliath](reference/khan-academy-goliath/) | 22 | 29 | 5 | intake card |
| [linear-sync](reference/linear-sync/) | 20 | 32 | 5 | intake card |
| [linkedin-kafka](reference/linkedin-kafka/) | 22 | 27 | 6 | intake card |
| [lyft-envoy](reference/lyft-envoy/) | 23 | 37 | 6 | intake card |
| [meta-threads](reference/meta-threads/) | 24 | 35 | 5 | intake card |
| [metrics-monitoring](reference/metrics-monitoring/) | 22 | 21 | 4 | intake card |
| [monzo-platform](reference/monzo-platform/) | 25 | 29 | 5 | intake card |
| [multi-region-web](reference/multi-region-web/) | 8 | 8 | 2 | composed for v1 |
| [nearby-friends](reference/nearby-friends/) | 14 | 19 | 4 | intake card |
| [netflix-streaming](reference/netflix-streaming/) | 17 | 24 | 5 | intake card |
| [notion-sharding](reference/notion-sharding/) | 16 | 21 | 5 | intake card |
| [nubank-core](reference/nubank-core/) | 24 | 36 | 5 | intake card |
| [object-storage](reference/object-storage/) | 13 | 16 | 4 | intake card |
| [order-processing](reference/order-processing/) | 9 | 10 | 2 | composed for v1 |
| [payment-system](reference/payment-system/) | 15 | 18 | 3 | intake card |
| [paypal-payments](reference/paypal-payments/) | 24 | 30 | 9 | intake card |
| [pinterest-feed](reference/pinterest-feed/) | 25 | 32 | 5 | intake card |
| [pokemon-go](reference/pokemon-go/) | 18 | 20 | 4 | intake card |
| [proximity-service](reference/proximity-service/) | 16 | 22 | 5 | intake card |
| [reddit-feed](reference/reddit-feed/) | 25 | 37 | 4 | intake card |
| [robinhood-trading](reference/robinhood-trading/) | 22 | 33 | 5 | intake card |
| [shopify-flash-sale](reference/shopify-flash-sale/) | 19 | 26 | 6 | intake card |
| [slack-messaging](reference/slack-messaging/) | 16 | 21 | 5 | intake card |
| [snapchat-platform](reference/snapchat-platform/) | 23 | 28 | 6 | intake card |
| [spotify-playback](reference/spotify-playback/) | 19 | 28 | 4 | intake card |
| [stack-overflow](reference/stack-overflow/) | 25 | 35 | 4 | intake card |
| [stock-exchange](reference/stock-exchange/) | 20 | 27 | 6 | intake card |
| [stripe-payments](reference/stripe-payments/) | 24 | 27 | 6 | intake card |
| [tiktok-recommendation](reference/tiktok-recommendation/) | 16 | 18 | 6 | intake card |
| [tinder-geo](reference/tinder-geo/) | 14 | 18 | 4 | intake card |
| [twitch-live](reference/twitch-live/) | 25 | 29 | 5 | intake card |
| [twitter-timeline](reference/twitter-timeline/) | 15 | 18 | 3 | intake card |
| [uber-dispatch](reference/uber-dispatch/) | 21 | 30 | 6 | intake card |
| [unique-id-generator](reference/unique-id-generator/) | 6 | 6 | 3 | intake card |
| [whatsapp-messaging](reference/whatsapp-messaging/) | 19 | 26 | 6 | intake card |
| [wikipedia](reference/wikipedia/) | 24 | 29 | 5 | intake card |
| [x-recommendation](reference/x-recommendation/) | 25 | 31 | 3 | intake card |
| [youtube-upload-playback](reference/youtube-upload-playback/) | 19 | 24 | 5 | intake card |
| [zerodha-kite](reference/zerodha-kite/) | 25 | 35 | 5 | intake card |
| [zoom-video](reference/zoom-video/) | 18 | 28 | 8 | intake card |

## Imported

Eleven come from one system design textbook, one chapter each; the other two are diagrams the
user supplied. The book itself is not in the repository: each chapter's `source/` holds a
citation and a factual transcription of the boxes, boundaries and arrows.

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
| [talmaza](imported/talmaza/) | Talmaza on Cloudflare and Azure AKS (user's diagram) | draw.io | 37 | 17 | 8 | none |
| [url-shortener](imported/url-shortener/) | URL shortener | book ch 8, fig 8-7, 8-8 | 5 | 5 | 0 | none |
| [web-crawler](imported/web-crawler/) | Web crawler | book ch 9, fig 9-2, 9-4 | 11 | 13 | 0 | 1 assumed |
| [youtube](imported/youtube/) | YouTube | book ch 14, fig 14-3, 14-4, 14-5, 14-6, 14-7, 14-10 | 17 | 21 | 0 | 1 assumed |
