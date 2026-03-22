---
phase: 3
slug: polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (via next test or vitest directly) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | SRCH-03 | e2e/manual | `npm run build && npm start` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | SRCH-03 | unit | `npm test -- --run` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | SRCH-04 | e2e/manual | `npm run build && npm start` | ✅ | ⬜ pending |
| 03-02-02 | 02 | 2 | UI-02 | unit | `npm test -- --run` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 2 | UI-03 | e2e/manual | browser test | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/url-param.test.ts` — stubs for SRCH-03 (URL param read/write)
- [ ] `src/__tests__/copy-button.test.tsx` — stubs for UI-02 (copy-to-clipboard)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/?q=8.8.8.8` auto-fires lookups on fresh tab load | SRCH-03 | Requires browser navigation + network | Open `/?q=8.8.8.8` in incognito; verify all 4 cards populate |
| Initial load auto-detects visitor IP | SRCH-04 | Requires real public IP detection | Load `/` with no params; verify cards show your public IP |
| Dark/light toggle — no FOUC on page load | UI-03 | Requires visual inspection | Reload page in dark mode; verify no flash of unstyled content |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
