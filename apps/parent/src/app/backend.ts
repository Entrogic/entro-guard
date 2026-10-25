import type {
  AuditEvent,
  Device,
  DevicePlatform,
  ExceptionRequest,
  Family,
  PairingToken,
  Policy,
  PolicyVersionInfo,
  UsageSummary,
  User,
} from "./types";
import { validatePolicy } from "./validate";

export interface Backend {
  currentUser(): User | null;
  register(email: string, password: string): Promise<User>;
  login(email: string, password: string): Promise<User>;
  logout(): Promise<void>;
  getFamily(): Promise<Family | null>;
  createFamily(name: string): Promise<Family>;
  addGuardian(email: string): Promise<Family>;
  getDevices(): Promise<Device[]>;
  getPolicy(): Promise<Policy | null>;
  updatePolicy(policy: Policy): Promise<Policy>;
  getPolicyHistory(): Promise<PolicyVersionInfo[]>;
  applyPolicyToDevices(): Promise<void>;
  createPairingToken(): Promise<PairingToken>;
  simulateEnrollment(displayName: string, platform: DevicePlatform): Promise<Device>;
  revokeDevice(deviceId: string): Promise<void>;
  getRequests(): Promise<ExceptionRequest[]>;
  decideRequest(requestId: string, decision: "approved" | "denied"): Promise<void>;
  getAuditEvents(): Promise<AuditEvent[]>;
  getUsageSummary(): Promise<UsageSummary[]>;
}

interface MockState {
  users: { id: string; email: string; passwordHash: string; createdAt: string }[];
  currentUserId: string | null;
  family: Family | null;
  devices: Device[];
  policy: Policy | null;
  policyHistory: PolicyVersionInfo[];
  requests: ExceptionRequest[];
  audit: AuditEvent[];
  usage: UsageSummary[];
  pairingToken: PairingToken | null;
}

const STORAGE_KEY = "entrouguard.parent.mock.v1";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function hashPassword(password: string): string {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = (hash * 33) ^ password.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 200));
}

function iso(daysAgo = 0, minutesOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setMinutes(d.getMinutes() - minutesOffset);
  return d.toISOString();
}

function buildSeedState(owner: User, family: Family): MockState {
  const device1: Device = {
    id: "dev-android-1",
    familyId: family.id,
    displayName: "Rafi's Android Phone",
    platform: "android",
    osVersion: "Android 15",
    appVersion: "0.1.0",
    capabilities: {
      website_filtering: "vpn",
      screen_time: "usage_stats",
      app_restrictions: "unsupported",
    },
    enrollmentStatus: "enrolled",
    lastSeenAt: iso(0, 2),
    appliedPolicyVersion: 1,
    syncError: null,
    createdAt: iso(9),
    revokedAt: null,
  };
  const device2: Device = {
    id: "dev-ios-1",
    familyId: family.id,
    displayName: "Aisha's iPad",
    platform: "ios",
    osVersion: "iOS 18.4",
    appVersion: "0.1.0",
    capabilities: {
      website_filtering: "unsupported",
      screen_time: "device_activity",
      app_restrictions: "managed_settings",
    },
    enrollmentStatus: "enrolled",
    lastSeenAt: iso(0, 65),
    appliedPolicyVersion: 1,
    syncError: null,
    createdAt: iso(6),
    revokedAt: null,
  };
  const device3: Device = {
    id: "dev-linux-1",
    familyId: family.id,
    displayName: "Family laptop",
    platform: "linux",
    osVersion: "Ubuntu 24.04",
    appVersion: "0.1.0",
    capabilities: {
      website_filtering: "safe_browser",
      screen_time: "unsupported",
      app_restrictions: "unsupported",
    },
    enrollmentStatus: "pending",
    lastSeenAt: null,
    appliedPolicyVersion: null,
    syncError: null,
    createdAt: iso(1),
    revokedAt: null,
  };
  const policy: Policy = {
    schema_version: 1,
    policy_id: uid("policy"),
    version: 1,
    timezone: "Asia/Dhaka",
    website: {
      default_action: "allow",
      blocked_domains: ["example.test"],
      allowed_domains: ["school.example"],
      categories_blocked: ["adult", "malware", "phishing"],
    },
    screen_time: {
      daily_limit_minutes: 120,
      bedtime: { enabled: true, start: "21:00", end: "07:00" },
      allowed_windows: [{ days: "weekdays", start: "06:00", end: "21:00" }],
    },
    apps: {
      rules: [],
      unsupported_behavior: "report_only",
    },
  };
  const requests: ExceptionRequest[] = [
    {
      id: uid("req"),
      deviceId: device1.id,
      deviceName: device1.displayName,
      resourceIdentifier: "youtube.com",
      reason: "Needed for a school project video.",
      status: "pending",
      expiresAt: null,
      createdAt: iso(0, 35),
      decidedAt: null,
    },
    {
      id: uid("req"),
      deviceId: device1.id,
      deviceName: device1.displayName,
      resourceIdentifier: "wikipedia.org",
      reason: "Homework research.",
      status: "approved",
      expiresAt: iso(0, -45),
      createdAt: iso(1, 0),
      decidedAt: iso(0, 20),
    },
  ];
  const audit: AuditEvent[] = [
    {
      id: uid("evt"),
      eventType: "family.created",
      actorEmail: owner.email,
      deviceId: null,
      metadata: family.name,
      createdAt: family.createdAt,
    },
    {
      id: uid("evt"),
      eventType: "device.enrolled",
      actorEmail: owner.email,
      deviceId: device2.id,
      metadata: device2.displayName,
      createdAt: device2.createdAt,
    },
    {
      id: uid("evt"),
      eventType: "device.enrolled",
      actorEmail: owner.email,
      deviceId: device1.id,
      metadata: device1.displayName,
      createdAt: device1.createdAt,
    },
    {
      id: uid("evt"),
      eventType: "policy.created",
      actorEmail: owner.email,
      deviceId: null,
      metadata: "policy version 1",
      createdAt: iso(8),
    },
    {
      id: uid("evt"),
      eventType: "exception.approved",
      actorEmail: owner.email,
      deviceId: device1.id,
      metadata: "wikipedia.org approved for 60m",
      createdAt: iso(0, 20),
    },
  ];
  const usage: UsageSummary[] = [
    { deviceId: device1.id, deviceName: device1.displayName, date: iso(0), minutesUsed: 74 },
    { deviceId: device2.id, deviceName: device2.displayName, date: iso(0), minutesUsed: 41 },
  ];
  return {
    users: [
      {
        id: owner.id,
        email: owner.email,
        passwordHash: hashPassword(""),
        createdAt: owner.createdAt,
      },
    ],
    currentUserId: owner.id,
    family,
    devices: [device1, device2, device3],
    policy,
    policyHistory: [
      {
        version: 1,
        createdBy: owner.email,
        createdAt: iso(8),
      },
    ],
    requests,
    audit,
    usage,
    pairingToken: null,
  };
}

export class MockBackend implements Backend {
  private state: MockState;

  constructor() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      this.state = JSON.parse(raw) as MockState;
    } else {
      this.state = {
        users: [],
        currentUserId: null,
        family: null,
        devices: [],
        policy: null,
        policyHistory: [],
        requests: [],
        audit: [],
        usage: [],
        pairingToken: null,
      };
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  private requireUser(): User {
    const entry = this.state.users.find((u) => u.id === this.state.currentUserId);
    if (!entry) throw new Error("Not authenticated.");
    return { id: entry.id, email: entry.email, createdAt: entry.createdAt };
  }

  private requireFamily(): Family {
    if (!this.state.family) throw new Error("No family yet.");
    return this.state.family;
  }

  private audit(eventType: string, metadata: string, deviceId: string | null = null): void {
    const user = this.requireUser();
    this.state.audit.unshift({
      id: uid("evt"),
      eventType,
      actorEmail: user.email,
      deviceId,
      metadata,
      createdAt: new Date().toISOString(),
    });
  }

  currentUser(): User | null {
    const entry = this.state.users.find((u) => u.id === this.state.currentUserId);
    if (!entry) return null;
    return { id: entry.id, email: entry.email, createdAt: entry.createdAt };
  }

  async register(email: string, password: string): Promise<User> {
    await delay();
    const normalized = email.trim().toLowerCase();
    if (this.state.users.some((u) => u.email === normalized)) {
      throw new Error("An account with this email already exists.");
    }
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");
    const user = {
      id: uid("usr"),
      email: normalized,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    this.state.users.push(user);
    this.state.currentUserId = user.id;
    this.save();
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }

  async login(email: string, password: string): Promise<User> {
    await delay();
    const normalized = email.trim().toLowerCase();
    const entry = this.state.users.find((u) => u.email === normalized);
    if (!entry || entry.passwordHash !== hashPassword(password)) {
      throw new Error("Invalid email or password.");
    }
    this.state.currentUserId = entry.id;
    this.save();
    return { id: entry.id, email: entry.email, createdAt: entry.createdAt };
  }

  async logout(): Promise<void> {
    await delay();
    this.state.currentUserId = null;
    this.save();
  }

  async getFamily(): Promise<Family | null> {
    await delay();
    return this.state.family;
  }

  async createFamily(name: string): Promise<Family> {
    await delay();
    const user = this.requireUser();
    if (this.state.family) throw new Error("Family already exists.");
    const family: Family = {
      id: uid("fam"),
      name: name.trim(),
      ownerUserId: user.id,
      members: [{ userId: user.id, email: user.email, role: "owner", joinedAt: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
    };
    const seeded = buildSeedState(user, family);
    this.state = { ...seeded, users: this.state.users, currentUserId: user.id };
    this.save();
    return family;
  }

  async addGuardian(email: string): Promise<Family> {
    await delay();
    const family = this.requireFamily();
    const normalized = email.trim().toLowerCase();
    if (family.members.some((m) => m.email === normalized)) {
      throw new Error("That email is already a member of this family.");
    }
    family.members.push({
      userId: uid("usr"),
      email: normalized,
      role: "guardian",
      joinedAt: new Date().toISOString(),
    });
    this.audit("member.invited", normalized);
    this.save();
    return family;
  }

  async getDevices(): Promise<Device[]> {
    await delay();
    return [...this.state.devices];
  }

  async getPolicy(): Promise<Policy | null> {
    await delay();
    return this.state.policy ? { ...this.state.policy } : null;
  }

  async updatePolicy(policy: Policy): Promise<Policy> {
    await delay();
    const errors = validatePolicy(policy);
    if (errors.length > 0) throw new Error(errors.join(" "));
    const user = this.requireUser();
    const next: Policy = { ...policy, version: policy.version + 1 };
    this.state.policy = next;
    this.state.policyHistory.unshift({
      version: next.version,
      createdBy: user.email,
      createdAt: new Date().toISOString(),
    });
    this.audit("policy.updated", `policy version ${next.version}`);
    this.save();
    return next;
  }

  async getPolicyHistory(): Promise<PolicyVersionInfo[]> {
    await delay();
    return [...this.state.policyHistory];
  }

  async applyPolicyToDevices(): Promise<void> {
    await delay();
    const policy = this.state.policy;
    if (!policy) throw new Error("No policy to apply.");
    for (const device of this.state.devices) {
      if (device.enrollmentStatus === "enrolled") {
        device.appliedPolicyVersion = policy.version;
        device.syncError = null;
        device.lastSeenAt = new Date().toISOString();
      }
    }
    this.audit("policy.applied", `policy version ${policy.version} applied to all enrolled devices`);
    this.save();
  }

  async createPairingToken(): Promise<PairingToken> {
    await delay();
    this.requireFamily();
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    const token: PairingToken = {
      code: `${code.slice(0, 3)}-${code.slice(3)}`,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
    this.state.pairingToken = token;
    this.audit("pairing.token_created", token.code);
    this.save();
    return token;
  }

  async simulateEnrollment(displayName: string, platform: DevicePlatform): Promise<Device> {
    await delay();
    if (!this.state.pairingToken) throw new Error("No active pairing token.");
    const family = this.requireFamily();
    const device: Device = {
      id: uid("dev"),
      familyId: family.id,
      displayName: displayName.trim() || "New device",
      platform,
      osVersion: platform === "android" ? "Android 15" : platform === "ios" ? "iOS 18" : "Ubuntu 24.04",
      appVersion: "0.1.0",
      capabilities:
        platform === "android"
          ? { website_filtering: "vpn", screen_time: "usage_stats", app_restrictions: "unsupported" }
          : platform === "ios"
            ? { website_filtering: "unsupported", screen_time: "device_activity", app_restrictions: "managed_settings" }
            : { website_filtering: "safe_browser", screen_time: "unsupported", app_restrictions: "unsupported" },
      enrollmentStatus: "enrolled",
      lastSeenAt: new Date().toISOString(),
      appliedPolicyVersion: this.state.policy?.version ?? null,
      syncError: null,
      createdAt: new Date().toISOString(),
      revokedAt: null,
    };
    this.state.devices.push(device);
    this.state.pairingToken = null;
    this.audit("device.enrolled", device.displayName, device.id);
    this.save();
    return device;
  }

  async revokeDevice(deviceId: string): Promise<void> {
    await delay();
    const device = this.state.devices.find((d) => d.id === deviceId);
    if (!device) throw new Error("Device not found.");
    device.enrollmentStatus = "revoked";
    device.revokedAt = new Date().toISOString();
    this.audit("device.revoked", device.displayName, device.id);
    this.save();
  }

  async getRequests(): Promise<ExceptionRequest[]> {
    await delay();
    return [...this.state.requests].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async decideRequest(requestId: string, decision: "approved" | "denied"): Promise<void> {
    await delay();
    const request = this.state.requests.find((r) => r.id === requestId);
    if (!request) throw new Error("Request not found.");
    request.status = decision;
    request.decidedAt = new Date().toISOString();
    request.expiresAt =
      decision === "approved" ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null;
    this.audit(
      `exception.${decision}`,
      `${request.resourceIdentifier} ${decision === "approved" ? "approved for 60m" : "denied"}`,
      request.deviceId,
    );
    this.save();
  }

  async getAuditEvents(): Promise<AuditEvent[]> {
    await delay();
    return [...this.state.audit];
  }

  async getUsageSummary(): Promise<UsageSummary[]> {
    await delay();
    return [...this.state.usage];
  }
}
