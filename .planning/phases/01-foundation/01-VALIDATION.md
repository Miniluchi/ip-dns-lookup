---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (ESM-native, TypeScript-first) |
| **Config file** | `vitest.config.ts` — Wave 0 installs |
| **Quick run command** | `npx vitest run src/lib/detect-input-type.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/detect-input-type.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green + all 4 curl smoke tests passing
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-02-01 | 02 | 1 | FOUND-02 | unit | `npx vitest run src/lib/detect-input-type.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | FOUND-03 | unit | `npx vitest run src/lib/detect-input-type.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-03 | 02 | 1 | FOUND-08 | unit | `npx vitest run src/lib/detect-input-type.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | FOUND-04 | smoke (curl) | manual curl | N/A | ⬜ pending |
| 1-03-02 | 03 | 2 | FOUND-05 | smoke (curl) | manual curl | N/A | ⬜ pending |
| 1-03-03 | 03 | 2 | FOUND-06 | smoke (curl) | manual curl | N/A | ⬜ pending |
| 1-03-04 | 03 | 2 | FOUND-07 | smoke (curl) | manual curl | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/detect-input-type.test.ts` — stubs for FOUND-02, FOUND-03, FOUND-08, and IPv6 PTR construction
- [ ] `vitest.config.ts` — Vitest framework config
- [ ] Install: `npm install -D vitest` — no test framework in new project

*Wave 0 must be complete before any Wave 1 tasks begin.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `curl http://localhost:3000/api/geo?q=8.8.8.8` returns JSON with country, city, ISP, ASN fields | FOUND-04 | Live HTTP call to ip-api.com; no mock in Phase 1 | Run dev server, execute curl, inspect response |
| `curl http://localhost:3000/api/dns?q=example.com` returns A, AAAA, MX, TXT, NS, CNAME arrays | FOUND-05 | Live DNS query via dns.google; no mock in Phase 1 | Run dev server, execute curl, inspect response |
| `curl http://localhost:3000/api/rdns?q=8.8.8.8` returns PTR hostname string | FOUND-06 | Live reverse DNS lookup; no mock in Phase 1 | Run dev server, execute curl, inspect response |
| `curl http://localhost:3000/api/whois?q=example.com` returns registrar, creation date, expiry date | FOUND-07 | Live RDAP query via rdap.org; no mock in Phase 1 | Run dev server, execute curl, inspect response |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
