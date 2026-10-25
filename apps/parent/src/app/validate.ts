import type { ContentCategory, Policy } from "./types";

export const CONTENT_CATEGORIES: { value: ContentCategory; label: string }[] = [
  { value: "adult", label: "Adult content" },
  { value: "malware", label: "Malware" },
  { value: "phishing", label: "Phishing" },
];

export const TIMEZONES = [
  "Asia/Dhaka",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kuala_Lumpur",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
] as const;

export const DAY_OPTIONS: { value: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"; label: string }[] = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
];

const DOMAIN_RE =
  /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*$/i;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDomain(domain: string): boolean {
  return domain.length <= 253 && DOMAIN_RE.test(domain);
}

export function isValidTime(time: string): boolean {
  return TIME_RE.test(time);
}

function hasDuplicates(list: string[]): boolean {
  return new Set(list.map((d) => d.toLowerCase())).size !== list.length;
}

export function validatePolicy(policy: Policy): string[] {
  const errors: string[] = [];
  if (policy.schema_version !== 1) errors.push("Unsupported schema version.");
  if (!policy.policy_id.trim()) errors.push("Policy id is required.");
  if (policy.version < 1) errors.push("Policy version must be at least 1.");
  if (!TIMEZONES.includes(policy.timezone as (typeof TIMEZONES)[number])) {
    errors.push(`Unknown timezone "${policy.timezone}".`);
  }
  for (const field of ["blocked_domains", "allowed_domains"] as const) {
    const list = policy.website[field];
    for (const d of list) {
      if (!isValidDomain(d)) errors.push(`Invalid domain in ${field}: "${d}".`);
    }
    if (hasDuplicates(list)) errors.push(`Duplicate domains in ${field}.`);
  }
  if (hasDuplicates(policy.website.categories_blocked)) {
    errors.push("Duplicate content categories.");
  }
  if (
    policy.screen_time.daily_limit_minutes < 0 ||
    policy.screen_time.daily_limit_minutes > 1440
  ) {
    errors.push("Daily limit must be between 0 and 1440 minutes.");
  }
  const bedtime = policy.screen_time.bedtime;
  if (bedtime) {
    if (!isValidTime(bedtime.start) || !isValidTime(bedtime.end)) {
      errors.push("Bedtime uses an invalid time.");
    }
    if (bedtime.enabled && bedtime.start === bedtime.end) {
      errors.push("Bedtime start and end must differ.");
    }
  }
  for (const [i, w] of policy.screen_time.allowed_windows.entries()) {
    if (!isValidTime(w.start) || !isValidTime(w.end)) {
      errors.push(`Window ${i + 1} uses an invalid time.`);
    }
    if (w.start === w.end) errors.push(`Window ${i + 1} start and end must differ.`);
    if (Array.isArray(w.days) && w.days.length === 0) {
      errors.push(`Window ${i + 1} needs at least one day.`);
    }
  }
  const appIds = new Set<string>();
  for (const rule of policy.apps.rules) {
    if (!rule.app_id.trim()) errors.push("App rules need a package id.");
    if (appIds.has(rule.app_id)) errors.push(`Duplicate app rule "${rule.app_id}".`);
    appIds.add(rule.app_id);
  }
  return errors;
}
