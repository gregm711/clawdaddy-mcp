#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE_URL = "https://clawdaddy.app";

// ============== Type Definitions ==============

interface LookupResult {
  fqdn: string;
  available: boolean;
  status: "available" | "registered" | "unknown";
  premium: boolean;
  price: {
    amount: number;
    currency: string;
    period: string;
  } | null;
  renewal: {
    amount: number;
    currency: string;
    period: string;
  } | null;
  checked_at: string;
  source: string;
  cache: {
    hit: boolean;
    ttl_seconds: number;
    stale: boolean;
  };
}

interface QuoteResult {
  domain: string;
  available: boolean;
  priceUsd: number;
  marginUsd: number;
  totalUsd: number;
  premium: boolean;
  currency: string;
  validUntil: string;
  paymentMethods: {
    stripe: {
      enabled: boolean;
      currency: string;
      endpoint: string;
    };
  };
}

interface PurchaseResult {
  method: string;
  checkoutUrl?: string;
  sessionId?: string;
  quote?: QuoteResult;
  success?: boolean;
  domain?: string;
  registrationId?: string;
  expiresAt?: string;
  nameservers?: string[];
  managementToken?: string;
  manageUrl?: string;
  message?: string;
  error?: string;
}

interface DomainInfo {
  domain: string;
  purchasedAt: string;
  expiresAt: string;
  nameservers: string[];
  settings: {
    locked: boolean;
    autorenewEnabled: boolean;
    privacyEnabled: boolean;
  };
  management: {
    dns: string;
    nameservers: string;
    settings: string;
    transfer: string;
  };
}

interface DnsRecord {
  id: number;
  domainName: string;
  host: string;
  fqdn: string;
  type: "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS" | "SRV";
  answer: string;
  ttl: number;
  priority?: number;
}

interface DnsListResult {
  records: DnsRecord[];
}

interface NameserversResult {
  domain: string;
  nameservers: string[];
}

interface SettingsResult {
  domain: string;
  locked: boolean;
  autorenewEnabled: boolean;
  privacyEnabled: boolean;
}

interface TransferResult {
  domain: string;
  authCode: string;
  locked: boolean;
  message: string;
}

interface RecoverResult {
  success: boolean;
  message: string;
}

// ============== API Functions ==============

async function lookupDomain(domain: string): Promise<LookupResult> {
  const url = `${BASE_URL}/api/lookup/${encodeURIComponent(domain)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ClawDaddy-MCP/1.0",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Lookup failed: ${response.statusText}`);
  }

  return response.json() as Promise<LookupResult>;
}

async function getQuote(domain: string): Promise<QuoteResult> {
  const url = `${BASE_URL}/api/purchase/${encodeURIComponent(domain)}/quote`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ClawDaddy-MCP/1.0",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Quote failed: ${response.statusText}`);
  }

  return response.json() as Promise<QuoteResult>;
}

async function purchaseDomain(domain: string): Promise<PurchaseResult> {
  const url = `${BASE_URL}/api/purchase/${encodeURIComponent(domain)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": "ClawDaddy-MCP/1.0",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Purchase failed: ${response.statusText}`);
  }

  return response.json() as Promise<PurchaseResult>;
}

async function getDomainInfo(domain: string, token: string): Promise<DomainInfo> {
  const url = `${BASE_URL}/api/manage/${encodeURIComponent(domain)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ClawDaddy-MCP/1.0",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to get domain info: ${response.statusText}`);
  }

  return response.json() as Promise<DomainInfo>;
}

async function listDnsRecords(domain: string, token: string): Promise<DnsListResult> {
  const url = `${BASE_URL}/api/manage/${encodeURIComponent(domain)}/dns`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ClawDaddy-MCP/1.0",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to list DNS records: ${response.statusText}`);
  }

  return response.json() as Promise<DnsListResult>;
}

async function addDnsRecord(
  domain: string,
  token: string,
  record: {
    host: string;
    type: string;
    answer: string;
    ttl?: number;
    priority?: number;
  }
): Promise<DnsRecord> {
  const url = `${BASE_URL}/api/manage/${encodeURIComponent(domain)}/dns`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": "ClawDaddy-MCP/1.0",
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to add DNS record: ${response.statusText}`);
  }

  return response.json() as Promise<DnsRecord>;
}

async function updateDnsRecord(
  domain: string,
  token: string,
  recordId: number,
  updates: {
    host?: string;
    type?: string;
    answer?: string;
    ttl?: number;
    priority?: number;
  }
): Promise<DnsRecord> {
  const url = `${BASE_URL}/api/manage/${encodeURIComponent(domain)}/dns?id=${recordId}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "User-Agent": "ClawDaddy-MCP/1.0",
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to update DNS record: ${response.statusText}`);
  }

  return response.json() as Promise<DnsRecord>;
}

async function deleteDnsRecord(
  domain: string,
  token: string,
  recordId: number
): Promise<{ success: boolean }> {
  const url = `${BASE_URL}/api/manage/${encodeURIComponent(domain)}/dns?id=${recordId}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "User-Agent": "ClawDaddy-MCP/1.0",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to delete DNS record: ${response.statusText}`);
  }

  return { success: true };
}

async function getNameservers(domain: string, token: string): Promise<NameserversResult> {
  const url = `${BASE_URL}/api/manage/${encodeURIComponent(domain)}/nameservers`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ClawDaddy-MCP/1.0",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to get nameservers: ${response.statusText}`);
  }

  return response.json() as Promise<NameserversResult>;
}

async function setNameservers(
  domain: string,
  token: string,
  nameservers: string[]
): Promise<NameserversResult> {
  const url = `${BASE_URL}/api/manage/${encodeURIComponent(domain)}/nameservers`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "User-Agent": "ClawDaddy-MCP/1.0",
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ nameservers }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to set nameservers: ${response.statusText}`);
  }

  return response.json() as Promise<NameserversResult>;
}

async function getSettings(domain: string, token: string): Promise<SettingsResult> {
  const url = `${BASE_URL}/api/manage/${encodeURIComponent(domain)}/settings`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ClawDaddy-MCP/1.0",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to get settings: ${response.statusText}`);
  }

  return response.json() as Promise<SettingsResult>;
}

async function updateSettings(
  domain: string,
  token: string,
  settings: {
    locked?: boolean;
    autorenewEnabled?: boolean;
  }
): Promise<SettingsResult> {
  const url = `${BASE_URL}/api/manage/${encodeURIComponent(domain)}/settings`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "User-Agent": "ClawDaddy-MCP/1.0",
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to update settings: ${response.statusText}`);
  }

  return response.json() as Promise<SettingsResult>;
}

async function getTransferCode(domain: string, token: string): Promise<TransferResult> {
  const url = `${BASE_URL}/api/manage/${encodeURIComponent(domain)}/transfer`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ClawDaddy-MCP/1.0",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to get transfer code: ${response.statusText}`);
  }

  return response.json() as Promise<TransferResult>;
}

async function recoverToken(
  email: string,
  domain?: string
): Promise<RecoverResult> {
  const url = `${BASE_URL}/api/recover`;
  const body: Record<string, string> = { email };
  if (domain) body.domain = domain;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": "ClawDaddy-MCP/1.0",
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Token recovery failed: ${response.statusText}`);
  }

  return response.json() as Promise<RecoverResult>;
}

// ============== Formatters ==============

function formatLookupResult(result: LookupResult): string {
  const lines: string[] = [];
  lines.push(`Domain: ${result.fqdn}`);
  lines.push(`Status: ${result.status.toUpperCase()}`);
  lines.push(`Available: ${result.available ? "Yes" : "No"}`);

  if (result.available && result.price) {
    lines.push(`Purchase Price: $${result.price.amount}/${result.price.period}`);
    if (result.renewal) {
      lines.push(`Renewal Price: $${result.renewal.amount}/${result.renewal.period}`);
    }
    if (result.premium) {
      lines.push(`Note: This is a PREMIUM domain`);
    }
  }

  lines.push(`\nChecked: ${result.checked_at}`);
  lines.push(`Cache: ${result.cache.hit ? "HIT" : "MISS"} (TTL: ${result.cache.ttl_seconds}s)`);

  return lines.join("\n");
}

function formatQuoteResult(result: QuoteResult): string {
  const lines: string[] = [];
  lines.push(`Domain: ${result.domain}`);
  lines.push(`Available: ${result.available ? "Yes" : "No"}`);

  if (result.available) {
    lines.push(`\nPricing:`);
    lines.push(`  Base Price: $${result.priceUsd}`);
    lines.push(`  Service Fee: $${result.marginUsd}${result.marginUsd === 0 ? " (LOBSTER LAUNCH SPECIAL!)" : ""}`);
    lines.push(`  Total: $${result.totalUsd}`);
    if (result.premium) {
      lines.push(`  Note: Premium domain`);
    }

    lines.push(`\nPayment: Stripe (Credit/Debit Card)`);
    lines.push(`\nQuote valid until: ${result.validUntil}`);
  }

  return lines.join("\n");
}

function formatPurchaseResult(result: PurchaseResult): string {
  const lines: string[] = [];

  // Handle Stripe checkout
  if (result.checkoutUrl) {
    lines.push(`Stripe Checkout Session Created`);
    lines.push(`\nCheckout URL: ${result.checkoutUrl}`);
    lines.push(`\n** ACTION REQUIRED: Have your human open the checkout URL to complete payment with their credit card. **`);
    lines.push(`\nAfter payment:`);
    lines.push(`1. The management token will be shown on the success page`);
    lines.push(`2. A confirmation email will be sent with the token`);
    lines.push(`3. Save the token to manage DNS, nameservers, and settings`);
    return lines.join("\n");
  }

  // Handle successful purchase
  if (result.success) {
    lines.push(`Domain Registered Successfully!`);
    lines.push(`\nDomain: ${result.domain}`);
    lines.push(`Registration ID: ${result.registrationId}`);
    lines.push(`Expires: ${result.expiresAt}`);
    if (result.nameservers?.length) {
      lines.push(`Nameservers: ${result.nameservers.join(", ")}`);
    }
    if (result.managementToken) {
      lines.push(`\n*** IMPORTANT - SAVE THIS TOKEN ***`);
      lines.push(`Management Token: ${result.managementToken}`);
      lines.push(`Manage URL: ${result.manageUrl}`);
      lines.push(`\nYou need this token to manage DNS, nameservers, and settings.`);
      lines.push(`Store it securely - it cannot be retrieved without recovery.`);
    }
    return lines.join("\n");
  }

  // Handle error
  if (result.error) {
    return `Error: ${result.error}`;
  }

  return JSON.stringify(result, null, 2);
}

function formatDomainInfo(result: DomainInfo): string {
  const lines: string[] = [];
  lines.push(`Domain: ${result.domain}`);
  lines.push(`Purchased: ${result.purchasedAt}`);
  lines.push(`Expires: ${result.expiresAt}`);
  lines.push(`\nNameservers:`);
  result.nameservers.forEach((ns) => lines.push(`  - ${ns}`));
  lines.push(`\nSettings:`);
  lines.push(`  Locked: ${result.settings.locked ? "Yes" : "No"}`);
  lines.push(`  Auto-Renew: ${result.settings.autorenewEnabled ? "Enabled" : "Disabled"}`);
  lines.push(`  Privacy: ${result.settings.privacyEnabled ? "Enabled" : "Disabled"}`);
  return lines.join("\n");
}

function formatDnsRecords(result: DnsListResult): string {
  if (!result.records.length) {
    return "No DNS records configured.";
  }

  const lines: string[] = [`DNS Records (${result.records.length}):\n`];
  result.records.forEach((r) => {
    const priority = r.priority ? ` (priority: ${r.priority})` : "";
    lines.push(`[${r.id}] ${r.host || "@"} ${r.type} ${r.answer} TTL:${r.ttl}${priority}`);
  });
  return lines.join("\n");
}

function formatDnsRecord(record: DnsRecord): string {
  const priority = record.priority ? ` (priority: ${record.priority})` : "";
  return `DNS Record Created:\n[${record.id}] ${record.host || "@"} ${record.type} ${record.answer} TTL:${record.ttl}${priority}`;
}

function formatNameservers(result: NameserversResult): string {
  const lines = [`Nameservers for ${result.domain}:\n`];
  result.nameservers.forEach((ns) => lines.push(`  - ${ns}`));
  return lines.join("\n");
}

function formatSettings(result: SettingsResult): string {
  const lines: string[] = [];
  lines.push(`Settings for ${result.domain}:`);
  lines.push(`  Locked: ${result.locked ? "Yes" : "No"}`);
  lines.push(`  Auto-Renew: ${result.autorenewEnabled ? "Enabled" : "Disabled"}`);
  lines.push(`  Privacy: ${result.privacyEnabled ? "Enabled" : "Disabled"}`);
  return lines.join("\n");
}

function formatTransfer(result: TransferResult): string {
  const lines: string[] = [];
  lines.push(`Transfer Code for ${result.domain}`);
  lines.push(`\nAuth Code: ${result.authCode}`);
  lines.push(`Domain Locked: ${result.locked ? "Yes (must unlock to transfer)" : "No"}`);
  lines.push(`\n${result.message}`);
  return lines.join("\n");
}

// ============== MCP Server ==============

const server = new Server(
  {
    name: "clawdaddy",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Lookup tools (no auth required)
      {
        name: "lookup_domain",
        description:
          "Check if a domain is available for registration. Returns availability status, pricing, and registration details. No authentication required. Powered by ClawDaddy.app - The World's #1 AI-Friendly Domain Registrar.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "The full domain to check (e.g., 'example.com', 'myapp.io')",
            },
          },
          required: ["domain"],
        },
      },
      {
        name: "get_quote",
        description:
          "Get a purchase quote for a domain including final pricing. The quote includes the base price, service fee (currently $0 during Lobster Launch Special!), and total cost. Payment is via Stripe (credit/debit card).",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "The domain to get a quote for (e.g., 'example.com')",
            },
          },
          required: ["domain"],
        },
      },
      {
        name: "purchase_domain",
        description:
          "Purchase a domain via Stripe. Returns a checkout URL where the user can complete payment with a credit/debit card. After payment, the management token is shown on the success page and emailed to the customer. IMPORTANT: Save the management token!",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "The domain to purchase (e.g., 'example.com')",
            },
          },
          required: ["domain"],
        },
      },

      // Management tools (require auth token)
      {
        name: "get_domain_info",
        description:
          "Get overview of a domain you own including nameservers, settings, and expiration date. Requires management token.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "The domain to get info for",
            },
            token: {
              type: "string",
              description: "Management token (starts with 'clwd_')",
            },
          },
          required: ["domain", "token"],
        },
      },
      {
        name: "list_dns_records",
        description:
          "List all DNS records for a domain. Returns record IDs needed for update/delete operations. Requires management token.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "The domain to list DNS records for",
            },
            token: {
              type: "string",
              description: "Management token (starts with 'clwd_')",
            },
          },
          required: ["domain", "token"],
        },
      },
      {
        name: "add_dns_record",
        description:
          "Add a DNS record to a domain. Supported types: A, AAAA, CNAME, MX, TXT, NS, SRV. Use '@' for root domain host. Requires management token.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "The domain to add the record to",
            },
            token: {
              type: "string",
              description: "Management token (starts with 'clwd_')",
            },
            host: {
              type: "string",
              description: "Hostname/subdomain (use '@' for root, 'www' for www subdomain, etc.)",
            },
            type: {
              type: "string",
              enum: ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV"],
              description: "DNS record type",
            },
            answer: {
              type: "string",
              description: "Record value (IP address, hostname, or text content)",
            },
            ttl: {
              type: "number",
              description: "Time to live in seconds (default: 300)",
            },
            priority: {
              type: "number",
              description: "Priority for MX/SRV records",
            },
          },
          required: ["domain", "token", "host", "type", "answer"],
        },
      },
      {
        name: "update_dns_record",
        description:
          "Update an existing DNS record. Get the record_id from list_dns_records. Requires management token.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "The domain containing the record",
            },
            token: {
              type: "string",
              description: "Management token (starts with 'clwd_')",
            },
            record_id: {
              type: "number",
              description: "ID of the record to update (from list_dns_records)",
            },
            host: {
              type: "string",
              description: "New hostname/subdomain (optional)",
            },
            type: {
              type: "string",
              enum: ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV"],
              description: "New record type (optional)",
            },
            answer: {
              type: "string",
              description: "New record value (optional)",
            },
            ttl: {
              type: "number",
              description: "New TTL in seconds (optional)",
            },
            priority: {
              type: "number",
              description: "New priority for MX/SRV records (optional)",
            },
          },
          required: ["domain", "token", "record_id"],
        },
      },
      {
        name: "delete_dns_record",
        description:
          "Delete a DNS record. Get the record_id from list_dns_records. Requires management token.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "The domain containing the record",
            },
            token: {
              type: "string",
              description: "Management token (starts with 'clwd_')",
            },
            record_id: {
              type: "number",
              description: "ID of the record to delete (from list_dns_records)",
            },
          },
          required: ["domain", "token", "record_id"],
        },
      },
      {
        name: "get_nameservers",
        description: "Get the current nameservers for a domain. Requires management token.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "The domain to get nameservers for",
            },
            token: {
              type: "string",
              description: "Management token (starts with 'clwd_')",
            },
          },
          required: ["domain", "token"],
        },
      },
      {
        name: "set_nameservers",
        description:
          "Update nameservers for a domain. Common options: Cloudflare (ns1/ns2.cloudflare.com), Vercel (ns1/ns2.vercel-dns.com), Netlify (dns1/dns2.p01.nsone.net). Requires management token.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "The domain to update",
            },
            token: {
              type: "string",
              description: "Management token (starts with 'clwd_')",
            },
            nameservers: {
              type: "array",
              items: { type: "string" },
              description: "List of nameserver hostnames (e.g., ['ns1.cloudflare.com', 'ns2.cloudflare.com'])",
            },
          },
          required: ["domain", "token", "nameservers"],
        },
      },
      {
        name: "get_settings",
        description:
          "Get domain settings including lock status, auto-renew, and privacy settings. Requires management token.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "The domain to get settings for",
            },
            token: {
              type: "string",
              description: "Management token (starts with 'clwd_')",
            },
          },
          required: ["domain", "token"],
        },
      },
      {
        name: "update_settings",
        description:
          "Update domain settings. Lock prevents unauthorized transfers. Auto-renew automatically renews before expiration. Requires management token.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "The domain to update",
            },
            token: {
              type: "string",
              description: "Management token (starts with 'clwd_')",
            },
            locked: {
              type: "boolean",
              description: "Enable/disable transfer lock (recommended: true)",
            },
            autorenew_enabled: {
              type: "boolean",
              description: "Enable/disable auto-renewal",
            },
          },
          required: ["domain", "token"],
        },
      },
      {
        name: "get_transfer_code",
        description:
          "Get the authorization code needed to transfer a domain to another registrar. Domain must be unlocked first. Note: Cannot transfer within 60 days of registration (ICANN policy). Requires management token.",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "The domain to get transfer code for",
            },
            token: {
              type: "string",
              description: "Management token (starts with 'clwd_')",
            },
          },
          required: ["domain", "token"],
        },
      },
      {
        name: "recover_token",
        description:
          "Recover a lost management token. Provide the email used during Stripe checkout. A new token will be sent to your email. WARNING: This invalidates your old token.",
        inputSchema: {
          type: "object",
          properties: {
            email: {
              type: "string",
              description: "Email address used during Stripe checkout",
            },
            domain: {
              type: "string",
              description: "Specific domain to recover (optional - omit to recover all domains)",
            },
          },
          required: ["email"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "lookup_domain": {
        const { domain } = args as { domain: string };
        if (!domain) throw new Error("Domain is required");
        const result = await lookupDomain(domain);
        return { content: [{ type: "text", text: formatLookupResult(result) }] };
      }

      case "get_quote": {
        const { domain } = args as { domain: string };
        if (!domain) throw new Error("Domain is required");
        const result = await getQuote(domain);
        return { content: [{ type: "text", text: formatQuoteResult(result) }] };
      }

      case "purchase_domain": {
        const { domain } = args as { domain: string };
        if (!domain) throw new Error("Domain is required");
        const result = await purchaseDomain(domain);
        return { content: [{ type: "text", text: formatPurchaseResult(result) }] };
      }

      case "get_domain_info": {
        const { domain, token } = args as { domain: string; token: string };
        if (!domain || !token) throw new Error("Domain and token are required");
        const result = await getDomainInfo(domain, token);
        return { content: [{ type: "text", text: formatDomainInfo(result) }] };
      }

      case "list_dns_records": {
        const { domain, token } = args as { domain: string; token: string };
        if (!domain || !token) throw new Error("Domain and token are required");
        const result = await listDnsRecords(domain, token);
        return { content: [{ type: "text", text: formatDnsRecords(result) }] };
      }

      case "add_dns_record": {
        const { domain, token, host, type, answer, ttl, priority } = args as {
          domain: string;
          token: string;
          host: string;
          type: string;
          answer: string;
          ttl?: number;
          priority?: number;
        };
        if (!domain || !token || !host || !type || !answer) {
          throw new Error("Domain, token, host, type, and answer are required");
        }
        const result = await addDnsRecord(domain, token, { host, type, answer, ttl, priority });
        return { content: [{ type: "text", text: formatDnsRecord(result) }] };
      }

      case "update_dns_record": {
        const { domain, token, record_id, host, type, answer, ttl, priority } = args as {
          domain: string;
          token: string;
          record_id: number;
          host?: string;
          type?: string;
          answer?: string;
          ttl?: number;
          priority?: number;
        };
        if (!domain || !token || !record_id) {
          throw new Error("Domain, token, and record_id are required");
        }
        const updates: Record<string, unknown> = {};
        if (host !== undefined) updates.host = host;
        if (type !== undefined) updates.type = type;
        if (answer !== undefined) updates.answer = answer;
        if (ttl !== undefined) updates.ttl = ttl;
        if (priority !== undefined) updates.priority = priority;
        const result = await updateDnsRecord(domain, token, record_id, updates);
        return { content: [{ type: "text", text: formatDnsRecord(result) }] };
      }

      case "delete_dns_record": {
        const { domain, token, record_id } = args as {
          domain: string;
          token: string;
          record_id: number;
        };
        if (!domain || !token || !record_id) {
          throw new Error("Domain, token, and record_id are required");
        }
        await deleteDnsRecord(domain, token, record_id);
        return { content: [{ type: "text", text: `DNS record ${record_id} deleted successfully.` }] };
      }

      case "get_nameservers": {
        const { domain, token } = args as { domain: string; token: string };
        if (!domain || !token) throw new Error("Domain and token are required");
        const result = await getNameservers(domain, token);
        return { content: [{ type: "text", text: formatNameservers(result) }] };
      }

      case "set_nameservers": {
        const { domain, token, nameservers } = args as {
          domain: string;
          token: string;
          nameservers: string[];
        };
        if (!domain || !token || !nameservers?.length) {
          throw new Error("Domain, token, and nameservers are required");
        }
        const result = await setNameservers(domain, token, nameservers);
        return {
          content: [{ type: "text", text: `Nameservers updated!\n\n${formatNameservers(result)}` }],
        };
      }

      case "get_settings": {
        const { domain, token } = args as { domain: string; token: string };
        if (!domain || !token) throw new Error("Domain and token are required");
        const result = await getSettings(domain, token);
        return { content: [{ type: "text", text: formatSettings(result) }] };
      }

      case "update_settings": {
        const { domain, token, locked, autorenew_enabled } = args as {
          domain: string;
          token: string;
          locked?: boolean;
          autorenew_enabled?: boolean;
        };
        if (!domain || !token) throw new Error("Domain and token are required");
        const settings: { locked?: boolean; autorenewEnabled?: boolean } = {};
        if (locked !== undefined) settings.locked = locked;
        if (autorenew_enabled !== undefined) settings.autorenewEnabled = autorenew_enabled;
        const result = await updateSettings(domain, token, settings);
        return {
          content: [{ type: "text", text: `Settings updated!\n\n${formatSettings(result)}` }],
        };
      }

      case "get_transfer_code": {
        const { domain, token } = args as { domain: string; token: string };
        if (!domain || !token) throw new Error("Domain and token are required");
        const result = await getTransferCode(domain, token);
        return { content: [{ type: "text", text: formatTransfer(result) }] };
      }

      case "recover_token": {
        const { email, domain } = args as {
          email: string;
          domain?: string;
        };
        if (!email) {
          throw new Error("Email address is required");
        }
        const result = await recoverToken(email, domain);
        return {
          content: [
            {
              type: "text",
              text: `${result.message}\n\nNote: If a new token is generated, your old token will be invalidated.`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ClawDaddy MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
