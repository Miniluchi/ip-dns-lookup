# Pitfalls & Gotchas

## ip-api.com

- **HTTPS requires paid plan** — free tier is HTTP only (`http://ip-api.com/json/{ip}`). For a personal Vercel deployment, call it from a Next.js API route (server-side) so the browser never makes the HTTP call directly.
- **Rate limit**: 45 requests/minute on free tier. For a personal tool this is fine.
- **Fields must be requested explicitly** — use the `fields` query param to get extras: `?fields=status,message,country,regionName,city,zip,lat,lon,timezone,isp,org,as,query`
- **Don't pass private/reserved IPs** — `10.x`, `192.168.x`, `127.x` etc. return `{"status":"fail","message":"private range"}`. Detect and short-circuit client-side.
- **IPv6 supported** — pass IPv6 directly, works the same way.

## dns.google (DoH)

- **CORS: browser-safe** — `dns.google` sets `Access-Control-Allow-Origin: *`, so you CAN call it directly from the browser. However, routing through a Next.js API route is still cleaner (hides implementation, easier to add caching later).
- **Endpoint**: `https://dns.google/resolve?name={domain}&type={type}`
- **NXDOMAIN handling**: Returns `Status: 3` (NXDOMAIN) with no `Answer` array. Always check for `Answer` existence before mapping.
- **No authentication needed**, no rate limit documented for reasonable use.
- **Multiple record types**: Fire separate requests per type (A, AAAA, MX, TXT, NS, CNAME) — there's no "give me all records" endpoint.

## RDAP

- **Bootstrap required** — IANA maintains a bootstrap file at `https://data.iana.org/rdap/dns.json` that maps TLDs to their RDAP server. Cache this or hardcode common TLDs.
- **Not all TLDs support RDAP** — older ccTLDs may not. Always have a fallback message: "WHOIS not available via RDAP for this TLD."
- **IANA RDAP for IPs**: `https://rdap.arin.net/registry/ip/{ip}` (ARIN for AMER), but IANA bootstrap at `https://data.iana.org/rdap/ipv4.json` gives the right server per prefix.
- **Response structure varies** by registrar — `entities`, `events`, `status` arrays may be empty or nested differently. Be defensive when parsing.
- **Rate limits**: Not formally published but be conservative — fine for personal use.

## Input Validation

- **IP detection regex**: `/^(\d{1,3}\.){3}\d{1,3}$/` for IPv4; for IPv6 use a proper library or `/^[0-9a-fA-F:]+$/` as a rough check.
- **Domain validation**: At minimum check for at least one dot and no spaces. Don't over-validate — let the API return an error.
- **Strip protocol prefixes**: Users often paste `https://example.com` — strip `https?://` and trailing paths before querying.

## Vercel Deployment

- **API route timeout**: Default 10s on hobby plan, 60s on pro. DNS + RDAP fetches should be well within 10s for personal use.
- **No persistent server** — API routes are serverless functions. Don't rely on in-memory caching between requests.
- **Environment variables**: Not needed for this project (all free APIs, no keys).

## General

- **Parallel fetching**: Use `Promise.allSettled` (not `Promise.all`) so one failing API doesn't reject the whole lookup.
- **Show "my IP" on load**: Call ip-api.com with no IP parameter to get the user's own IP — good default state for the dashboard.
