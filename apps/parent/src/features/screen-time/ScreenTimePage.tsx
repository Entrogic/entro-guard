import { useCallback, useEffect, useState } from "react";
import { Moon, Plus, Save, Trash2 } from "lucide-react";
import { useApp } from "../../app/store";
import type { AllowedWindow, DayOption, Policy, WindowDays } from "../../app/types";
import { DAY_OPTIONS, TIMEZONES, validatePolicy } from "../../app/validate";
import { fmtMinutes } from "../../app/format";
import {
  Button,
  Card,
  CardTitle,
  ErrorNote,
  Field,
  PageHeader,
  Select,
  SuccessNote,
  TextInput,
} from "../../components/ui";
import styles from "./ScreenTimePage.module.css";

function clonePolicy(policy: Policy): Policy {
  return {
    ...policy,
    website: { ...policy.website },
    screen_time: {
      ...policy.screen_time,
      bedtime: policy.screen_time.bedtime ? { ...policy.screen_time.bedtime } : null,
      allowed_windows: policy.screen_time.allowed_windows.map((w) => ({ ...w })),
    },
    apps: { ...policy.apps, rules: [...policy.apps.rules] },
  };
}

const EMPTY_WINDOW: AllowedWindow = { days: "weekdays", start: "06:00", end: "21:00" };

export function ScreenTimePage() {
  const { backend } = useApp();
  const [draft, setDraft] = useState<Policy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const p = await backend.getPolicy();
    setDraft(p ? clonePolicy(p) : null);
  }, [backend]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!draft) return null;

  function updateScreenTime(patch: Partial<Policy["screen_time"]>) {
    setDraft({ ...draft!, screen_time: { ...draft!.screen_time, ...patch } });
  }

  function updateBedtime(patch: Partial<NonNullable<Policy["screen_time"]["bedtime"]>>) {
    const bedtime = draft!.screen_time.bedtime ?? { enabled: true, start: "21:00", end: "07:00" };
    updateScreenTime({ bedtime: { ...bedtime, ...patch } });
  }

  function updateWindow(index: number, patch: Partial<AllowedWindow>) {
    const windows = draft!.screen_time.allowed_windows.map((w, i) => (i === index ? { ...w, ...patch } : w));
    updateScreenTime({ allowed_windows: windows });
  }

  function setWindowDays(index: number, days: WindowDays) {
    updateWindow(index, { days });
  }

  function parseDayOptions(raw: string[]): DayOption[] {
    return raw.filter((d): d is DayOption => DAY_OPTIONS.some((o) => o.value === d));
  }

  async function save() {
    if (!draft) return;
    setError(null);
    setSuccess(null);
    const errors = validatePolicy(draft);
    if (errors.length > 0) {
      setError(errors.join(" "));
      return;
    }
    setBusy(true);
    try {
      const saved = await backend.updatePolicy(draft);
      setDraft(clonePolicy(saved));
      setSuccess(`Screen-time settings saved as policy version ${saved.version}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save policy.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Screen time"
        subtitle="Daily budgets, bedtime, and allowed usage windows. Schedules use the selected IANA timezone."
        actions={
          <Button variant="primary" busy={busy} onClick={save}>
            <Save size={14} />
            Save policy
          </Button>
        }
      />

      <div className={styles.layout}>
        <div className={styles.col}>
          <Card>
            <CardTitle>Daily limit</CardTitle>
            <div className={styles.limitRow}>
              <Field label="Minutes per day (0 = unlimited)" hint={fmtMinutes(draft.screen_time.daily_limit_minutes)}>
                <TextInput
                  type="number"
                  min={0}
                  max={1440}
                  value={draft.screen_time.daily_limit_minutes}
                  onChange={(e) =>
                    updateScreenTime({
                      daily_limit_minutes: Math.max(0, Math.min(1440, Number(e.target.value) || 0)),
                    })
                  }
                />
              </Field>
              <Field label="Timezone">
                <Select
                  value={draft.timezone}
                  onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card>
            <CardTitle>
              <span className={styles.titleRow}>
                <Moon size={15} />
                Bedtime
              </span>
            </CardTitle>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={draft.screen_time.bedtime?.enabled ?? false}
                onChange={(e) => updateBedtime({ enabled: e.target.checked })}
              />
              Enforce bedtime
            </label>
            {draft.screen_time.bedtime?.enabled ? (
              <div className={styles.timeRow}>
                <Field label="Starts at">
                  <TextInput
                    type="time"
                    value={draft.screen_time.bedtime.start}
                    onChange={(e) => updateBedtime({ start: e.target.value })}
                  />
                </Field>
                <Field label="Ends at" hint="Overnight windows such as 21:00 to 07:00 are supported.">
                  <TextInput
                    type="time"
                    value={draft.screen_time.bedtime.end}
                    onChange={(e) => updateBedtime({ end: e.target.value })}
                  />
                </Field>
              </div>
            ) : null}
          </Card>
        </div>

        <Card>
          <CardTitle>Allowed windows</CardTitle>
          <p className={styles.hint}>
            When at least one window exists, usage is only allowed inside a
            window and outside bedtime. Leave empty to allow all day.
          </p>
          {draft.screen_time.allowed_windows.length === 0 ? (
            <p className={styles.hint}>No windows configured — all day is allowed.</p>
          ) : (
            <div className={styles.windowList}>
              {draft.screen_time.allowed_windows.map((w, i) => (
                <div key={i} className={styles.windowRow}>
                  <Field label="Days">
                    <select
                      className={styles.daysSelect}
                      multiple
                      size={7}
                      value={Array.isArray(w.days) ? w.days : []}
                      onChange={(e) => {
                        const selected = parseDayOptions(Array.from(e.target.selectedOptions, (o) => o.value));
                        setWindowDays(i, selected.length === 7 ? "all" : selected);
                      }}
                    >
                      {DAY_OPTIONS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className={styles.windowTimes}>
                    <Field label="Start">
                      <TextInput
                        type="time"
                        value={w.start}
                        onChange={(e) => updateWindow(i, { start: e.target.value })}
                      />
                    </Field>
                    <Field label="End">
                      <TextInput
                        type="time"
                        value={w.end}
                        onChange={(e) => updateWindow(i, { end: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      updateScreenTime({
                        allowed_windows: draft.screen_time.allowed_windows.filter((_, j) => j !== i),
                      })
                    }
                    aria-label="Remove window"
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button
            variant="secondary"
            onClick={() => updateScreenTime({ allowed_windows: [...draft.screen_time.allowed_windows, { ...EMPTY_WINDOW }] })}
          >
            <Plus size={14} />
            Add window
          </Button>
        </Card>
      </div>

      <div className={styles.footer}>
        <ErrorNote message={error} />
        <SuccessNote message={success} />
      </div>
    </div>
  );
}
