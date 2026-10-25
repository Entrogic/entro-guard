import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useApp } from "../../app/store";
import type { Device, Family, Policy } from "../../app/types";
import { fmtDate } from "../../app/format";
import {
  Button,
  Card,
  CardTitle,
  EmptyState,
  ErrorNote,
  Field,
  PageHeader,
  SuccessNote,
  TextInput,
} from "../../components/ui";
import styles from "./FamilyPage.module.css";

export function FamilyPage() {
  const { backend } = useApp();
  const [family, setFamily] = useState<Family | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [f, d, p] = await Promise.all([
      backend.getFamily(),
      backend.getDevices(),
      backend.getPolicy(),
    ]);
    setFamily(f);
    setDevices(d);
    setPolicy(p);
    setLoading(false);
  }, [backend]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return null;
  if (!family) return <CreateFamilyCard onCreated={load} />;

  const enrolled = devices.filter((d) => d.enrollmentStatus === "enrolled").length;
  const outdated = devices.filter(
    (d) => d.enrollmentStatus === "enrolled" && policy && d.appliedPolicyVersion !== null && d.appliedPolicyVersion < policy.version,
  ).length;

  return (
    <div>
      <PageHeader
        title={family.name}
        subtitle={`Created ${fmtDate(family.createdAt)}`}
        actions={<InviteGuardian family={family} onChanged={load} />}
      />
      <div className={styles.grid}>
        <Card>
          <CardTitle>Members</CardTitle>
          <ul className={styles.memberList}>
            {family.members.map((m) => (
              <li key={m.userId} className={styles.memberRow}>
                <div>
                  <p className={styles.memberEmail}>{m.email}</p>
                  <p className={styles.memberMeta}>Joined {fmtDate(m.joinedAt)}</p>
                </div>
                <span
                  className={
                    m.role === "owner" ? styles.roleOwner : styles.roleGuardian
                  }
                >
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>Overview</CardTitle>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <p className={styles.statValue}>{enrolled}</p>
              <p className={styles.statLabel}>enrolled devices</p>
            </div>
            <div className={styles.stat}>
              <p className={styles.statValue}>{policy ? policy.version : "—"}</p>
              <p className={styles.statLabel}>current policy version</p>
            </div>
            <div className={styles.stat}>
              <p className={`${styles.statValue} ${outdated > 0 ? styles.statWarn : ""}`}>
                {outdated}
              </p>
              <p className={styles.statLabel}>devices awaiting sync</p>
            </div>
          </div>
          <p className={styles.lastSync}>
            Current policy: version {policy ? policy.version : "—"}
          </p>
        </Card>
      </div>
    </div>
  );
}

function CreateFamilyCard({ onCreated }: { onCreated: () => Promise<void> }) {
  const { backend, user } = useApp();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await backend.createFamily(name || `${user?.email}'s family`);
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create family.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.createWrap}>
      <Card className={styles.createCard}>
        <CardTitle>Create your family</CardTitle>
        <EmptyState
          title="Welcome to EntroGuard"
          hint="A family groups your devices and shared policy. You can invite other guardians later."
        />
        <form className={styles.createForm} onSubmit={handleSubmit}>
          <Field label="Family name">
            <TextInput
              required
              placeholder="e.g. The Ahmed Family"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <ErrorNote message={error} />
          <Button type="submit" variant="primary" busy={busy}>
            Create family
          </Button>
        </form>
      </Card>
    </div>
  );
}

function InviteGuardian({ family, onChanged }: { family: Family; onChanged: () => Promise<void> }) {
  const { backend } = useApp();
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await backend.addGuardian(email);
      setSuccess(`Invitation created for ${email}.`);
      setEmail("");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invitation.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Invite guardian
      </Button>
    );
  }
  return (
    <form className={styles.inviteForm} onSubmit={handleInvite}>
      <TextInput
        type="email"
        required
        placeholder="guardian@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" variant="primary" busy={busy}>
        Send invite
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <span className={styles.inviteNote}>
        {family.members.length} member{family.members.length === 1 ? "" : "s"}
      </span>
      {error ? <ErrorNote message={error} /> : null}
      {success ? <SuccessNote message={success} /> : null}
    </form>
  );
}
