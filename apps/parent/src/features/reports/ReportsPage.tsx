import { useCallback, useEffect, useState } from "react";
import { BarChart3, ScrollText } from "lucide-react";
import { useApp } from "../../app/store";
import type { AuditEvent, Policy, UsageSummary } from "../../app/types";
import { fmtDateTime } from "../../app/format";
import { Badge, Card, CardTitle, PageHeader } from "../../components/ui";
import styles from "./ReportsPage.module.css";

export function ReportsPage() {
  const { backend } = useApp();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [usage, setUsage] = useState<UsageSummary[]>([]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [e, u, p] = await Promise.all([
      backend.getAuditEvents(),
      backend.getUsageSummary(),
      backend.getPolicy(),
    ]);
    setEvents(e);
    setUsage(u);
    setPolicy(p);
    setLoading(false);
  }, [backend]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return null;

  return (
    <div>
      <PageHeader
        title="Reports & audit"
        subtitle="Privacy-conscious summaries. Full browsing history is never stored by default."
      />

      <div className={styles.layout}>
        <Card>
          <CardTitle>
            <span className={styles.titleRow}>
              <BarChart3 size={15} />
              Screen time today
            </span>
          </CardTitle>
          {usage.length === 0 ? (
            <p className={styles.hint}>No usage reported yet.</p>
          ) : (
            <ul className={styles.usageList}>
              {usage.map((u) => {
                const limit = policy?.screen_time.daily_limit_minutes ?? 0;
                const pct = limit > 0 ? Math.min(100, Math.round((u.minutesUsed / limit) * 100)) : Math.min(100, (u.minutesUsed / 180) * 100);
                const over = limit > 0 && u.minutesUsed >= limit;
                return (
                  <li key={u.deviceId} className={styles.usageItem}>
                    <div className={styles.usageHead}>
                      <p className={styles.usageName}>{u.deviceName}</p>
                      <p className={styles.usageValue}>
                        {Math.floor(u.minutesUsed / 60)}h {u.minutesUsed % 60}m
                        {limit > 0 ? (
                          <>
                            {" "}
                            of {Math.floor(limit / 60)}h {limit % 60}m
                          </>
                        ) : (
                          <> (no limit)</>
                        )}
                        {over ? <Badge tone="danger">limit reached</Badge> : null}
                      </p>
                    </div>
                    <div className={styles.bar}>
                      <div
                        className={over ? `${styles.barFill} ${styles.barOver}` : styles.barFill}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>
            <span className={styles.titleRow}>
              <ScrollText size={15} />
              Audit log
            </span>
          </CardTitle>
          {events.length === 0 ? (
            <p className={styles.hint}>No audit events.</p>
          ) : (
            <table className={styles.table}>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className={styles.eventType}>{e.eventType}</td>
                    <td className={styles.eventMeta}>{e.metadata}</td>
                    <td className={styles.eventAt}>{fmtDateTime(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
