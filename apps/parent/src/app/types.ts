export type DevicePlatform = "android" | "ios" | "linux" | "windows" | "macos";

export type EnrollmentStatus = "pending" | "enrolled" | "revoked";

export type SyncStatus = "in-sync" | "outdated" | "error" | "never";

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface FamilyMember {
  userId: string;
  email: string;
  role: "owner" | "guardian";
  joinedAt: string;
}

export interface Family {
  id: string;
  name: string;
  ownerUserId: string;
  members: FamilyMember[];
  createdAt: string;
}

export type FilteringSupport = "vpn" | "safe_browser" | "unsupported";
export type ScreenTimeSupport = "device_activity" | "usage_stats" | "unsupported";
export type AppRestrictionsSupport = "managed_settings" | "device_policy" | "unsupported";

export interface DeviceCapabilities {
  website_filtering: FilteringSupport;
  screen_time: ScreenTimeSupport;
  app_restrictions: AppRestrictionsSupport;
}

export interface Device {
  id: string;
  familyId: string;
  displayName: string;
  platform: DevicePlatform;
  osVersion: string;
  appVersion: string;
  capabilities: DeviceCapabilities;
  enrollmentStatus: EnrollmentStatus;
  lastSeenAt: string | null;
  appliedPolicyVersion: number | null;
  syncError: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface PairingToken {
  code: string;
  expiresAt: string;
}

export type WebsiteAction = "allow" | "block";

export type ContentCategory = "adult" | "malware" | "phishing";

export type AppAction = "allow" | "block";

export type UnsupportedBehavior = "report_only";

export type DayOption = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type WindowDays = "weekdays" | "weekend" | "all" | DayOption[];

export interface WebsitePolicy {
  default_action: WebsiteAction;
  blocked_domains: string[];
  allowed_domains: string[];
  categories_blocked: ContentCategory[];
}

export interface BedtimeConfig {
  enabled: boolean;
  start: string;
  end: string;
}

export interface AllowedWindow {
  days: WindowDays;
  start: string;
  end: string;
}

export interface ScreenTimePolicy {
  daily_limit_minutes: number;
  bedtime: BedtimeConfig | null;
  allowed_windows: AllowedWindow[];
}

export interface AppRule {
  app_id: string;
  action: AppAction;
}

export interface AppsPolicy {
  rules: AppRule[];
  unsupported_behavior: UnsupportedBehavior;
}

export interface Policy {
  schema_version: 1;
  policy_id: string;
  version: number;
  timezone: string;
  website: WebsitePolicy;
  screen_time: ScreenTimePolicy;
  apps: AppsPolicy;
  expires_at?: string;
}

export interface PolicyVersionInfo {
  version: number;
  createdBy: string;
  createdAt: string;
}

export type ExceptionStatus = "pending" | "approved" | "denied" | "expired";

export interface ExceptionRequest {
  id: string;
  deviceId: string;
  deviceName: string;
  resourceIdentifier: string;
  reason: string;
  status: ExceptionStatus;
  expiresAt: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface AuditEvent {
  id: string;
  eventType: string;
  actorEmail: string;
  deviceId: string | null;
  metadata: string;
  createdAt: string;
}

export interface UsageSummary {
  deviceId: string;
  deviceName: string;
  date: string;
  minutesUsed: number;
}
