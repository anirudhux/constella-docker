import type { InputKind } from "../types/graph";

export const SAMPLES: Record<InputKind, { filename: string; text: string }> = {
  spreadsheet: {
    filename: "atlas-levels.csv",
    text: `Department,Area,Topic,Page,Owner,Related
Engineering,Backend,Auth,Authentication Service,Carol,Security Policy
Engineering,Backend,Billing,Billing Service,Carol,Procurement
Engineering,Infrastructure,Compute,Kubernetes Cluster,SRE,
Product,Specs,API,Public API,Maya,API Gateway
Product,Specs,Mobile,Mobile App v2,Leo,
Operations,Legal,Policy,Security Policy,Legal,
Operations,Finance,Vendors,Procurement,Finance,
`,
  },
  markdown: {
    filename: "atlas-outline.md",
    text: `# Atlas

## Engineering

### Backend

#### Authentication Service
owner: Carol
related: Security Policy

#### Billing Service
owner: Carol

### Infrastructure

#### Kubernetes Cluster
owner: SRE

## Operations

### Legal

#### Security Policy
owner: Legal
`,
  },
  json: {
    filename: "atlas-manifest.json",
    text: `{
  "nodes": [
    { "id": "atlas", "name": "Atlas", "type": "root" },
    { "id": "eng", "name": "Engineering", "parent": "atlas" },
    { "id": "backend", "name": "Backend", "parent": "eng" },
    { "id": "auth", "name": "Authentication Service", "parent": "backend", "url": "/docs/auth" },
    { "id": "ops", "name": "Operations", "parent": "atlas" },
    { "id": "sec", "name": "Security Policy", "parent": "ops" }
  ],
  "links": [
    { "source": "auth", "target": "sec", "kind": "reference" }
  ]
}
`,
  },
};
