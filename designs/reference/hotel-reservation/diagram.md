# hotel-reservation

Rendered from `design.yaml` by design_to_mermaid.py. Groups are subgraphs, solid edges are sync, dotted edges are async.

```mermaid
flowchart TD
  n_web_client["web-client<br/><i>web-browser</i>"]
  n_mobile_client["mobile-client<br/><i>mobile-app</i>"]
  subgraph n_g_primary_dc["primary-dc (region)"]
    subgraph n_g_edge["edge (trust-zone)"]
      n_static_cdn["static-cdn<br/><i>content-delivery-network</i>"]
      n_api_gateway["api-gateway<br/><i>envoy-gateway</i>"]
    end
    subgraph n_g_core["core (trust-zone)"]
      n_hotel_service["hotel-service<br/><i>container-service</i>"]
      n_rate_service["rate-service<br/><i>container-service</i>"]
      n_price_search_service["price-search-service<br/><i>container-service</i>"]
      n_reservation_service["reservation-service<br/><i>container-service</i>"]
      n_fraud_service["fraud-service<br/><i>container-service</i>"]
      n_payment_service["payment-service<br/><i>container-service</i>"]
      n_hotel_management_service["hotel-management-service<br/><i>container-service</i>"]
      n_booking_orchestrator["Booking engine (agent graph)<br/><i>temporal</i>"]
      n_smart_ttl["SmartTTL<br/><i>tensorflow-serving</i>"]
      n_smart_scheduler["SmartScheduler<br/><i>cron-job</i>"]
      n_cache_updater["cache-updater<br/><i>container-worker</i>"]
      n_supplier_quota_limiter["supplier-quota-limiter<br/><i>in-process-limiter</i>"]
      n_inventory_cdc["inventory-cdc<br/><i>debezium</i>"]
      n_inventory_cache["inventory-cache<br/><i>redis</i>"]
      n_price_cache["Price DB<br/><i>cache-cluster</i>"]
      n_reservation_db["Reservation + room_type_inventory<br/><i>relational-database</i>"]
      n_hotel_rate_db["Hotel + room_type_rate<br/><i>relational-database</i>"]
    end
  end
  subgraph n_g_partners["partners (trust-zone)"]
    n_supplier_api["supplier-api<br/><i>supplier-api</i>"]
    n_psp["psp<br/><i>payment-service-provider</i>"]
  end
  n_web_client -->|"static assets [https]"| n_static_cdn
  n_mobile_client -->|"static assets [https]"| n_static_cdn
  n_web_client -->|"https"| n_api_gateway
  n_mobile_client -->|"https"| n_api_gateway
  n_api_gateway -->|"hotel and room type detail [grpc]"| n_hotel_service
  n_api_gateway -->|"room type rates [grpc]"| n_rate_service
  n_api_gateway -->|"search supplier prices [grpc]"| n_price_search_service
  n_api_gateway -->|"reserve with client reservation id [grpc]"| n_reservation_service
  n_api_gateway -->|"admin crud on hotels and inventory [grpc]"| n_hotel_management_service
  n_hotel_service -->|"hotel and room type rows [sql]"| n_hotel_rate_db
  n_rate_service -->|"room_type_rate rows [sql]"| n_hotel_rate_db
  n_hotel_management_service -->|"hotel crud [sql]"| n_hotel_rate_db
  n_hotel_management_service -->|"total_inventory updates [sql]"| n_reservation_db
  n_reservation_service -->|"available count per hotel, room type, date [redis]"| n_inventory_cache
  n_reservation_service -->|"authoritative check and insert, total_reserved &lt;= 110% total_inventory [sql]"| n_reservation_db
  n_reservation_db -.->|"inventory row changes [mysql-binlog, at-least-once]"| n_inventory_cdc
  n_inventory_cdc -.->|"cdc-stream, at-least-once"| n_cache_updater
  n_cache_updater -.->|"refresh available count, current and future dates only [redis, at-least-once]"| n_inventory_cache
  n_reservation_service -->|"start booking workflow, status pending [grpc]"| n_booking_orchestrator
  n_booking_orchestrator -->|"fraud check agent [grpc]"| n_fraud_service
  n_booking_orchestrator -->|"confirm strictest-terms product first [https]"| n_supplier_api
  n_booking_orchestrator -->|"payment agent, status paid [grpc]"| n_payment_service
  n_payment_service -->|"charge card with idempotency key [https]"| n_psp
  n_booking_orchestrator -.->|"compensate: rejected, cancelled or refunded [grpc, at-least-once]"| n_reservation_service
  n_price_search_service -->|"itinerary price lookup [redis]"| n_price_cache
  n_price_search_service -->|"predict ttl for this search cluster [grpc]"| n_smart_ttl
  n_smart_ttl -->|"write learned per-itinerary ttl [redis]"| n_price_cache
  n_price_search_service -->|"on price cache miss [http]"| n_supplier_quota_limiter
  n_smart_scheduler -.->|"prefetch high-value itineraries at constant qps [http, at-least-once]"| n_supplier_quota_limiter
  n_supplier_quota_limiter -->|"fetch price within supplier qps quota [https]"| n_supplier_api
  n_supplier_quota_limiter -.->|"store fetched price [redis, at-least-once]"| n_price_cache
```
