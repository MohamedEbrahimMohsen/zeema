// Glyphs for kinds installed by the coverage loop (install_kinds.py appends here).
export const KIND_GLYPHS_EXTRA = {
"virtual-machine":
  `<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="M6 8.5h5.5M6 12h3.5"/><circle cx="17" cy="8.5" r="1.3"/>`,
"container-orchestrator":
  `<rect x="2.5" y="3" width="19" height="18" rx="2.5"/><rect x="5.5" y="6" width="5" height="5" rx="1"/><rect x="13.5" y="6" width="5" height="5" rx="1"/><rect x="5.5" y="14" width="5" height="5" rx="1"/>`,
"container-registry":
  `<rect x="2.5" y="8.5" width="12" height="12" rx="1.5"/><path d="M5.5 5.5h11.5v11.5"/><path d="M8.5 2.5h11.5V14"/>`,
"block-storage":
  `<rect x="2.5" y="7" width="12" height="10" rx="1.5"/><circle cx="8.5" cy="12" r="2.5"/><path d="M14.5 12h6"/><path d="M4.5 9.2h1.5"/>`,
"file-storage":
  `<path d="M2.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2.5h5.5A1.5 1.5 0 0 1 17 9.5V16a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 16z"/><path d="M19.5 6.5h2M19.5 10h2"/>`,
"firewall":
  `<rect x="2.5" y="4" width="15" height="12" rx="1.5"/><path d="M2.5 8h15M2.5 12h15"/><path d="M8 4v4M12 8v4M8 12v4"/>`,
"waf":
  `<path d="M2.5 4.5h13.5l-5.2 6.4v6.1l-3.1-1.8v-4.3z"/><path d="M18.5 5.5 21.5 8.5M21.5 5.5l-3 3"/>`,
"vpn-gateway":
  `<path d="M2.5 12h6M15.5 12h6"/><rect x="8.5" y="8" width="7" height="6.5" rx="1.5"/><path d="M10.2 8V6.5a1.8 1.8 0 0 1 3.6 0V8"/>`,
"nat-gateway":
  `<rect x="7.5" y="8" width="9" height="8" rx="1.5"/><path d="M2.5 10h5M2.5 14h5"/><path d="M16.5 11h4"/><path d="M18.5 8.8 20.9 11l-2.4 2.2"/>`,
"private-link":
  `<path d="M10 8H6.5a4 4 0 0 0 0 8H10"/><path d="M14 8h3.5a4 4 0 0 1 1.5 7.6"/><path d="M8.5 12h7"/>`,
"bastion-host":
  `<rect x="3" y="3.5" width="10" height="13" rx="1.5"/><circle cx="10.3" cy="10" r="1"/><path d="M21 6.5h-6"/><path d="M17.5 3.8 14.8 6.5l2.7 2.7"/>`,
"ddos-protection":
  `<circle cx="4" cy="6" r="1.4"/><circle cx="4" cy="12" r="1.4"/><circle cx="4" cy="18" r="1.4"/><path d="M6 6h5.5M6 12h5.5M6 18h5.5"/><path d="M14 3.5v17"/>`,
"backup-service":
  `<rect x="2.5" y="5.5" width="12" height="4" rx="1"/><path d="M4 9.5v7.5a1.5 1.5 0 0 0 1.5 1.5H13a1.5 1.5 0 0 0 1.5-1.5V9.5"/><path d="M7 13h4.5"/><path d="M21 8.5a4 4 0 1 0-1.2 2.9"/><path d="M17.6 4.6v3.9h3.9"/>`,
"ci-pipeline":
  `<circle cx="5" cy="6" r="2.2"/><circle cx="5" cy="18" r="2.2"/><circle cx="15" cy="6" r="2.2"/><path d="M5 8.2v7.6M7.2 6h5.6"/><path d="M15 8.2v2a3 3 0 0 1-3 3H8"/>`,
"artifact-repository":
  `<path d="M2.5 7 9 4l6.5 3v7L9 17.5 2.5 14.5z"/><path d="M2.5 7 9 10l6.5-3"/><path d="M9 10v7.5"/>`,
"policy-engine":
  `<rect x="3.5" y="4.5" width="12" height="15" rx="2"/><path d="M7 4.5V3.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.3"/><path d="M6.5 10.2 8.5 12.2l4-4"/><path d="M6.5 15.8h6"/>`,
"ai-service":
  `<path d="M13 3.5 14.9 9.1 20.5 11 14.9 12.9 13 18.5 11.1 12.9 5.5 11 11.1 9.1z"/><path d="M5.5 3 6.2 5.3 8.5 6 6.2 6.7 5.5 9 4.8 6.7 2.5 6 4.8 5.3z"/>`,
"ml-platform":
  `<path d="M7.5 2.5v6L3 16.5a1.8 1.8 0 0 0 1.5 2.8h8a1.8 1.8 0 0 0 1.5-2.8L9.5 8.5v-6"/><path d="M6 2.5h5"/><path d="M5.5 13.5h6"/><path d="M17.5 5v4M19.5 7h-4"/>`,
"big-data-cluster":
  `<rect x="2.5" y="10" width="5.5" height="10" rx="1.5"/><rect x="10" y="10" width="5.5" height="10" rx="1.5"/><path d="M5.2 7.5V5h13.5v2.5"/><path d="M12.7 7.5V10M5.2 7.5V10"/>`,
"data-catalog":
  `<path d="M3 4.5h9.5A1.5 1.5 0 0 1 14 6v11.5H4.5A1.5 1.5 0 0 1 3 16z"/><path d="M3 17.5A1.5 1.5 0 0 1 4.5 16H14v4H4.5A1.5 1.5 0 0 1 3 18.5z"/><path d="M6 8h5M6 11h3"/>`,
"iot-hub":
  `<rect x="9" y="9" width="6" height="6" rx="1.5"/><circle cx="4" cy="5" r="2"/><circle cx="4" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M5.5 6.4 9 9.5M5.5 17.6 9 14.5M17.5 6.4 15 9"/>`,
"edge-appliance":
  `<rect x="3" y="9" width="13" height="8" rx="1.5"/><path d="M6 12.8h5"/><path d="M5.5 17v2.5M13.5 17v2.5"/><path d="M9.5 9V5.5"/><circle cx="9.5" cy="4" r="1.5"/>`,
"virtual-desktop":
  `<rect x="2.5" y="4" width="15" height="11" rx="2"/><path d="M7 18.5h6M10 15v3.5"/><circle cx="7" cy="8.7" r="1.6"/><circle cx="12.5" cy="8.7" r="1.6"/>`,
"bi-service":
  `<path d="M3 20.5h15"/><rect x="4" y="12" width="3.5" height="8.5" rx="1"/><rect x="9.5" y="8" width="3.5" height="12.5" rx="1"/><path d="M4.5 10.5 9 6l4 3.5 5.5-5.5"/>`,
"vector-database":
  `<circle cx="6" cy="7" r="1.8"/><circle cx="13" cy="4.5" r="1.8"/><circle cx="5.5" cy="15" r="1.8"/><path d="M7.7 6.4 11.3 5.1M5.9 8.8 5.6 13.2"/>`,
"media-transcoder":
  `<rect x="2.5" y="6.5" width="7.5" height="11" rx="1.5"/><path d="M11.5 11h3.5"/><path d="M13.5 9.5 15 11l-1.5 1.5"/><path d="M16.5 4h4.5M16.5 8h3.5M16.5 12h2.5"/>`,
"contact-center":
  `<path d="M4.75 9.5V9a7.25 7.25 0 0 1 14.5 0v.5"/><rect x="3" y="8.5" width="3.5" height="5" rx="1.75"/><rect x="17.5" y="8.5" width="3.5" height="5" rx="1.75"/><path d="M5.75 13.5v2a2 2 0 0 0 2 2h2.75"/>`,
"bot-management":
  `<rect x="2.5" y="5" width="10.5" height="8" rx="2"/><path d="M7.75 2v3"/><path d="M5.5 8.5v1.5M10 8.5v1.5"/><path d="M6 11.5h3.5"/>`,
"email-security-gateway":
  `<rect x="2.5" y="3.5" width="10.5" height="8" rx="1.5"/><path d="M3 4.5 7.75 8.5 12.5 4.5"/><path d="M3.5 15l2.5 2.5 5-5"/>`,
"content-repository":
  `<rect x="3" y="3" width="10" height="15" rx="1.5"/><rect x="5.5" y="6" width="5" height="3.5" rx="0.5"/><path d="M5.5 12h5M5.5 15h3"/><path d="M15.5 6.5a4 4 0 0 1 0 5M18 5a6.5 6.5 0 0 1 0 8"/>`,
};
