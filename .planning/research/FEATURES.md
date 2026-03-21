# Feature Landscape: IP & DNS Lookup Tool

**Domain:** IP geolocation, DNS resolution, WHOIS/RDAP, reverse DNS
**Researched:** 2026-03-21
**Confidence note:** Based on training knowledge (cutoff Aug 2025). WebSearch/WebFetch unavailable in this environment. All API schemas should be verified against live documentation before implementation. Mark: MEDIUM confidence overall — APIs documented here are stable and widely used but rate limits and exact field availability should be re-verified.

---

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| IP geolocation lookup | Core use case for every IP tool | Low | ip-api.com free tier covers it |
| DNS record lookup (A, AAAA, MX, TXT, NS) | Developers debug DNS constantly | Low | Google DoH handles this without server-side DNS lib |
| WHOIS / RDAP for domains | Who owns this domain? | Medium | RDAP (IANA) is structured JSON; WHOIS is text |
| Reverse DNS (PTR) | Map IP back to hostname | Low | DoH PTR query on in-addr.arpa / ip6.arpa |
| Copy-to-clipboard on all values | Power user workflow | Low | UI pattern |
| Input detection (IP vs domain) | Single search box UX | Low | Regex classify before routing to API |
| Mobile-responsive layout | General web expectation | Low | — |
| Clear error states | Invalid IP, NXDOMAIN, rate-limit | Low | Must show human-readable messages |

## Differentiators

Features that set the product apart from basic lookup pages.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Proxy / VPN / Tor detection flag | Security researchers, fraud teams | Medium | ip-api.com pro field; free shows `proxy` boolean |
| Map pin for geolocation (lat/lon) | Instant visual context | Low | Leaflet.js or Mapbox GL — lat/lon from ip-api |
| CNAME chain visualizer | Debug CDN / redirect chains | Medium | Recursive CNAME resolution via DoH |
| NS + SOA together for zone info | Full zone authority view | Low | Two DoH calls combined in one panel |
| All DNS records in one click | vs tools that make you pick type | Low | Parallel DoH queries for A/AAAA/MX/TXT/NS/CNAME/SOA |
| Lookup history (localStorage) | Saves re-typing | Low | No backend needed |
| Dark mode | Developer audience expectation | Low | CSS custom properties |
| Shareable URL (query param) | Link to a result | Low | `?q=8.8.8.8` pattern |
| IPv4 vs IPv6 handling | Many tools break on IPv6 | Low | ip-api supports both; DoH handles AAAA natively |
| ASN / BGP info panel | Network engineers value this | Low | ip-api returns `as` field (e.g. "AS15169 Google LLC") |

## Anti-Features

Features to explicitly NOT build (scope control and quality focus).

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Bulk CSV IP lookup | Server-side rate-limit risk; adds auth complexity | Out of scope for v1; note as future feature |
| WHOIS raw text parsing for all TLDs | TLD WHOIS format is wildly inconsistent | Use RDAP (structured JSON) as primary; show raw WHOIS as fallback |
| DNS propagation checker (multi-region) | Requires server infrastructure per region | Out of scope; link to whatsmydns.net instead |
| Real-time traceroute / ping | Requires privileged OS access; not browser-doable | Out of scope |
| SSL/TLS certificate inspector | Separate domain entirely | Out of scope |
| Paid/pro feature gating | Adds auth complexity | Use free tiers only; document upgrade path in docs |

---

## 1. IP Geolocation — Data Fields That Matter

### Source: ip-api.com (free JSON endpoint)

**Endpoint:** `http://ip-api.com/json/{query}`

- `{query}` can be: IPv4, IPv6, or domain name (ip-api resolves it)
- Free tier: HTTP only (HTTPS requires pro). Rate limit: **45 requests/minute** per IP.
- Pro tier: HTTPS, higher limits, extra fields (mobile, proxy, hosting).

**Free tier response fields:**

```json
{
  "status": "success",
  "country": "United States",
  "countryCode": "US",
  "region": "CA",
  "regionName": "California",
  "city": "Mountain View",
  "zip": "94043",
  "lat": 37.4192,
  "lon": -122.0574,
  "timezone": "America/Los_Angeles",
  "isp": "Google LLC",
  "org": "Google Public DNS",
  "as": "AS15169 Google LLC",
  "query": "8.8.8.8"
}
```

**Field meanings and UX importance:**

| Field | What It Is | UX Importance |
|-------|-----------|---------------|
| `country` / `countryCode` | ISO 3166-1 country | Show flag emoji + country name |
| `region` / `regionName` | State/province | Secondary detail |
| `city` | City-level resolution | Often imprecise — show with caveat |
| `zip` | Postal code | Low priority, often wrong |
| `lat` / `lon` | Coordinates for map pin | Use for Leaflet/Mapbox marker |
| `timezone` | IANA timezone string (e.g. "America/New_York") | Useful for dev debugging |
| `isp` | Internet Service Provider name | Visible in primary card |
| `org` | Organization using the IP block | Often more specific than ISP |
| `as` | ASN + org name string (e.g. "AS15169 Google LLC") | Parse with regex: `^(AS\d+)\s+(.+)$` |
| `status` | "success" or "fail" | Check before rendering |

**Requesting specific fields (saves bandwidth):**

`http://ip-api.com/json/8.8.8.8?fields=status,country,countryCode,city,lat,lon,timezone,isp,org,as`

The `fields` query param accepts a comma-separated list OR a bitmask integer.

**Batch endpoint (POST, up to 100 IPs):**

`POST http://ip-api.com/batch`

Body: JSON array of objects: `[{"query": "8.8.8.8", "fields": "country,city,as"}]`

Rate limit for batch: 15 requests/minute on free tier.

**Pro-only fields (for reference — do not build against without key):**

| Field | What It Is |
|-------|-----------|
| `proxy` | Boolean — detected as proxy/VPN |
| `hosting` | Boolean — datacenter/hosting IP |
| `mobile` | Boolean — mobile network |

**Error response:**

```json
{
  "status": "fail",
  "message": "invalid query",
  "query": "notanip"
}
```

Possible `message` values: `"private range"`, `"reserved range"`, `"invalid query"`.

**Private/reserved IPs:** ip-api returns `status: "fail"` with `"private range"` for RFC 1918 addresses (10.x, 172.16-31.x, 192.168.x). The UI should handle this gracefully with a human-readable "This is a private/local IP address" message.

---

## 2. DNS Record Types — What to Support

### DNS over HTTPS (DoH) — Google Public DNS

**Base URL:** `https://dns.google/resolve`

**Query format:**

`GET https://dns.google/resolve?name={name}&type={type}`

Optional params:
- `cd=1` — disable DNSSEC validation (useful for debugging)
- `do=1` — include DNSSEC data in response
- `ct=application/x-javascript` — force JSON (usually not needed)

**No authentication. No rate limit published** (Google does not publish one, but it is a public resolver — reasonable use is fine).

**Response format:**

```json
{
  "Status": 0,
  "TC": false,
  "RD": true,
  "RA": true,
  "AD": false,
  "CD": false,
  "Question": [
    { "name": "google.com.", "type": 1 }
  ],
  "Answer": [
    {
      "name": "google.com.",
      "type": 1,
      "TTL": 299,
      "data": "142.250.80.46"
    }
  ]
}
```

**`Status` codes:** 0 = NOERROR, 2 = SERVFAIL, 3 = NXDOMAIN (domain does not exist), 5 = REFUSED.

**`Answer` vs `Authority`:** When a record exists, it appears in `Answer`. When the domain exists but the requested type doesn't, `Authority` contains the SOA. When the domain doesn't exist at all, `Status` is 3 and there may be an `Authority` with an SOA from the parent zone.

### DNS Record Types and Their Meanings

| Type | Type Number | `data` Format | Purpose | UX Note |
|------|-------------|---------------|---------|---------|
| A | 1 | IPv4 address (e.g. `"142.250.80.46"`) | Primary IPv4 resolution | Most common lookup |
| AAAA | 28 | IPv6 address (e.g. `"2607:f8b0:4004:c07::71"`) | IPv6 resolution | Show alongside A |
| MX | 15 | `"{priority} {hostname}."` (e.g. `"10 mail.example.com."`) | Mail server routing | Parse priority out |
| TXT | 16 | Quoted string (e.g. `"v=spf1 include:_spf.google.com ~all"`) | SPF, DKIM, DMARC, verification tokens | Highlight SPF/DKIM/DMARC |
| NS | 2 | Nameserver hostname (e.g. `"ns1.google.com."`) | Authoritative nameservers | Show as list |
| CNAME | 5 | Target hostname (e.g. `"ghs.google.com."`) | Canonical name / alias | Show chain if CNAME points to CNAME |
| SOA | 6 | `"{mname} {rname} {serial} {refresh} {retry} {expire} {minimum}"` | Zone authority record | Parse each field separately |
| PTR | 12 | Hostname (e.g. `"dns.google."`) | Reverse DNS | Requires in-addr.arpa query format |
| CAA | 257 | `"{flags} {tag} {value}"` (e.g. `"0 issue letsencrypt.org"`) | Certificate authority authorization | Security-conscious users |
| SRV | 33 | `"{priority} {weight} {port} {target}"` | Service discovery (e.g. SIP, XMPP) | Advanced users |

### SOA Record Parsing

SOA `data` field example: `"ns1.google.com. dns-admin.google.com. 534588745 900 900 1800 60"`

| Sub-field | Example Value | Meaning |
|-----------|---------------|---------|
| MNAME | `ns1.google.com.` | Primary nameserver |
| RNAME | `dns-admin.google.com.` | Admin email (dots = @, first dot is @) |
| Serial | `534588745` | Zone version number |
| Refresh | `900` | Seconds before secondary checks for updates |
| Retry | `900` | Seconds before retry on failed refresh |
| Expire | `1800` | Seconds until secondary considers zone invalid |
| Minimum TTL | `60` | Negative caching TTL |

### MX Record Parsing

MX `data` field: `"10 aspmx.l.google.com."`

Split on first space: priority = `10`, hostname = `aspmx.l.google.com.`

Multiple MX records are ordered by priority (lower = higher priority). Show sorted.

### PTR (Reverse DNS) Query Construction

**For IPv4:** Reverse the octets and append `.in-addr.arpa.`

Example: `8.8.8.8` → `8.8.8.8.in-addr.arpa`

Query: `GET https://dns.google/resolve?name=8.8.8.8.in-addr.arpa&type=PTR`

**For IPv6:** Reverse each nibble (hex digit) and append `.ip6.arpa.`

Example: `2001:4860:4860::8888`
1. Expand to full form: `2001:4860:4860:0000:0000:0000:0000:8888`
2. Remove colons: `20014860486000000000000000008888`
3. Reverse each character: `88880000000000000684086410002`... (do all 32 nibbles)
4. Insert dots between each nibble
5. Append `.ip6.arpa`

The UI should do this transformation automatically when the user enters an IP.

### Alternative DoH: Cloudflare

**Base URL:** `https://cloudflare-dns.com/dns-query`

Query format is identical to Google DoH. Use `Accept: application/dns-json` header.

Google DoH is preferred as primary because it has broader community familiarity, but Cloudflare is a solid fallback.

---

## 3. WHOIS / RDAP Data Structure

### Why RDAP over WHOIS

WHOIS (port 43 protocol) returns unstructured plaintext. Each TLD registry formats it differently. Parsing it reliably requires TLD-specific regex — a maintenance nightmare.

RDAP (Registration Data Access Protocol) returns **structured JSON** and is now the ICANN-mandated standard. All major registries support it.

### RDAP — IANA Bootstrap

**Bootstrap service:** `https://data.iana.org/rdap/dns.json`

This file maps TLDs to their RDAP base URLs. For production, cache this and refresh periodically (or use the IANA lookup service directly).

**Simpler approach — IANA redirect service:**

`GET https://rdap.org/domain/{domain}`

`rdap.org` is a public bootstrap resolver maintained by the IANA community. It internally performs the TLD lookup and proxies to the correct registry. Use this for simplicity.

**Domain query:**

`GET https://rdap.org/domain/google.com`

**IP query:**

`GET https://rdap.org/ip/8.8.8.8`

### RDAP Domain Response (key fields)

```json
{
  "objectClassName": "domain",
  "ldhName": "GOOGLE.COM",
  "unicodeName": "google.com",
  "handle": "2138514_DOMAIN_COM-VRSN",
  "status": ["client delete prohibited", "client transfer prohibited"],
  "events": [
    { "eventAction": "registration", "eventDate": "1997-09-15T04:00:00Z" },
    { "eventAction": "expiration",   "eventDate": "2028-09-14T04:00:00Z" },
    { "eventAction": "last changed", "eventDate": "2024-09-10T16:57:47Z" }
  ],
  "nameservers": [
    { "ldhName": "NS1.GOOGLE.COM" },
    { "ldhName": "NS2.GOOGLE.COM" }
  ],
  "entities": [
    {
      "roles": ["registrar"],
      "vcardArray": ["vcard", [
        ["fn", {}, "text", "MarkMonitor Inc."]
      ]]
    },
    {
      "roles": ["registrant"],
      "vcardArray": ["vcard", [
        ["fn", {}, "text", "Google LLC"],
        ["org", {}, "text", "Google LLC"]
      ]]
    }
  ],
  "secureDNS": {
    "delegationSigned": true
  },
  "links": [
    { "rel": "self", "href": "https://rdap.verisign.com/com/v1/domain/GOOGLE.COM" }
  ]
}
```

**Fields reliably available across registries:**

| Field path | Reliability | Notes |
|------------|-------------|-------|
| `ldhName` | HIGH | Domain in LDH form |
| `events[registration].eventDate` | HIGH | Creation date |
| `events[expiration].eventDate` | HIGH | Expiry date |
| `events[last changed].eventDate` | MEDIUM | Not all registries include |
| `status[]` | HIGH | EPP status codes (list) |
| `nameservers[].ldhName` | HIGH | NS hostnames |
| `entities[registrar].vcardArray` | HIGH | Registrar name |
| `entities[registrant]` | LOW | Often privacy-redacted |
| `secureDNS.delegationSigned` | MEDIUM | DNSSEC status |

**Fields often missing or redacted:**

- Registrant contact (email, phone, address) — GDPR/privacy redaction is universal for gTLDs
- Admin/tech contacts — same
- Registrar IANA ID — present for gTLDs, inconsistent for ccTLDs

### EPP Status Codes (what to show users)

| Status | Plain English |
|--------|--------------|
| `ok` | Active, no restrictions |
| `clientTransferProhibited` | Transfer locked (normal for most domains) |
| `clientDeleteProhibited` | Delete locked |
| `clientUpdateProhibited` | Update locked |
| `serverTransferProhibited` | Registry-level transfer lock |
| `pendingTransfer` | Transfer in progress |
| `pendingDelete` | Being deleted (redemption period) |
| `redemptionPeriod` | About to expire, owner can redeem |

### RDAP IP Response (key fields)

`GET https://rdap.org/ip/8.8.8.8`

```json
{
  "objectClassName": "ip network",
  "handle": "8.8.8.0 - 8.8.8.255",
  "startAddress": "8.8.8.0",
  "endAddress": "8.8.8.255",
  "ipVersion": "v4",
  "name": "GOGL",
  "type": "ALLOCATED",
  "country": "US",
  "entities": [
    {
      "roles": ["registrant"],
      "vcardArray": ["vcard", [
        ["fn", {}, "text", "Google LLC"],
        ["adr", { "label": "1600 Amphitheatre Parkway\nMountain View\nCA 94043\nUnited States" }, "text", ""]
      ]],
      "entities": [
        { "roles": ["abuse"], "vcardArray": ["vcard", [
          ["fn", {}, "text", "Abuse"],
          ["email", {}, "text", "network-abuse@google.com"]
        ]]}
      ]
    }
  ],
  "events": [
    { "eventAction": "registration", "eventDate": "2014-03-14T00:00:00Z" },
    { "eventAction": "last changed",  "eventDate": "2014-12-16T00:00:00Z" }
  ],
  "links": [
    { "rel": "self", "href": "https://rdap.arin.net/registry/ip/8.8.8.0/24" }
  ],
  "cidr0_cidrs": [{ "v4prefix": "8.8.8.0", "length": 24 }]
}
```

---

## 4. Reverse DNS (PTR) — How It Works

PTR records live in special reverse-lookup DNS zones:
- IPv4: `in-addr.arpa`
- IPv6: `ip6.arpa`

The IP address is reversed and appended to the zone to form the query name. The DNS resolver then looks up this name as a PTR record.

**UI flow:**
1. User enters `8.8.8.8`
2. UI constructs `8.8.8.8.in-addr.arpa`
3. Query: `GET https://dns.google/resolve?name=8.8.8.8.in-addr.arpa&type=PTR`
4. Response `Answer[0].data` = `"dns.google."`
5. Display: "Reverse DNS: dns.google"

**What to expect in practice:**

| Scenario | What You Get |
|----------|-------------|
| ISP consumer IP | Generic hostname like `c-73-191-xxx.hsd1.ca.comcast.net` |
| Cloud provider IP | Meaningful hostname like `ec2-54-x.compute-1.amazonaws.com` |
| Google DNS | `dns.google` |
| No PTR record | `Status: 3` (NXDOMAIN) — show "No reverse DNS found" |
| Multiple PTR records | Rare but valid — show all |

**PTR ≠ forward-confirmed reverse DNS:** A PTR record saying "foo.example.com" does not prove the IP is legitimate for that domain. Security tools do a forward-confirmed rDNS check (FCrDNS): look up PTR → then A-record the result and check it matches. Include this as a future differentiator.

---

## 5. Free API Reference

### ip-api.com

| Property | Value |
|----------|-------|
| Base URL | `http://ip-api.com/json/` (HTTP only on free) |
| Auth | None (free tier) |
| Rate limit | 45 requests/minute per client IP |
| Rate limit headers | `X-Rl` (remaining), `X-Ttl` (seconds until reset) |
| Batch endpoint | `POST http://ip-api.com/batch` (up to 100 IPs, 15 req/min) |
| Lookup own IP | `GET http://ip-api.com/json/` (no query = caller's IP) |
| HTTPS | Pro only (paid) |
| CORS | Yes — browser requests work directly |

**Rate limit response (HTTP 429):**

```json
{
  "status": "fail",
  "message": "you have been rate limited"
}
```

**Recommended fields param for standard lookup:**

```
fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query
```

---

### Google DNS over HTTPS (DoH)

| Property | Value |
|----------|-------|
| Base URL | `https://dns.google/resolve` |
| Auth | None |
| Rate limit | Not published; public resolver — reasonable use only |
| CORS | Yes — browser requests work directly |
| Protocol | HTTPS only |
| Accept header | `application/x-javascript` or omit (returns JSON by default) |

**Minimal query:**

`GET https://dns.google/resolve?name=google.com&type=A`

**RCODE meanings:**

| RCODE | Status code | Meaning |
|-------|-------------|---------|
| 0 | NOERROR | Query successful |
| 1 | FORMERR | Format error |
| 2 | SERVFAIL | Server failure |
| 3 | NXDOMAIN | Non-existent domain |
| 4 | NOTIMP | Not implemented |
| 5 | REFUSED | Query refused |

**When `Answer` is absent:** The query succeeded at the resolver level but the record type doesn't exist for that name. Check `Authority` for SOA (zone exists) vs. `Status: 3` (zone doesn't exist).

---

### RDAP (via rdap.org bootstrap)

| Property | Value |
|----------|-------|
| Domain lookup | `GET https://rdap.org/domain/{domain}` |
| IP lookup | `GET https://rdap.org/ip/{ip}` |
| ASN lookup | `GET https://rdap.org/autnum/{asn}` |
| Auth | None |
| Rate limit | Not published; be polite (cache responses) |
| CORS | Varies by registry; rdap.org proxies handle it |
| Response format | `application/rdap+json` (treat as JSON) |

**Direct registry endpoints (more reliable, no proxy):**

| Registry | RDAP base URL | Covers |
|----------|---------------|--------|
| ARIN (North America) | `https://rdap.arin.net/registry/` | IPv4/IPv6/ASN in ARIN region |
| RIPE (Europe) | `https://rdap.db.ripe.net/` | IPv4/IPv6/ASN in RIPE region |
| APNIC (Asia-Pacific) | `https://rdap.apnic.net/` | IPv4/IPv6/ASN in APNIC region |
| Verisign (.com/.net) | `https://rdap.verisign.com/com/v1/` | .com/.net domains |
| IANA | `https://rdap.iana.org/` | TLD registry data |

For v1, use `rdap.org` as the single bootstrap — it handles routing automatically.

---

## 6. UX Patterns — What Makes a Good IP/DNS Lookup Tool

### Input & Search

- **Single unified search box.** Detect input type before routing:
  - IPv4: `/^(\d{1,3}\.){3}\d{1,3}$/`
  - IPv6: contains `:` — use a proper IPv6 regex or `new URL()` trick
  - Domain: everything else that looks like a hostname
  - Plain hostname: resolve first, then look up the IP
- **"My IP" button** to auto-fill the visitor's own IP (call ip-api with no query param).
- **Search history** in localStorage — last 10 queries, clickable.
- **URL state** — `?q=8.8.8.8` so results are bookmarkable and shareable.
- **Enter or button to submit** — don't search on every keystroke (debounce or require submit).

### Results Layout

- **Above-the-fold IP card** for geolocation: flag, country, city, ISP, ASN — the headline info.
- **Tabbed or accordion sections** for DNS, WHOIS, PTR — avoids information overload.
- **Copy icon on every value** — single click, feedback ("Copied!").
- **TTL countdown** — show DNS TTL with time remaining before record expires.
- **Loading skeletons** per section — DNS and RDAP queries run in parallel; show each section as it resolves.
- **Map panel** — small embedded map (Leaflet.js, free) with a pin at lat/lon, clearly labeled "approximate location."

### DNS Lookup Panel

- **Default to showing all common record types** in parallel (A, AAAA, MX, TXT, NS, CNAME, SOA) — one query each.
- **Expandable raw JSON** for power users.
- **TXT record parsing** — detect and label SPF (`v=spf1`), DKIM (`v=DKIM1`), DMARC (`v=DMARC1`), Google verification (`google-site-verification`).
- **MX priority sort** — display lowest priority (highest preference) first.

### WHOIS / RDAP Panel

- **Show registration, expiration, last updated** dates prominently.
- **Days until expiry** calculated from `expiration` event — warn if under 30 days.
- **EPP status plain-English** translation next to each status code.
- **Registrar name and link** (RDAP includes a link to the registrar's RDAP).
- **DNSSEC indicator** — signed / unsigned badge.

### Error Handling

| Error condition | User-facing message |
|-----------------|-------------------|
| NXDOMAIN (Status 3) | "Domain does not exist in DNS" |
| Private IP | "This is a private/internal IP address (RFC 1918)" |
| Reserved IP | "This IP address is reserved and not publicly routed" |
| ip-api rate limit | "Too many requests — please wait a moment" |
| RDAP 404 | "Registration data not found for this domain/IP" |
| Network error | "Could not reach lookup service — check your connection" |
| Invalid input | "Enter a valid IPv4, IPv6 address, or domain name" |

### Performance Patterns

- **Parallel requests** — fire ip-api, DoH (multiple record types), and RDAP simultaneously, not sequentially. Use `Promise.all` / `Promise.allSettled`.
- **`Promise.allSettled` not `Promise.all`** — one failed API should not block the rest from rendering.
- **Client-side only** for v1 — no backend needed. All three APIs support CORS from browsers.
- **Cache results in memory** for the session — if the user re-looks up the same query, return cached data.
- **Abort previous requests** when a new query is submitted (use `AbortController`).

---

## Feature Dependencies

```
IP Geolocation (ip-api) → Map Pin (lat/lon required)
IP Geolocation (ip-api) → ASN Panel (parse `as` field)
DNS A Record → Reverse DNS PTR (need IP to construct in-addr.arpa)
DNS CNAME → CNAME Chain (resolve recursively)
DNS NS Records → Zone Info (show alongside SOA)
Input Detection → Route to correct API
RDAP Domain → Expiry Warning (needs expiration date)
```

---

## MVP Recommendation

**Prioritize:**
1. IP geolocation card (ip-api.com) — the core value proposition
2. DNS multi-record lookup (A, AAAA, MX, TXT, NS) via Google DoH
3. PTR / reverse DNS from any IP result
4. RDAP domain lookup (registration, expiry, nameservers, registrar)
5. Shareable URL via query param
6. Copy-to-clipboard on all values

**Defer to v2:**
- Map/geolocation pin — requires integrating a map library (leaflet adds ~40KB)
- CNAME chain visualizer
- DNSSEC validation status deep-dive
- Proxy/VPN detection (requires ip-api pro)
- CAA / SRV record types
- ASN/autnum RDAP lookup

---

## Sources

**Note:** WebSearch and WebFetch were unavailable during this research session. The following are the canonical documentation URLs to verify all claims:

- ip-api.com documentation: `https://ip-api.com/docs/api:json`
- ip-api.com field list: `https://ip-api.com/docs/api:json#fieldsTable`
- Google DoH documentation: `https://developers.google.com/speed/public-dns/docs/doh/json`
- Cloudflare DoH: `https://developers.cloudflare.com/1.1.1.1/dns-over-https/json-format/`
- RDAP specification: RFC 9083 (https://www.rfc-editor.org/rfc/rfc9083)
- RDAP bootstrap (IANA): `https://www.iana.org/assignments/rdap-dns/rdap-dns.xhtml`
- rdap.org public bootstrap: `https://rdap.org`
- ARIN RDAP: `https://rdap.arin.net/registry/`
- DNS record type numbers: RFC 1035 + IANA registry `https://www.iana.org/assignments/dns-parameters/`
- EPP status codes: RFC 5731 (domain), RFC 5732 (host)
- in-addr.arpa specification: RFC 1035 Section 3.5
- ip6.arpa specification: RFC 3596

**Confidence:** MEDIUM — these APIs have been stable for 5+ years and the schemas described here match their documented behavior as of training cutoff (Aug 2025). Rate limits and minor field changes should be re-verified before building.
