# EntroGuard Family — Technical Specification

**Version:** 1.0.0  
**Status:** Proposed  
**Date:** October 2026  
**Project Type:** Cross-platform Parental Control Software  
**Core Technologies:** Rust, Tauri 2, React, TypeScript  
**Backend:** Rust, Axum, PostgreSQL, SQLx

---

## 1. Project Overview

EntroGuard Family is a privacy-first parental-control platform that allows parents and guardians to manage children's internet access, website filtering, screen time, and supported app restrictions from a centralized dashboard.

The application will support:

- Desktop parent application for Linux, Windows, and macOS.
- Android parent and child applications.
- iOS and iPadOS parent and child applications.
- Centralized policy management and device synchronization.
- Website allowlists, blocklists, and category-based filtering.
- Screen-time limits and bedtime schedules.
- App restrictions where supported by the operating system.
- Privacy-conscious usage summaries and audit logs.

### Primary objective

Build one product with a shared Rust core and reusable Tauri interface while using native Android and Apple APIs for platform-specific controls.

**Important:** Tauri does not automatically provide device-wide parental controls. Android and iOS require separate native integrations, permissions, and, in some cases, special entitlements.

---

## 2. Product Goals

### 2.1 MVP Goals

1. Secure parent authentication.
2. Family creation and child-device enrollment.
3. QR-code or one-time-code device pairing.
4. Website allowlist and blocklist management.
5. Basic adult-content and malicious-domain filtering.
6. Daily screen-time budgets.
7. Bedtime and allowed-use schedules.
8. App restrictions on supported platforms.
9. Remote policy synchronization.
10. Device status and policy application reports.
11. Child-facing protection status.
12. Temporary access requests and guardian approval.
13. Device revocation and account security controls.

### 2.2 Non-Goals

The MVP will not implement:

- Hidden surveillance or covert installation.
- Reading private messages, passwords, keystrokes, or personal photos.
- Secret microphone, camera, or location monitoring.
- Guaranteed blocking of every website or application.
- Unauthorized bypass of Android or Apple security restrictions.
- Arbitrary remote control of a child's device.
- AI-based classification as a requirement for the first release.

---

## 3. Target Platforms

| Platform | Application | Technology |
|---|---|---|
| Linux | Parent dashboard | Tauri 2 + Rust + React |
| Windows | Parent dashboard | Tauri 2 + Rust + React |
| macOS | Parent dashboard | Tauri 2 + Rust + React |
| Android | Parent application | Tauri 2 + native Android integration |
| Android | Child application | Tauri 2 + Kotlin + Rust |
| iOS | Parent application | Tauri 2 + native iOS integration |
| iOS | Child application | Tauri 2 + Swift + Rust |

The initial release should prioritize Android child-device enforcement while developing the shared parent dashboard.

iOS capabilities must be validated through an early native prototype before they are advertised as supported.

---

## 4. Technology Stack

### 4.1 Frontend

- Tauri 2
- React
- TypeScript
- Vite
- Plain CSS and CSS Modules
- Lucide icons, if required

The frontend should remain lightweight and accessible.

### 4.2 Shared Rust Core

- Rust stable
- Cargo workspace
- Serde and Serde JSON
- URL parsing and IDNA domain normalization
- Timezone-aware scheduling
- Shared policy validation
- Structured logging with sensitive-data redaction

The core must not depend on a specific operating system.

### 4.3 Backend

- Rust
- Axum
- PostgreSQL
- SQLx
- REST API
- HTTPS
- Push notifications through FCM and APNs where configured

Redis should be introduced only when measured requirements justify it.

### 4.4 Native Integrations

**Android**
- Kotlin
- Android SDK
- `VpnService` for consent-based network filtering
- `UsageStatsManager` for authorized usage reporting
- Supported device-policy APIs for eligible managed devices

**iOS**
- Swift
- `FamilyControls`
- `ManagedSettings`
- `DeviceActivity`
- Network Extension APIs only where applicable and approved

Required Apple capabilities and distribution entitlements must be verified before implementation.

---

## 5. System Architecture

```text
                  PARENT APPLICATIONS
          Desktop / Android / iOS
              Tauri 2 + React
                     |
                     | HTTPS REST API
                     |
                     v
             RUST BACKEND API
                  Axum
                     |
          +----------+-----------+
          |                      |
          v                      v
      PostgreSQL           Push Services
          |                  FCM / APNs
          |
          v
       Policy Store
          |
          | Authenticated policy synchronization
          |
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
2. The child application caches the last valid policy.
3. Rust implements shared policy logic.
4. Native adapters enforce only the controls permitted by the operating system.
5. Every device reports its supported capabilities.
6. The dashboard must distinguish configured policies from successfully enforced policies.
7. Push notifications are synchronization hints, not trusted policy documents.
8. No platform may silently escalate permissions or hide active monitoring.

---

## 6. Repository Structure

```text
entrouguard-family/
├── apps/
│   ├── parent/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   │   ├── authentication/
│   │   │   │   ├── family/
│   │   │   │   ├── devices/
│   │   │   │   ├── website-rules/
│   │   │   │   ├── screen-time/
│   │   │   │   ├── app-restrictions/
│   │   │   │   └── reports/
│   │   │   └── styles/
│   │   ├── src-tauri/
│   │   └── package.json
│   │
│   └── child/
│       ├── src/
│       ├── src-tauri/
│       ├── android/
│       └── ios/
│
├── crates/
│   ├── policy-core/
│   ├── policy-schema/
│   ├── domain-normalizer/
│   ├── time-policy/
│   ├── api-client/
│   ├── secure-storage/
│   └── test-fixtures/
│
├── services/
│   └── api/
│       ├── src/
│       │   ├── auth/
│       │   ├── families/
│       │   ├── devices/
│       │   ├── policies/
│       │   ├── audit/
│       │   ├── sync/
│       │   └── main.rs
│       ├── migrations/
│       └── Cargo.toml
│
├── docs/
│   ├── architecture.md
│   ├── platform-capabilities.md
│   ├── security.md
│   ├── privacy.md
│   └── release-checklist.md
│
├── infra/
│   ├── docker-compose.yml
│   └── reverse-proxy/
│
├── Cargo.toml
├── pnpm-workspace.yaml
├── package.json
├── .env.example
├── .gitignore
├── README.md
└── spec.md
```

Start with the parent application, API, `policy-core`, and `policy-schema`. Add native child-app integrations incrementally.

---

## 7. Core Features

### 7.1 Parent Dashboard

The parent dashboard should include:

- Family overview.
- Enrolled devices.
- Device connection and synchronization status.
- Website rules.
- Content category controls.
- Daily screen-time settings.
- Bedtime schedules.
- Supported app restrictions.
- Access-request approvals.
- Policy history.
- Audit logs.
- Account security and privacy settings.

### 7.2 Child Application

The child application should provide:

- Clear protection status.
- Active policy summary.
- Website block explanation.
- Screen-time status.
- Permission and setup status.
- Last successful synchronization.
- Request-access functionality.
- Transparent explanation of active VPN or device-management functionality.

### 7.3 Website Filtering

The policy engine should support:

- Exact-domain blocking.
- Subdomain matching.
- Explicit allowlists.
- Explicit blocklists.
- Basic content categories.
- Temporary exceptions.
- Policy expiration.
- Offline policy caching.

Domain matching must use proper hostname boundaries. For example, `notexample.com` must not match a rule for `example.com`.

The MVP should avoid promising full URL-path filtering across all browsers. HTTPS encryption, DNS-over-HTTPS, VPN conflicts, and application-specific networking can limit visibility.

### 7.4 Screen-Time Controls

Policies should support:

- Daily usage budgets.
- Bedtime start and end times.
- Allowed usage windows.
- Different schedules for weekdays and weekends.
- Temporary guardian-approved extensions.
- Local enforcement where the platform permits it.
- Usage summaries with minimal data retention.

### 7.5 App Restrictions

App restrictions must be capability-driven.

Android:
- Usage reporting may require Usage Access authorization.
- Reliable suspension of other apps may require device-owner provisioning or supported device-policy APIs.
- A standard consumer app cannot arbitrarily block every installed app.

iOS:
- App/category restrictions depend on Apple's Screen Time frameworks, authorization, entitlements, and supported OS versions.
- The app must clearly report unavailable capabilities.

Unsupported restrictions must never be displayed as successfully enforced.

---

## 8. Database Design

### `users`

- `id`
- `email`
- `password_hash`
- `email_verified_at`
- `created_at`
- `updated_at`

### `families`

- `id`
- `name`
- `owner_user_id`
- `created_at`

### `family_members`

- `id`
- `family_id`
- `user_id`
- `role`
- `created_at`

### `devices`

- `id`
- `family_id`
- `display_name`
- `platform`
- `os_version`
- `app_version`
- `capabilities_json`
- `enrollment_status`
- `last_seen_at`
- `created_at`
- `revoked_at`

### `pairing_tokens`

- `id`
- `family_id`
- `token_hash`
- `expires_at`
- `used_at`
- `attempt_count`
- `created_at`

### `policies`

- `id`
- `family_id`
- `version`
- `schema_version`
- `policy_json`
- `created_by`
- `created_at`

### `device_policy_assignments`

- `device_id`
- `policy_id`
- `policy_version`
- `assigned_at`

### `exception_requests`

- `id`
- `device_id`
- `resource_identifier`
- `reason`
- `status`
- `expires_at`
- `created_at`
- `decided_at`

### `audit_events`

- `id`
- `family_id`
- `actor_user_id`
- `device_id`
- `event_type`
- `metadata_json`
- `created_at`

### Database requirements

- Use foreign keys and appropriate indexes.
- Store timestamps in UTC.
- Store the IANA timezone associated with each schedule.
- Use database transactions for policy changes and enrollment.
- Never store plaintext passwords or pairing tokens.
- Avoid storing full browsing history by default.

---

## 9. Policy Schema

Example policy:

```json
{
  "schema_version": 1,
  "policy_id": "policy-example",
  "version": 1,
  "timezone": "Asia/Dhaka",
  "website": {
    "default_action": "allow",
    "blocked_domains": [
      "example.test"
    ],
    "allowed_domains": [
      "school.example"
    ],
    "categories_blocked": [
      "adult",
      "malware",
      "phishing"
    ]
  },
  "screen_time": {
    "daily_limit_minutes": 120,
    "bedtime": {
      "enabled": true,
      "start": "21:00",
      "end": "07:00"
    }
  },
  "apps": {
    "rules": [],
    "unsupported_behavior": "report_only"
  }
}
```

### Policy rules

- Validate every policy before saving.
- Reject unsupported schema versions.
- Use explicit rule precedence.
- Treat time-limited exceptions as separate, expiring grants.
- Cache only validated policies.
- Keep the previous valid policy if a new policy cannot be parsed.
- Never trust policy content supplied inside a push notification.

---

## 10. API Design

Base URL:

```text
/v1
```

### Authentication

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/password-reset/request
POST /auth/password-reset/complete
```

### Family management

```text
POST /families
GET  /families/{family_id}
GET  /families/{family_id}/members
POST /families/{family_id}/invitations
```

### Device management

```text
POST /families/{family_id}/pairing-tokens
POST /devices/enroll
GET  /families/{family_id}/devices
GET  /devices/{device_id}
POST /devices/{device_id}/revoke
POST /devices/{device_id}/capabilities
POST /devices/{device_id}/sync-state
```

### Policy management

```text
GET  /families/{family_id}/policies
POST /families/{family_id}/policies
GET  /policies/{policy_id}/versions/{version}
PUT  /devices/{device_id}/policy-assignment
GET  /devices/{device_id}/desired-policy
```

### Access requests and audit

```text
POST /devices/{device_id}/exception-requests
GET  /families/{family_id}/exception-requests
POST /exception-requests/{request_id}/decision
GET  /families/{family_id}/audit-events
```

### API requirements

- HTTPS only in production.
- Validate all request payloads.
- Enforce family-scoped authorization on every endpoint.
- Rate-limit login and pairing attempts.
- Use short-lived access tokens and rotating refresh sessions.
- Implement pagination.
- Return stable error codes.
- Avoid exposing internal stack traces.
- Document APIs with OpenAPI.

---

## 11. Device Pairing and Synchronization

### Enrollment flow

1. Parent authenticates.
2. Parent creates a one-time pairing token.
3. Child app scans a QR code or enters the code.
4. Child app explains requested permissions and active controls.
5. Device user completes required OS consent steps.
6. Backend validates the token and enrolls the device.
7. Device reports its actual capabilities.
8. Parent receives enrollment status.

Pairing tokens should expire within approximately 5–10 minutes and be single-use.

### Policy synchronization

1. Parent changes a policy.
2. Backend validates and stores a new version.
3. Child receives a push notification or performs scheduled synchronization.
4. Child fetches the policy over authenticated HTTPS.
5. Shared Rust logic validates the policy.
6. Native integration applies supported rules.
7. Child reports the applied version and any errors.
8. Parent sees the updated status.

If the server is temporarily unavailable, the child should continue using the last valid cached policy where supported.

---

## 12. Security Requirements

### Authentication and sessions

- Use Argon2id for password hashing if managing passwords directly.
- Use short-lived access tokens.
- Rotate refresh tokens and detect reuse.
- Store client secrets in OS secure storage.
- Provide session revocation.
- Add MFA before public launch.

### Device security

- Short-lived, one-time pairing codes.
- Device revocation.
- Permission checks before enforcement.
- Strict validation of received policies.
- Signed application releases.
- Least-privilege Tauri capabilities.
- Restrictive Content Security Policy.
- Dependency auditing.

### Privacy

- No secret monitoring.
- No message-content collection.
- No unnecessary location collection.
- No full browsing history by default.
- Clear data retention and deletion policies.
- Data export and account deletion.
- Minimal, redacted application logs.
- Documented access to support and operational data.

### Child transparency

The child application must clearly disclose active filtering, requested permissions, and device-management restrictions. If a managed-device configuration prevents ordinary removal, this must be disclosed before enrollment.

---

## 13. Development Milestones

### Milestone 0 — Platform Feasibility

**Estimated duration:** 1–2 weeks

Tasks:
- Create a minimal Tauri 2 application.
- Test desktop builds.
- Test Android builds on a physical device.
- Build an iOS prototype on macOS.
- Prototype Android `VpnService` or safe-browser filtering.
- Test Apple Screen Time authorization and entitlement requirements.
- Record supported capabilities and limitations.

**Deliverable:** `docs/platform-capabilities.md`.

**Acceptance criteria:** no major feature is promised before its native implementation has been validated.

### Milestone 1 — Shared Rust Core

**Estimated duration:** 1–2 weeks

Tasks:
- Set up the Cargo workspace.
- Create `policy-schema`.
- Create `policy-core`.
- Implement domain normalization.
- Implement rule precedence.
- Implement schedule calculations.
- Add unit tests.

**Deliverable:** tested, platform-independent policy engine.

### Milestone 2 — Parent Dashboard

**Estimated duration:** 1–2 weeks

Tasks:
- Create the Tauri 2 + React + TypeScript app.
- Implement authentication screens.
- Build family and device dashboards.
- Create website rule editor.
- Add screen-time configuration.
- Implement capability and synchronization status UI.

**Deliverable:** functional desktop dashboard with mock data or a connected development API.

### Milestone 3 — Rust Backend

**Estimated duration:** 1–2 weeks

Tasks:
- Set up Axum and PostgreSQL.
- Implement migrations with SQLx.
- Build authentication and family APIs.
- Implement pairing tokens.
- Implement device enrollment and revocation.
- Add policy versioning.
- Add audit logging.
- Write integration tests.

**Deliverable:** authenticated backend with family isolation.

### Milestone 4 — Android Child Application

**Estimated duration:** 2–4 weeks

Tasks:
- Implement child-device enrollment.
- Add a clear protection-status screen.
- Build the native Android integration.
- Implement safe-browser filtering.
- Prototype consent-based VPN filtering.
- Implement local policy caching.
- Add screen-time controls where supported.
- Add authorized usage reporting.

**Deliverable:** Android beta with documented capabilities and limitations.

### Milestone 5 — iOS Child Application

**Estimated duration:** 2–5+ weeks

Tasks:
- Create the Swift native bridge.
- Verify Family Controls entitlement availability.
- Implement authorization flows.
- Prototype DeviceActivity schedules.
- Implement ManagedSettings restrictions where authorized.
- Provide reduced-capability behavior where necessary.

**Deliverable:** iOS beta for verified, supported controls.

The schedule may increase substantially because of entitlement approval and platform review.

### Milestone 6 — Synchronization and Exceptions

**Estimated duration:** 1–2 weeks

Tasks:
- Implement policy sync.
- Integrate push notifications.
- Add version acknowledgements.
- Implement access-request approval.
- Add temporary exceptions.
- Add privacy-conscious usage summaries.

**Deliverable:** end-to-end parent-to-child policy management.

### Milestone 7 — Security and Production

**Estimated duration:** 2+ weeks

Tasks:
- Conduct a threat-model review.
- Test family isolation.
- Test token rotation and revocation.
- Audit Tauri capabilities and native permissions.
- Implement backup and restoration procedures.
- Test accessibility and localization.
- Prepare signed builds.
- Prepare store listings and privacy documentation.

**Deliverable:** controlled beta ready for external testing.

---

## 14. Testing Strategy

### Rust unit tests

- Domain normalization.
- Exact-domain and subdomain matching.
- Rule precedence.
- Schedule boundaries.
- Timezone behavior.
- Invalid policy rejection.
- Exception expiration.

### Backend integration tests

- Authentication.
- Token rotation.
- Pairing expiration.
- Single-use pairing.
- Family authorization.
- Policy versioning.
- Device revocation.
- Audit event creation.

### Android tests

- VPN permission approval and denial.
- Network changes.
- Offline policy enforcement.
- Battery optimization.
- VPN conflicts.
- Usage Access permission.
- Reboot and synchronization recovery.

### iOS tests

- Family Controls authorization.
- Entitlement availability.
- Screen-time scheduling.
- Device restart.
- Permission denial.
- Unsupported capability behavior.

### End-to-end test

1. Parent creates a family.
2. Parent enrolls a child device.
3. Parent creates a website-blocking rule.
4. Child downloads and validates the policy.
5. Supported filtering integration blocks a test domain.
6. Child requests access.
7. Parent approves a temporary exception.
8. Exception expires correctly.
9. Parent revokes the device.
10. The revoked device cannot fetch new policies.

---

## 15. Deployment Architecture

### Development

- Docker Compose.
- PostgreSQL.
- Rust API.
- Tauri desktop app.
- Android emulator and physical Android device.
- iOS simulator and physical device on macOS.

### Production

- Rust API behind an HTTPS reverse proxy.
- Private PostgreSQL database.
- Automated encrypted backups.
- Separate staging and production environments.
- Secure FCM/APNs credentials.
- Signed desktop and mobile builds.
- CI checks for formatting, tests, dependencies, and release artifacts.
- Documented recovery and incident-response procedures.

iOS builds and signing require macOS with the appropriate Apple tooling.

---

## 16. Official Documentation

Consult current documentation before implementing platform-specific features:

- Tauri 2: https://v2.tauri.app/
- Android VpnService: https://developer.android.com/reference/android/net/VpnService
- Android UsageStatsManager: https://developer.android.com/reference/android/app/usage/UsageStatsManager
- Android dedicated devices: https://developer.android.com/work/dpc/dedicated-devices
- Apple Family Controls: https://developer.apple.com/documentation/familycontrols
- Apple Managed Settings: https://developer.apple.com/documentation/managedsettings
- Apple Device Activity: https://developer.apple.com/documentation/deviceactivity
- Apple Network Extension: https://developer.apple.com/documentation/networkextension
- OWASP MASVS: https://mas.owasp.org/MASVS/

---

## 17. MVP Acceptance Criteria

The MVP is ready for a controlled beta when:

- A parent can create an account and family.
- Child devices can be transparently enrolled and revoked.
- Website policies can be created and synchronized.
- Filtering works on the specific supported network/browser path.
- Screen-time controls work on tested platform configurations.
- App restrictions are enabled only when the platform supports them.
- The UI accurately reports permissions and enforcement status.
- Offline behavior is documented and tested.
- Family-level authorization tests pass.
- Device revocation prevents future authenticated synchronization.
- Privacy and data-retention documentation is available.
- No covert surveillance or unauthorized persistence is present.

---

## 18. Recommended Implementation Order

1. Platform feasibility prototype.
2. Shared Rust policy engine.
3. Tauri parent dashboard.
4. Rust backend and database.
5. Android child integration.
6. iOS child integration.
7. Synchronization and access requests.
8. Security testing and controlled beta.

**Final recommendation:** Do not try to build all parental-control features simultaneously. First validate Android and iOS enforcement independently, then implement the shared Rust core and Tauri interface. Ship only capabilities that have been verified on supported devices and operating-system versions.

