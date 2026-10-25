import { useCallback, useEffect, useState } from "react";
import { Check, Inbox, X } from "lucide-react";
import { useApp } from "../../app/store";
import type { ExceptionRequest } from "../../app/types";
import { fmtDateTime } from "../../app/format";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  ErrorNote,
  PageHeader,
} from "../../components/ui";
import styles from "./RequestsPage.module.css";

export function RequestsPage() {
  const { backend } = useApp();
  const [requests, setRequests] = useState<ExceptionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRequests(await backend.getRequests());
    setLoading(false);
  }, [backend]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, decision: "approved" | "denied") {
    setBusy(id);
    setError(null);
    try {
      await backend.decideRequest(id, decision);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record decision.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return null;

  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");

  return (
    <div>
      <PageHeader
        title="Access requests"
        subtitle="Temporary, expiring exceptions requested by child devices."
      />

      <div className={styles.layout}>
        <Card>
          <CardTitle>
            <span className={styles.titleRow}>
              <Inbox size={15} />
              Pending ({pending.length})
            </span>
          </CardTitle>
          {pending.length === 0 ? (
            <EmptyState title="No pending requests" hint="Requests appear here when a child asks for access." />
          ) : (
            <ul className={styles.list}>
              {pending.map((r) => (
                <li key={r.id} className={styles.item}>
                  <div className={styles.itemMain}>
                    <p className={styles.resource}>{r.resourceIdentifier}</p>
                    <p className={styles.reason}>“{r.reason}”</p>
                    <p className={styles.meta}>
                      {r.deviceName} · {fmtDateTime(r.createdAt)}
                    </p>
                  </div>
                  <div className={styles.itemActions}>
                    <Button
                      variant="primary"
                      busy={busy === r.id}
                      onClick={() => decide(r.id, "approved")}
                    >
                      <Check size={14} />
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      busy={busy === r.id}
                      onClick={() => decide(r.id, "denied")}
                    >
                      <X size={14} />
                      Deny
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <ErrorNote message={error} />
        </Card>

        <Card>
          <CardTitle>Decided</CardTitle>
          {decided.length === 0 ? (
            <EmptyState title="Nothing decided yet" />
          ) : (
            <ul className={styles.list}>
              {decided.map((r) => (
                <li key={r.id} className={styles.item}>
                  <div className={styles.itemMain}>
                    <p className={styles.resource}>
                      {r.resourceIdentifier}{" "}
                      <Badge tone={r.status === "approved" ? "ok" : r.status === "denied" ? "danger" : "neutral"}>
                        {r.status}
                      </Badge>
                    </p>
                    {r.status === "approved" && r.expiresAt ? (
                      <p className={styles.meta}>Grant expires {fmtDateTime(r.expiresAt)}</p>
                    ) : null}
                    <p className={styles.meta}>
                      {r.deviceName} · decided {fmtDateTime(r.decidedAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
