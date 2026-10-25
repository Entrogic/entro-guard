import { useCallback, useEffect, useState } from "react";
import { Laptop, MonitorSmartphone, QrCode, RefreshCw, Smartphone, Tablet } from "lucide-react";
import { useApp } from "../../app/store";
import type { Device, DevicePlatform, PairingToken, Policy, SyncStatus } from "../../app/types";
import { fmtDateTime, timeAgo } from "../../app/format";
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  Field,
  Modal,
  PageHeader,
  Select,
  TextInput,
} from "../../components/ui";
import styles from "./DevicesPage.module.css";

const PLATFORM_ICON = {
  android: Smartphone,
  ios: Tablet,
  linux: MonitorSmartphone,
  windows: MonitorSmartphone,
  macos: Laptop,
} as const;

const CAPABILITY_LABELS: Record<string, string> = {
  vpn: "VPN filtering",
  safe_browser: "Safe-browser filtering",
  device_activity: "Screen time (DeviceActivity)",
  usage_stats: "Screen time (UsageStats)",
  managed_settings: "App restrictions (ManagedSettings)",
  device_policy: "App restrictions (DevicePolicy)",
  unsupported: "Not supported",
};

export function DevicesPage() {
  const { backend } = useApp();
  const [devices, setDevices] = useState<Device[]>([]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [d, p] = await Promise.all([backend.getDevices(), backend.getPolicy()]);
    setDevices(d);
    setPolicy(p);
    setLoading(false);
  }, [backend]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) return null;

  return (
    <div>
      <PageHeader
        title="Devices"
        subtitle="Enroll child devices and monitor enforcement status."
        actions={
          <>
            <Button variant="secondary" busy={refreshing} onClick={handleRefresh}>
              <RefreshCw size={14} />
              Refresh
            </Button>
            <Button variant="primary" onClick={() => setEnrolling(true)}>
              Enroll device
            </Button>
          </>
        }
      />

      {devices.length === 0 ? (
        <Card>
          <p className={styles.noDevices}>
            No devices yet. Create a pairing token to enroll the first child
            device.
          </p>
        </Card>
      ) : (
        <div className={styles.grid}>
          {devices.map((device) => (
            <DeviceCard key={device.id} device={device} policy={policy} onChanged={load} />
          ))}
        </div>
      )}

      {enrolling ? <EnrollModal onClose={() => setEnrolling(false)} onEnrolled={load} /> : null}
    </div>
  );
}

function syncStatus(device: Device, policy: Policy | null): { status: SyncStatus; label: string } {
  if (device.enrollmentStatus === "revoked") return { status: "error", label: "Revoked" };
  if (device.enrollmentStatus === "pending") return { status: "never", label: "Not enrolled" };
  if (device.syncError) return { status: "error", label: "Sync error" };
  if (!policy || device.appliedPolicyVersion === null) return { status: "never", label: "Never synced" };
  if (device.appliedPolicyVersion < policy.version) {
    return { status: "outdated", label: `Outdated (v${device.appliedPolicyVersion})` };
  }
  return { status: "in-sync", label: `In sync (v${device.appliedPolicyVersion})` };
}

function DeviceCard({
  device,
  policy,
  onChanged,
}: {
  device: Device;
  policy: Policy | null;
  onChanged: () => Promise<void>;
}) {
  const { backend } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sync = syncStatus(device, policy);
  const Icon = PLATFORM_ICON[device.platform] ?? Smartphone;

  async function handleRevoke() {
    if (!window.confirm(`Revoke "${device.displayName}"? The device will lose access and cannot fetch new policies.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await backend.revokeDevice(device.id);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke device.");
    } finally {
      setBusy(false);
    }
  }

  const capabilities = [
    ["website_filtering", device.capabilities.website_filtering],
    ["screen_time", device.capabilities.screen_time],
    ["app_restrictions", device.capabilities.app_restrictions],
  ] as const;

  return (
    <Card className={styles.deviceCard}>
      <header className={styles.deviceHeader}>
        <span className={styles.deviceIcon}>
          <Icon size={18} />
        </span>
        <div className={styles.deviceTitle}>
          <p className={styles.deviceName}>{device.displayName}</p>
          <p className={styles.deviceMeta}>
            {device.platform} · {device.osVersion} · app {device.appVersion}
          </p>
        </div>
        <SyncBadge status={sync.status} label={sync.label} />
      </header>

      <div className={styles.capRow}>
        {capabilities.map(([key, value]) => (
          <span key={key} className={value === "unsupported" ? styles.capUnsupported : styles.capSupported}>
            {CAPABILITY_LABELS[value]}
          </span>
        ))}
      </div>

      <div className={styles.deviceFacts}>
        <p>
          Last seen: <strong>{timeAgo(device.lastSeenAt)}</strong>{" "}
          <span className={styles.factMuted}>({fmtDateTime(device.lastSeenAt)})</span>
        </p>
        <p>
          Applied policy:{" "}
          <strong>{device.appliedPolicyVersion ? `v${device.appliedPolicyVersion}` : "none"}</strong>
        </p>
      </div>

      <div className={styles.deviceActions}>
        <Button variant="danger" busy={busy} disabled={device.enrollmentStatus === "revoked"} onClick={handleRevoke}>
          Revoke
        </Button>
        <ErrorNote message={error} />
      </div>
    </Card>
  );
}

function SyncBadge({ status, label }: { status: SyncStatus; label: string }) {
  const tone = status === "in-sync" ? "ok" : status === "outdated" ? "warn" : status === "error" ? "danger" : "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}

function EnrollModal({
  onClose,
  onEnrolled,
}: {
  onClose: () => void;
  onEnrolled: () => Promise<void>;
}) {
  const { backend } = useApp();
  const [token, setToken] = useState<PairingToken | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<DevicePlatform>("android");
  const [copied, setCopied] = useState(false);

  async function createToken() {
    setBusy(true);
    setError(null);
    try {
      setToken(await backend.createPairingToken());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create pairing token.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!token) return;
    await navigator.clipboard.writeText(token.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function simulate() {
    setBusy(true);
    setError(null);
    try {
      await backend.simulateEnrollment(name, platform);
      await onEnrolled();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrollment failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Enroll a child device" onClose={onClose}>
      <p className={styles.enrollHint}>
        The child app scans the QR code or enters the pairing code. Tokens are
        single-use and expire in about 10 minutes.
      </p>
      {!token ? (
        <>
          <Button variant="primary" busy={busy} onClick={createToken}>
            <QrCode size={15} />
            Create pairing token
          </Button>
          <ErrorNote message={error} />
        </>
      ) : (
        <>
          <div className={styles.qrPlaceholder}>
            <QrCode size={72} />
            <p>QR preview</p>
          </div>
          <div className={styles.codeRow}>
            <code className={styles.code}>{token.code}</code>
            <Button variant="secondary" onClick={copyCode}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className={styles.expiry}>
            Expires {fmtDateTime(token.expiresAt)} · single use
          </p>
          <hr className={styles.divider} />
          <p className={styles.simLabel}>Demo: simulate a device enrolling with this token</p>
          <div className={styles.simRow}>
            <Field label="Device name">
              <TextInput placeholder="e.g. Rafi's tablet" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Platform">
              <Select value={platform} onChange={(e) => setPlatform(e.target.value as DevicePlatform)}>
                <option value="android">Android</option>
                <option value="ios">iOS</option>
                <option value="linux">Linux</option>
                <option value="windows">Windows</option>
                <option value="macos">macOS</option>
              </Select>
            </Field>
          </div>
          <Button variant="primary" busy={busy} onClick={simulate}>
            Simulate enrollment
          </Button>
          <ErrorNote message={error} />
        </>
      )}
    </Modal>
  );
}
