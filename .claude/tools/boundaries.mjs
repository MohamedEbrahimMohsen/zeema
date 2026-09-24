// The boundary icon set: icons/boundaries/<id>.svg, written by icons.mjs.
//
// A boundary (a design group) may show one icon before its label. Besides the kind glyphs and the
// component icons, it can use one of these: the mark of the platform the boundary stands for
// (an AWS account, a Kubernetes cluster, a GitHub organisation) or a generic concept (on-premises,
// the internet, users, a production environment). They live in their own folder so that nothing
// here collides with, or is mistaken for, a kind or a component icon.
//
// BOUNDARY_BRANDS maps a boundary icon id to where its mark comes from:
//   - a key of icons/providers/ ("aws", "googlecloud"): the mark is copied from that file, which is
//     already fitted and licensed (Simple Icons CC0, or original artwork for aws/azure/oci/ibm);
//   - otherwise a Simple Icons slug, fitted with the same path rounding the provider marks use.
// BOUNDARY_GLYPHS are original line glyphs in the kind style (24x24, stroke 1.5, round caps).

export const BOUNDARY_BRANDS = {
  // cloud platforms
  aws: "aws",
  azure: "azure",
  gcp: "googlecloud",
  google: "google",
  ibm: "ibm",
  oci: "oci",
  alibabacloud: "alibabacloud",
  cloudflare: "cloudflare",
  digitalocean: "digitalocean",
  openstack: "openstack",
  vmware: "vmware",
  vercel: "vercel",
  // platforms and tooling
  kubernetes: "kubernetes",
  docker: "docker",
  helm: "helm",
  terraform: "terraform",
  ansible: "ansible",
  github: "github",
  gitlab: "gitlab",
  // operating systems and devices
  linux: "linux",
  ubuntu: "ubuntu",
  redhat: "redhat",
  apple: "apple",
  android: "android",
  // AI
  anthropic: "anthropic",
  nvidia: "nvidia",
  huggingface: "huggingface",
  // identity, network, observability
  okta: "okta",
  cisco: "cisco",
  datadog: "datadog",
  grafana: "grafana",
  prometheus: "prometheus",
  elastic: "elastic",
  // data platforms
  snowflake: "snowflake",
  databricks: "databricks",
  kafka: "apachekafka",
  mongodb: "mongodb",
  postgresql: "postgresql",
  mysql: "mysql",
  redis: "redis",
};

export const BOUNDARY_GLYPHS = {
  ai:
    `<path d="M10 4.5l1.6 4.9 4.9 1.6-4.9 1.6L10 17.5l-1.6-4.9L3.5 11l4.9-1.6z"/>` +
    `<path d="M18 2.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>` +
    `<path d="M18 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>`,
  analytics:
    `<path d="M3 21h18"/>` +
    `<rect x="5" y="12" width="3" height="6" rx=".8"/>` +
    `<rect x="10.5" y="7" width="3" height="11" rx=".8"/>` +
    `<rect x="16" y="3.5" width="3" height="14.5" rx=".8"/>`,
  cloud: `<path d="M6.5 19a4.5 4.5 0 0 1-.4-9 6 6 0 0 1 11.6 1.5 3.75 3.75 0 0 1-.2 7.5z"/>`,
  database:
    `<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/>` +
    `<path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13"/>` +
    `<path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>`,
  edge:
    `<circle cx="12" cy="12" r="2"/>` +
    `<path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4"/>` +
    `<path d="M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>`,
  "environment-dev":
    `<rect x="2.5" y="4" width="19" height="16" rx="2.5"/>` +
    `<path d="M9 9.5 6 12l3 2.5M15 9.5l3 2.5-3 2.5"/>`,
  "environment-prod":
    `<path d="M12 2.5c3 2.2 4.5 5.3 4.5 9.2L14.5 17h-5l-2-5.3c0-3.9 1.5-7 4.5-9.2z"/>` +
    `<circle cx="12" cy="9.5" r="1.8"/>` +
    `<path d="M7.8 13.2 5 16l.5 3 3.4-1.7M16.2 13.2 19 16l-.5 3-3.4-1.7"/>` +
    `<path d="M10.5 20l1.5 1.5 1.5-1.5"/>`,
  "environment-test":
    `<path d="M9 3h6M10 3v6l-5.2 9a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9V3"/>` +
    `<path d="M7.2 15h9.6"/>`,
  internet:
    `<circle cx="12" cy="12" r="9"/>` +
    `<path d="M3 12h18M4.6 7h14.8M4.6 17h14.8"/>` +
    `<path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18"/>`,
  iot:
    `<rect x="7" y="7" width="10" height="10" rx="1.5"/>` +
    `<rect x="10" y="10" width="4" height="4" rx=".5"/>` +
    `<path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>`,
  mobile: `<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/>` + `<path d="M11 18.5h2"/>`,
  network:
    `<rect x="9" y="2.5" width="6" height="5" rx="1"/>` +
    `<rect x="2.5" y="16.5" width="6" height="5" rx="1"/>` +
    `<rect x="15.5" y="16.5" width="6" height="5" rx="1"/>` +
    `<path d="M12 7.5V12M5.5 16.5V12h13v4.5"/>`,
  office:
    `<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/>` +
    `<path d="M16 9h2a2 2 0 0 1 2 2v10"/>` +
    `<path d="M2.5 21h19"/>` +
    `<path d="M8 7h.01M12 7h.01M8 11h.01M12 11h.01M8 15h.01M12 15h.01"/>` +
    `<path d="M10 21v-3"/>`,
  "on-premises":
    `<rect x="4" y="3" width="16" height="18" rx="2"/>` +
    `<path d="M4 9h16M4 15h16"/>` +
    `<path d="M7.5 6h.01M7.5 12h.01M7.5 18h.01M11 6h5.5M11 12h5.5M11 18h5.5"/>`,
  partner:
    `<path d="M9.5 14.5l5-5"/>` +
    `<path d="M11 6.5l1.8-1.8a4 4 0 0 1 5.6 5.6L16.5 12"/>` +
    `<path d="M13 17.5l-1.8 1.8a4 4 0 0 1-5.6-5.6L7.5 12"/>`,
  region:
    `<path d="M12 21.5s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/>` +
    `<circle cx="12" cy="10.5" r="2.5"/>`,
  security:
    `<path d="M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6z"/>` +
    `<path d="m8.5 12 2.5 2.5 4.5-5"/>`,
  users:
    `<circle cx="9" cy="8" r="3.2"/>` +
    `<path d="M3 20a6 6 0 0 1 12 0"/>` +
    `<path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.6"/>` +
    `<path d="M17.5 14.3A6 6 0 0 1 21 20"/>`,
};
