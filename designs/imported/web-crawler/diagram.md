# web-crawler

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart LR
  n_seed_urls["seed URLs<br/><i>blob-store</i>"]
  n_url_frontier["URL Frontier<br/><i>message-queue</i>"]
  n_html_downloader["HTML Downloader<br/><i>container-worker</i>"]
  n_dns_resolver["DNS Resolver<br/><i>dns-resolver</i>"]
  n_content_parser["Content Parser<br/><i>container-service</i>"]
  n_content_seen["Content Seen?<br/><i>container-service</i>"]
  n_content_storage["Content Storage<br/><i>blob-store</i>"]
  n_link_extractor["Link Extractor<br/><i>container-service</i>"]
  n_url_filter["URL Filter<br/><i>container-service</i>"]
  n_url_seen["URL Seen?<br/><i>container-service</i>"]
  n_url_storage["URL Storage<br/><i>nosql-store</i>"]
  n_seed_urls -.->|"1 [queue, at-least-once]"| n_url_frontier
  n_url_frontier -.->|"2 [queue, at-least-once]"| n_html_downloader
  n_html_downloader -->|"3 [dns]"| n_dns_resolver
  n_html_downloader -->|"4 [http]"| n_content_parser
  n_content_parser -->|"5 [http]"| n_content_seen
  n_content_seen -->|"6 [https]"| n_content_storage
  n_content_storage -->|"6 [https]"| n_content_seen
  n_content_seen -->|"7 [http]"| n_link_extractor
  n_link_extractor -->|"8 [http]"| n_url_filter
  n_url_filter -->|"9 [http]"| n_url_seen
  n_url_seen -->|"10 [https]"| n_url_storage
  n_url_storage -->|"10 [https]"| n_url_seen
  n_url_seen -.->|"11 [queue, at-least-once]"| n_url_frontier
```
