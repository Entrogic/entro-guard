import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppWindow, Plus, Save, Trash2 } from "lucide-react";
import { useApp } from "../../app/store";
import type { AppAction, Policy } from "../../app/types";
import { validatePolicy } from "../../app/validate";
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
import styles from "./AppRestrictionsPage.module.css";

function clonePolicy(policy: Policy): Policy {
  return {
    ...policy,
    website: { ...policy.website },
    screen_time: { ...policy.screen_time },
    apps: { ...policy.apps, rules: policy.apps.rules.map((r) => ({ ...r })) },
  };
}

export function AppRestrictionsPage() {
  const { backend } = useApp();
  const [draft, setDraft] = useState<Policy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [appId, setAppId] = useState("");
  const [appAction, setAppAction] = useState<AppAction>("block");

  const load = useCallback(async () => {
    const p = await backend.getPolicy();
    setDraft(p ? clonePolicy(p) : null);
  }, [backend]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!draft) return null;

  function addRule(e: FormEvent) {
    e.preventDefault();
    const id = appId.trim();
    if (!id) return;
    setError(null);
    if (draft!.apps.rules.some((r) => r.app_id === id)) {
      setError(`"${id}" already has a rule.`);
      return;
    }
    setDraft({ ...draft!, apps: { ...draft!.apps, rules: [...draft!.apps.rules, { app_id: id, action: appAction }] } });
    setAppId("");
  }

  function removeRule(appIdToRemove: string) {
    setDraft({
      ...draft!,
      apps: { ...draft!.apps, rules: draft!.apps.rules.filter((r) => r.app_id !== appIdToRemove) },
    });
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
      setSuccess(`App restrictions saved as policy version ${saved.version}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save policy.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="App restrictions"
        subtitle="Restrictions are capability-driven and only enforced where the platform supports them."
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
            <CardTitle>
              <span className={styles.titleRow}>
                <AppWindow size={15} />
                Rules
              </span>
            </CardTitle>
            <form className={styles.addRow} onSubmit={addRule}>
              <Field label="Package / bundle id">
                <TextInput
                  placeholder="e.g. com.example.app"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                />
              </Field>
              <Field label="Action">
                <Select value={appAction} onChange={(e) => setAppAction(e.target.value as AppAction)}>
                  <option value="block">Block</option>
                  <option value="allow">Allow</option>
                </Select>
              </Field>
              <Button type="submit" variant="primary" className={styles.addBtn}>
                <Plus size={14} />
                Add rule
              </Button>
            </form>

            {draft.apps.rules.length === 0 ? (
              <p className={styles.hint}>No app rules yet.</p>
            ) : (
              <ul className={styles.ruleList}>
                {draft.apps.rules.map((rule) => (
                  <li key={rule.app_id} className={styles.ruleRow}>
                    <code className={styles.appId}>{rule.app_id}</code>
                    <span className={rule.action === "block" ? styles.actionBlock : styles.actionAllow}>
                      {rule.action}
                    </span>
                    <Button variant="ghost" onClick={() => removeRule(rule.app_id)} aria-label={`Remove ${rule.app_id}`}>
                      <Trash2 size={15} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>Unsupported platforms</CardTitle>
            <p className={styles.hint}>
              When a platform cannot enforce app restrictions, the child app
              reports them as unsupported. The dashboard never shows
              unenforced restrictions as applied.
            </p>
            <Field label="Behavior on unsupported platforms">
              <Select
                value={draft.apps.unsupported_behavior}
                onChange={(e) =>
                  setDraft({ ...draft!, apps: { ...draft!.apps, unsupported_behavior: e.target.value as Policy["apps"]["unsupported_behavior"] } })
                }
              >
                <option value="report_only">Report only</option>
              </Select>
            </Field>
          </Card>
        </div>

        <Card>
          <CardTitle>Platform support</CardTitle>
          <ul className={styles.supportList}>
            <li>
              <strong>Android</strong>
              <p>
                Usage reporting may require Usage Access authorization.
                Reliable suspension of other apps may require device-owner
                provisioning or supported device-policy APIs.
              </p>
            </li>
            <li>
              <strong>iOS</strong>
              <p>
                App and category restrictions depend on Apple's Screen Time
                frameworks, authorization, entitlements, and supported OS
                versions.
              </p>
            </li>
          </ul>
        </Card>
      </div>

      <div className={styles.footer}>
        <ErrorNote message={error} />
        <SuccessNote message={success} />
      </div>
    </div>
  );
}
