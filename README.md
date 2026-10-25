# EntroGuard Family

**Privacy-first parental controls with a shared Rust core.**

EntroGuard Family is a cross-platform parental-control platform that lets parents and guardians manage children's internet access, website filtering, screen time, and supported app restrictions from a centralized dashboard. It is built around a platform-independent Rust policy engine, a Tauri-based interface, and native Android and Apple integrations that enforce only what each operating system permits.

> **Status:** Early development. The shared policy engine and the parent dashboard are implemented. The backend and native child applications are in progress. No feature is advertised as supported until it has been validated on real devices.

---

## Table of Contents

- [Highlights](#highlights)
- [Architecture](#architecture)
- [Repository Layout](#repository-layout)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Development](#development)
- [Policy Model](#policy-model)
- [Testing](#testing)
- [Security & Privacy](#security--privacy)
- [Roadmap](#roadmap)
- [Documentation](#documentation)

---

## Highlights

| Area | Capability |
|---|---|
| Parent dashboard | Family overview, device enrollment, policy editors, access-request approvals, audit logs |
| Website filtering | Exact-domain and subdomain rules, allowlists, blocklists, content categories, temporary exceptions |
| Screen time | Daily budgets, bedtime schedules, allowed windows, weekday/weekend variants, IANA timezone awareness |
| App restrictions | Capability-driven rules that are only reported as enforced where the platform supports them |
| Privacy | No covert monitoring, no message-content collection, no full browsing history by default, minimal redacted logs |
| Security | Argon2id planned for the backend, short-lived tokens, one-time pairing codes, strict policy validation, restrictive CSP |

The child application always discloses active filtering, requested permissions, and device-management restrictions. Push notifications are treated as synchronization hints, never as trusted policy documents.

## Architecture

```
              PARENT APPLICATIONS
          Desktop / Android / iOS
              Tauri 2 + React
                     |
                     | HTTPS REST API
                     v
             RUST BACKEND API
                   Axum
                     |
          +----------+-----------+
          |                      |
          v                      v
      PostgreSQL           Push Services
          |                  FCM / APNs
          v
       Policy Store
          |
          | Authenticated policy synchronization
          v
          CHILD APPLICATIONS
             Android / iOS
                  |
          +-------+--------+
          |                |
          v                v
    Shared Rust Core   Native Adapters
                       Kotlin / Swift
                            |
                   +--------+---------+
                   |                  |
                   v                  v
             Website Filtering   App/Schedule Controls
```

### Architectural principles

1. The backend is the authoritative source of family membership and policy versions.
2. Child applications cache the last valid policy and keep enforcing it when the server is unreachable.
3. Rust implements shared policy logic; native adapters enforce only what the OS permits.
4. Every device reports its actual capabilities, and the dashboard distinguishes configured policies from enforced ones.
5. No platform silently escalates permissions or hides active monitoring.

## Repository Layout

```text
entro-safeguard/
├── apps/
│   ├── parent/                  Tauri 2 + React parent dashboard
│   │   ├── src/
│   │   │   ├── app/             router, store, mock backend, types, validation
│   │   │   ├── components/      layout and shared UI components
│   │   │   ├── features/        authentication, family, devices, website-rules,
│   │   │   │                    screen-time, app-restrictions, reports
│   │   │   └── styles/          global stylesheet
│   │   └── src-tauri/           Tauri shell, capabilities, CSP, icons
│   └── child/                   (upcoming) child application for Android/iOS
│
├── crates/
│   ├── policy-core/             policy evaluation engine, rule precedence, policy cache
│   ├── policy-schema/           policy types, serde schema v1, strict validation
│   ├── domain-normalizer/       IDNA normalization, hostname-boundary matching
│   ├── time-policy/             timezone-aware schedules: bedtime, windows, transitions
│   ├── api-client/              (upcoming) shared REST API client
│   ├── secure-storage/          (upcoming) OS secure storage abstraction
│   └── test-fixtures/           (upcoming) shared test fixtures
│
├── services/
│   └── api/                     (upcoming) Axum + PostgreSQL backend
│
├── docs/                        (upcoming) architecture, platform capabilities, security
├── infra/                       (upcoming) Docker Compose and reverse proxy config
├── spec.md                      full technical specification
└── Cargo.toml                   Rust workspace
```

## Technology Stack

| Layer | Technology |
|---|---|
| Desktop / mobile shell | Tauri 2 |
| Frontend | React, TypeScript, Vite, plain CSS and CSS Modules |
| Shared core | Rust stable, Cargo workspace, serde, chrono, chrono-tz |
| Backend (planned) | Axum, PostgreSQL, SQLx, REST over HTTPS, FCM/APNs |
| Android (planned) | Kotlin, `VpnService`, `UsageStatsManager`, device-policy APIs where eligible |
| iOS (planned) | Swift, `FamilyControls`, `ManagedSettings`, `DeviceActivity` |
| Tooling | pnpm workspaces, cargo, clippy, rustfmt |

## Getting Started

### Prerequisites

- **Rust** 1.85+ (stable toolchain)
- **Node.js** 20.19+ and **pnpm** 12+
- Linux desktop builds additionally require `webkit2gtk-4.1`, `gtk3`, `libsoup3`, and `javascriptcoregtk-4.1`

### Install and run

```bash
# Install frontend dependencies
pnpm install

# Run the parent dashboard as a desktop app
pnpm parent:dev

# Or run it in a plain browser (vite only, no Tauri shell)
pnpm parent:web
```

The dashboard currently runs against a mock backend persisted in `localStorage` (`apps/parent/src/app/backend.ts`). Its interfaces mirror the planned `/v1` REST API and the `policy-schema` v1 JSON, so it can be swapped for a real API client without reworking the UI.

## Development

```bash
# Rust workspace
cargo build --workspace
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all

# Parent dashboard
pnpm parent:build   # typecheck + production build + bundle
```

## Policy Model

Policies are versioned JSON documents (schema v1) with an IANA timezone, website rules, screen-time settings, and app rules. Every policy is validated before it is stored or accepted by a device; a device that cannot parse a new policy keeps its previous valid one.

### Website rule precedence

1. Unexpired temporary exception grants (exact or subdomain match)
2. Explicit allowlist (`website.allowed_domains`)
3. Explicit blocklist (`website.blocked_domains`)
4. Content-category block (`website.categories_blocked`)
5. `website.default_action`

Domain matching is boundary-safe: a rule for `example.com` matches `example.com` and `sub.example.com`, but never `notexample.com`.

## Testing

- **Rust unit tests** cover domain normalization, boundary matching, rule precedence, schedule boundaries, timezone behavior, invalid-policy rejection, and exception expiration.
- **Frontend validation** mirrors the Rust schema so invalid policies are rejected before they reach the backend.
- **Backend integration tests**, **Android/iOS platform tests**, and the **end-to-end flow** (enroll, filter, request access, approve, expire, revoke) are planned for later milestones.

## Security & Privacy

- Passwords hashed with Argon2id; pairing tokens stored hashed, single-use, and short-lived.
- Short-lived access tokens with rotating refresh sessions and reuse detection.
- Least-privilege Tauri capabilities and a restrictive Content Security Policy.
- No covert monitoring, keystroke capture, message reading, or unnecessary location collection.
- Minimal, redacted application logs; documented data retention, export, and deletion.
- Child transparency: active controls and permissions are always disclosed in the child app.

See `spec.md` (sections 12 and 13) for the complete requirements.

## Roadmap

| Milestone | Scope | Status |
|---|---|---|
| 0 — Platform feasibility | Native capability validation on Android/iOS | Planned |
| 1 — Shared Rust core | `policy-schema`, `policy-core`, normalization, schedules | Done |
| 2 — Parent dashboard | Tauri 2 + React UI against mock backend | Done |
| 3 — Rust backend | Axum, PostgreSQL, auth, pairing, policy versioning, audit | Planned |
| 4 — Android child app | Enrollment, VPN/safe-browser filtering, local caching | Planned |
| 5 — iOS child app | Family Controls, DeviceActivity, ManagedSettings | Planned |
| 6 — Sync & exceptions | Push hints, version acks, access requests, usage summaries | Planned |
| 7 — Security & production | Threat model, signed builds, store listings, controlled beta | Planned |

## Documentation

- [Technical specification](spec.md) — product goals, architecture, database design, security, milestones
- Platform-specific guidance is referenced from `spec.md` (Tauri 2, Android `VpnService`, Apple Family Controls, OWASP MASVS)
