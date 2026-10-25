import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Globe, History, Send } from "lucide-react";
import { useApp } from "../../app/store";
import type { ContentCategory, Policy, PolicyVersionInfo, WebsiteAction } from "../../app/types";
import { CONTENT_CATEGORIES, isValidDomain, validatePolicy } from "../../app/validate";
import { fmtDateTime } from "../../app/format";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Chip,
  ErrorNote,
  PageHeader,
  SuccessNote,
  TextInput,
} from "../../components/ui";
import styles from "./WebsiteRulesPage.module.css";

function clonePolicy(policy: Policy): Policy {
  return {
    ...policy,
    website: {
      ...policy.website,
      blocked_domains: [...policy.website.blocked_domains],
      allowed_domains: [...policy.website.allowed_domains],
      categories_blocked: [...policy.website.categories_blocked],
    },
    screen_time: { ...policy.screen_time },
    apps: { ...policy.apps, rules: [...policy.apps.rules] },
  };
}

export function WebsiteRulesPage() {
  const { backend } = useApp();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [history, setHistory] = useState<PolicyVersionInfo[]>([]);
  const [draft, setDraft] = useState<Policy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [allowInput, setAllowInput] = useState("");

  const load = useCallback(async () => {
    const [p, h] = await Promise.all([backend.getPolicy(), backend.getPolicyHistory()]);
    setPolicy(p);
    setDraft(p ? clonePolicy(p) : null);
    setHistory(h);
  }, [backend]);

  useEffect(() => {
    void load();
  }, [load]);

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
      setPolicy(saved);
      setDraft(clonePolicy(saved));
      await load();
      setSuccess(`Policy saved as version ${saved.version}. Devices will fetch it on their next sync.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save policy.");
    } finally {
      setBusy(false);
    }
  }

  async function applyToDevices() {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await backend.applyPolicyToDevices();
      setSuccess("Policy applied to all enrolled devices.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply policy.");
    } finally {
      setBusy(false);
    }
  }

  if (!draft) return null;

  function addDomain(list: "blocked" | "allowed", value: string) {
    const current = draft!;
    const domain = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!isValidDomain(domain)) {
      setError(`"${domain}" is not a valid domain.`);
      return;
    }
    setError(null);
    const listName = list === "blocked" ? "blocked_domains" : "allowed_domains";
    if (current.website[listName].includes(domain)) {
      setError(`"${domain}" is already in the ${list}.`);
      return;
    }
    setDraft({
      ...current,
      website: { ...current.website, [listName]: [...current.website[listName], domain] },
    });
    if (list === "blocked") setDomainInput("");
    else setAllowInput("");
  }

  function removeDomain(list: "blocked" | "allowed", domain: string) {
    const current = draft!;
    const listName = list === "blocked" ? "blocked_domains" : "allowed_domains";
    setDraft({
      ...current,
      website: {
        ...current.website,
        [listName]: current.website[listName].filter((d) => d !== domain),
      },
    });
  }

  function toggleCategory(category: ContentCategory) {
    const current = draft!;
    const cats = current.website.categories_blocked;
    const next = cats.includes(category) ? cats.filter((c) => c !== category) : [...cats, category];
    setDraft({ ...current, website: { ...current.website, categories_blocked: next } });
  }

  function setDefaultAction(action: WebsiteAction) {
    const current = draft!;
    setDraft({ ...current, website: { ...current.website, default_action: action } });
  }

  return (
    <div>
      <PageHeader
        title="Website rules"
        subtitle="Blocking uses hostname boundaries, so a rule for example.com never matches notexample.com."
        actions={
          <>
            <Button variant="secondary" busy={busy} onClick={applyToDevices}>
              <Send size={14} />
              Apply to devices
            </Button>
            <Button variant="primary" busy={busy} onClick={save}>
              Save policy
            </Button>
          </>
        }
      />

      <div className={styles.layout}>
        <div className={styles.editorCol}>
          <Card>
            <CardTitle>Default action</CardTitle>
            <div className={styles.actionRow}>
              <label className={styles.radio}>
                <input
                  type="radio"
                  name="default-action"
                  checked={draft.website.default_action === "allow"}
                  onChange={() => setDefaultAction("allow")}
                />
                <div>
                  <p className={styles.radioTitle}>Allow unlisted sites</p>
                  <p className={styles.radioHint}>Blocked domains and categories are blocked; everything else is allowed.</p>
                </div>
              </label>
              <label className={styles.radio}>
                <input
                  type="radio"
                  name="default-action"
                  checked={draft.website.default_action === "block"}
                  onChange={() => setDefaultAction("block")}
                />
                <div>
                  <p className={styles.radioTitle}>Block unlisted sites</p>
                  <p className={styles.radioHint}>Only allowed domains are reachable. Strictest mode.</p>
                </div>
              </label>
            </div>
          </Card>

          <Card>
            <CardTitle>Blocklist</CardTitle>
            <DomainInput
              placeholder="Add a domain to block, e.g. example.com"
              value={domainInput}
              onChange={setDomainInput}
              onSubmit={(v) => addDomain("blocked", v)}
            />
            <DomainList domains={draft.website.blocked_domains} onRemove={(d) => removeDomain("blocked", d)} />
          </Card>

          <Card>
            <CardTitle>Allowlist</CardTitle>
            <p className={styles.cardHint}>
              The allowlist takes precedence over the blocklist and categories.
              Useful for always-allowed school sites.
            </p>
            <DomainInput
              placeholder="Add a domain to allow, e.g. school.example"
              value={allowInput}
              onChange={setAllowInput}
              onSubmit={(v) => addDomain("allowed", v)}
            />
            <DomainList domains={draft.website.allowed_domains} onRemove={(d) => removeDomain("allowed", d)} />
          </Card>

          <Card>
            <CardTitle>Content categories</CardTitle>
            <p className={styles.cardHint}>
              Category classification requires a category source. The MVP ships
              with adult, malware, and phishing categories.
            </p>
            <div className={styles.categoryRow}>
              {CONTENT_CATEGORIES.map(({ value, label }) => (
                <label key={value} className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={draft.website.categories_blocked.includes(value)}
                    onChange={() => toggleCategory(value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </Card>

          <div className={styles.saveBar}>
            <ErrorNote message={error} />
            <SuccessNote message={success} />
          </div>
        </div>

        <div className={styles.historyCol}>
          <Card>
            <CardTitle>
              <span className={styles.cardTitleRow}>
                <History size={15} />
                Policy history
              </span>
            </CardTitle>
            <ul className={styles.historyList}>
              {history.map((h) => (
                <li key={h.version} className={styles.historyItem}>
                  <Badge tone={h.version === policy?.version ? "accent" : "neutral"}>v{h.version}</Badge>
                  <div>
                    <p className={styles.historyBy}>{h.createdBy}</p>
                    <p className={styles.historyAt}>{fmtDateTime(h.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardTitle>
              <span className={styles.cardTitleRow}>
                <Globe size={15} />
                Matching
              </span>
            </CardTitle>
            <p className={styles.cardHint}>
              Rules match a hostname when it equals the rule domain or is a
              subdomain of it. Subdomain rules match only that exact subdomain.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DomainInput({
  placeholder,
  value,
  onChange,
  onSubmit,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
}) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (value.trim()) onSubmit(value);
  }
  return (
    <form className={styles.domainInput} onSubmit={handleSubmit}>
      <TextInput placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      <Button type="submit" variant="primary">
        Add
      </Button>
    </form>
  );
}

function DomainList({
  domains,
  onRemove,
}: {
  domains: string[];
  onRemove: (d: string) => void;
}) {
  if (domains.length === 0) {
    return <p className={styles.emptyList}>No domains yet.</p>;
  }
  return (
    <div className={styles.domainList}>
      {domains.map((d) => (
        <Chip key={d} label={d} onRemove={() => onRemove(d)} />
      ))}
    </div>
  );
}
