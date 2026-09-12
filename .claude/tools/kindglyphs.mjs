// Hand-authored 24x24 line glyphs, one per Arkore kind.
// Style: stroke=currentColor, fill=none, stroke-width 1.5, round caps/joins.
export const KIND_GLYPHS = {
  "api-gateway":
    `<path d="M3 21V10a9 9 0 0 1 18 0v11"/>` +
    `<path d="M9 21v-8a3 3 0 0 1 6 0v8"/>` +
    `<path d="M2 21h20"/>`,

  "app-server":
    `<rect x="3" y="4" width="18" height="7" rx="2"/>` +
    `<rect x="3" y="13" width="18" height="7" rx="2"/>` +
    `<path d="M6.5 7.5h.01M6.5 16.5h.01"/>` +
    `<path d="M10 7.5h5M10 16.5h5"/>`,

  cache:
    `<rect x="3" y="4" width="18" height="16" rx="2.5"/>` +
    `<path d="M13.5 7.5 9.5 13H12l-1.5 4.5 4-5.5H12z"/>`,

  cdn:
    `<circle cx="12" cy="12" r="9"/>` +
    `<path d="M3 12h18"/>` +
    `<path d="M12 3a13.5 13.5 0 0 1 0 18 13.5 13.5 0 0 1 0-18"/>` +
    `<circle cx="12" cy="3" r="1.6"/><circle cx="3" cy="12" r="1.6"/><circle cx="21" cy="12" r="1.6"/>`,

  "change-data-capture":
    `<ellipse cx="7" cy="5.5" rx="5" ry="2.2"/>` +
    `<path d="M2 5.5v11c0 1.2 2.2 2.2 5 2.2s5-1 5-2.2v-11"/>` +
    `<path d="M2 11.5c0 1.2 2.2 2.2 5 2.2s5-1 5-2.2"/>` +
    `<path d="M14 12h7"/><path d="M18 9l3 3-3 3"/>`,

  client: `<rect x="2" y="4" width="20" height="13" rx="2.5"/>` + `<path d="M8 21h8M12 17v4"/>`,

  "coordination-service":
    `<circle cx="12" cy="4.5" r="2.5"/>` +
    `<circle cx="4.5" cy="17.5" r="2.5"/>` +
    `<circle cx="17" cy="16" r="2.5"/>` +
    `<path d="M10.4 6.8 6.1 15.2M13.7 6.5l2.6 7.2M6.9 16.9l7.6-.6"/>`,

  "data-warehouse":
    `<path d="M3 9.5 12 4l9 5.5"/>` +
    `<path d="M4.5 9.5V20M19.5 9.5V20M3 20h18"/>` +
    `<path d="M8 20v-6h3.2v6M12.8 20v-6H16v6"/>`,

  "database-proxy":
    `<ellipse cx="12" cy="4" rx="4.5" ry="1.8"/>` +
    `<path d="M7.5 4v3.6c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8V4"/>` +
    `<rect x="2" y="12" width="20" height="6.5" rx="2"/>` +
    `<path d="M6 15.2h.01M10 15.2h.01M14 15.2h.01M18 15.2h.01"/>`,

  dns:
    `<path d="M12 3v18"/>` +
    `<path d="M12 5h7l2.2 2.5L19 10h-7z"/>` +
    `<path d="M12 13H5l-2.2 2.5L5 18h7z"/>`,

  "event-store":
    `<ellipse cx="12" cy="6" rx="8" ry="3"/>` +
    `<path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/>` +
    `<path d="M8 13.5h7"/><path d="M12.5 11 15 13.5 12.5 16"/>`,

  "feature-flag-service":
    `<path d="M5.5 21V3"/>` +
    `<path d="M5.5 4h11l-2.6 4 2.6 4h-11z"/>` +
    `<path d="M9 16h9"/><circle cx="15" cy="16" r="2.5"/>`,

  "graph-database":
    `<circle cx="5" cy="6" r="2.5"/>` +
    `<circle cx="18" cy="5" r="2.5"/>` +
    `<circle cx="12" cy="13.5" r="2.5"/>` +
    `<circle cx="4" cy="18" r="2.5"/>` +
    `<path d="M6.7 7.9 10.3 11.7M16.2 6.8l-2.6 4.8M10 15 5.9 16.9"/>`,

  "id-generator":
    `<rect x="3" y="3" width="18" height="18" rx="3.5"/>` +
    `<path d="M9.5 7.5v9M14.5 7.5v9M7 10.5h10M7 14.5h10"/>`,

  "identity-provider":
    `<path d="M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6z"/>` +
    `<circle cx="12" cy="10" r="2.2"/>` +
    `<path d="M8.4 16.2a4 4 0 0 1 7.2 0"/>`,

  "key-management":
    `<circle cx="8" cy="12" r="4.5"/>` +
    `<path d="M12.5 12H21"/>` +
    `<path d="M17 12v3.5M20 12v2.5"/>`,

  ledger:
    `<rect x="3.5" y="3" width="17" height="18" rx="2.5"/>` +
    `<path d="M7.5 3v18"/>` +
    `<path d="M10 7.5h2.5M10 12h2.5M10 16.5h2"/>` +
    `<path d="M15.5 7.5H18M15.5 12H18M15.5 16.5h2"/>`,

  "load-balancer":
    `<path d="M2 12h8"/>` +
    `<path d="M10 12V6h5M10 12h5M10 12v6h5"/>` +
    `<path d="M13 4l2 2-2 2M13 10l2 2-2 2M13 16l2 2-2 2"/>`,

  "matching-engine":
    `<path d="M12 3.5v17"/>` +
    `<path d="M2 12h8M22 12h-8"/>` +
    `<path d="M7 8.5 10.5 12 7 15.5M17 8.5 13.5 12 17 15.5"/>`,

  "media-router":
    `<circle cx="7" cy="12" r="5"/>` +
    `<path d="M5.7 9.5 10 12l-4.3 2.5z"/>` +
    `<path d="M12 12h3.5M15.5 12V6h4.5M15.5 12v6h4.5"/>`,

  "ml-inference":
    `<rect x="6" y="6" width="12" height="12" rx="2.5"/>` +
    `<circle cx="12" cy="12" r="2.2"/>` +
    `<path d="M9.5 3v3M14.5 3v3M9.5 18v3M14.5 18v3M3 9.5h3M3 14.5h3M18 9.5h3M18 14.5h3"/>`,

  monitoring:
    `<rect x="3" y="4" width="18" height="16" rx="2.5"/>` +
    `<path d="M6 13.5h3l2-4 2.5 7 2-3h2.5"/>`,

  "network-fabric":
    `<path d="M3 8.5h18M3 15.5h18M8.5 3v18M15.5 3v18"/>` +
    `<g fill="currentColor" stroke="none">` +
    `<circle cx="8.5" cy="8.5" r="1.9"/><circle cx="15.5" cy="8.5" r="1.9"/>` +
    `<circle cx="8.5" cy="15.5" r="1.9"/><circle cx="15.5" cy="15.5" r="1.9"/></g>`,

  "nosql-database":
    `<ellipse cx="12" cy="6" rx="8" ry="3"/>` +
    `<path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/>` +
    `<path d="M6.5 11.5h2M11 12h2M15.5 11.5h2"/>` +
    `<path d="M6.5 16h2M11 16.5h2M15.5 16h2"/>`,

  "notification-service":
    `<path d="M18 9.5a6 6 0 1 0-12 0c0 4.8-2 6.5-2 6.5h16s-2-1.7-2-6.5z"/>` +
    `<path d="M10.2 19.5a2.2 2.2 0 0 0 3.6 0"/>`,

  "object-store":
    `<ellipse cx="12" cy="7" rx="8" ry="2.5"/>` +
    `<path d="M4 7l1.6 12.3a2 2 0 0 0 2 1.7h8.8a2 2 0 0 0 2-1.7L20 7"/>`,

  "pubsub-topic":
    `<circle cx="4" cy="12" r="2.3"/>` +
    `<circle cx="15" cy="4.5" r="2.3"/><circle cx="15" cy="12" r="2.3"/><circle cx="15" cy="19.5" r="2.3"/>` +
    `<path d="M6 10.7 13 5.8M6.3 12h6.4M6 13.3l7 4.9"/>` +
    `<path d="M18 4.5h3M18 12h3M18 19.5h3"/>`,

  queue:
    `<path d="M4 7.5v9M8 7.5v9M12 7.5v9"/>` +
    `<path d="M14.5 12H21"/>` +
    `<path d="M18.5 9.5 21 12l-2.5 2.5"/>`,

  "rate-limiter":
    `<path d="M3.5 18.5a8.5 8.5 0 1 1 17 0"/>` +
    `<path d="M12 18.5 16 13"/>` +
    `<circle cx="12" cy="18.5" r="1.3"/>` +
    `<path d="M12 6.5v2M6 9.5l1.4 1.4M18 9.5l-1.4 1.4"/>`,

  "realtime-gateway":
    `<circle cx="12" cy="12" r="2.2"/>` +
    `<path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 15.5a5 5 0 0 0 0-7"/>` +
    `<path d="M5.5 5.5a9 9 0 0 0 0 13M18.5 18.5a9 9 0 0 0 0-13"/>`,

  "schema-registry":
    `<path d="M14 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z"/>` +
    `<path d="M14 2.5v5h5"/>` +
    `<path d="M10.6 11.6c-.9 0-.9 1.2-.9 1.7s0 1.7-.9 1.7c.9 0 .9 1.2.9 1.7s0 1.7.9 1.7"/>` +
    `<path d="M13.4 11.6c.9 0 .9 1.2.9 1.7s0 1.7.9 1.7c-.9 0-.9 1.2-.9 1.7s0 1.7-.9 1.7"/>`,

  "search-index":
    `<circle cx="14" cy="10" r="6"/>` +
    `<path d="M9.8 14.2 4 20"/>` +
    `<path d="M11 8.5h6M11 11.5h4"/>`,

  "service-mesh":
    `<path d="M12 2.5 20 7v10l-8 4.5L4 17V7z"/>` +
    `<circle cx="12" cy="12" r="2.4"/>` +
    `<path d="M12 4.5v5.1M6.5 8.7l3.4 2M17.5 8.7l-3.4 2M12 14.4v5.1"/>`,

  "sql-database":
    `<ellipse cx="12" cy="6" rx="8" ry="3"/>` +
    `<path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/>` +
    `<path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>`,

  stream:
    `<path d="M2.5 6.5c3-2.2 6.5 2.2 9.5 0s6.5-2.2 9.5 0"/>` +
    `<path d="M2.5 12c3-2.2 6.5 2.2 9.5 0s6.5-2.2 9.5 0"/>` +
    `<path d="M2.5 17.5c3-2.2 6.5 2.2 9.5 0s6.5-2.2 9.5 0"/>`,

  "stream-processor":
    `<rect x="7" y="5.5" width="10" height="13" rx="2.5"/>` +
    `<path d="M1.5 8.5H7M1.5 12H7M1.5 15.5H7M17 12h5.5"/>` +
    `<path d="M19.5 9.5 22 12l-2.5 2.5"/>`,

  "third-party-api":
    `<path d="M12.5 3.5H5.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7"/>` +
    `<path d="M14.5 3.5h6v6"/>` +
    `<path d="M20.5 3.5 12 12"/>`,

  "timeseries-database":
    `<ellipse cx="12" cy="6" rx="8" ry="3"/>` +
    `<path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/>` +
    `<path d="M6.5 15.5 10 12l2.5 2.5L17 9.5"/>`,

  "webhook-endpoint":
    `<path d="M2.5 12h9"/>` +
    `<path d="M8.5 9l3 3-3 3"/>` +
    `<rect x="14" y="4.5" width="7.5" height="15" rx="2.5"/>` +
    `<path d="M17.75 9v6"/>`,

  worker:
    `<circle cx="12" cy="12" r="8"/>` +
    `<circle cx="12" cy="12" r="3.2"/>` +
    `<path d="M12 2.5v1.5M12 20v1.5M21.5 12H20M4 12H2.5M18.7 5.3l-1.1 1.1M6.4 17.6l-1.1 1.1M18.7 18.7l-1.1-1.1M6.4 6.4 5.3 5.3"/>`,

  "workflow-engine":
    `<rect x="3" y="3" width="7.5" height="6" rx="1.8"/>` +
    `<rect x="3" y="15" width="7.5" height="6" rx="1.8"/>` +
    `<rect x="13.5" y="15" width="7.5" height="6" rx="1.8"/>` +
    `<path d="M6.75 9v6"/>` +
    `<path d="M10.5 6h5.25a1.5 1.5 0 0 1 1.5 1.5V15"/>`,
};
