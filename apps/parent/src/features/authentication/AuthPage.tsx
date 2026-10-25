import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { useApp } from "../../app/store";
import { Button, ErrorNote, Field, TextInput } from "../../components/ui";
import styles from "./AuthPage.module.css";

type Mode = "login" | "register";

export function AuthPage() {
  const { user, login, register } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/family" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "register" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "register") {
        await register(email, password);
      } else {
        await login(email, password);
      }
      navigate("/family", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setConfirm("");
  }

  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>
            <Shield size={22} />
          </span>
          <h1 className={styles.title}>EntroGuard Family</h1>
          <p className={styles.subtitle}>
            Privacy-first parental controls for your family.
          </p>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={mode === "login" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => switchMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "register" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => switchMode("register")}
          >
            Create account
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <Field label="Email">
            <TextInput
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password">
            <TextInput
              type="password"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {mode === "register" ? (
            <Field label="Confirm password">
              <TextInput
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
          ) : null}
          <ErrorNote message={error} />
          <Button type="submit" variant="primary" busy={busy}>
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className={styles.note}>
          Demo build: authentication is simulated locally. No data leaves this
          device.
        </p>
      </div>
    </div>
  );
}
