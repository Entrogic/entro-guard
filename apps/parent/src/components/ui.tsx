import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { X } from "lucide-react";
import styles from "./ui.module.css";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`${styles.card} ${className}`}>{children}</section>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className={styles.cardTitle}>{children}</h2>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageTitle}>{title}</h1>
        {subtitle ? <p className={styles.pageSubtitle}>{subtitle}</p> : null}
      </div>
      {actions ? <div className={styles.pageActions}>{actions}</div> : null}
    </header>
  );
}

type BadgeTone = "ok" | "warn" | "danger" | "neutral" | "accent";

const toneClass: Record<BadgeTone, string> = {
  ok: styles.badgeOk,
  warn: styles.badgeWarn,
  danger: styles.badgeDanger,
  neutral: styles.badgeNeutral,
  accent: styles.badgeAccent,
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`${styles.badge} ${toneClass[tone]}`}>{children}</span>;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  busy?: boolean;
}

export function Button({
  variant = "secondary",
  busy = false,
  className = "",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const variantClass = {
    primary: styles.btnPrimary,
    secondary: styles.btnSecondary,
    danger: styles.btnDanger,
    ghost: styles.btnGhost,
  }[variant];
  return (
    <button
      className={`${styles.btn} ${variantClass} ${className}`}
      disabled={disabled || busy}
      {...rest}
    >
      {busy ? <span className={styles.spinner} /> : null}
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
      {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`${styles.input} ${className}`} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return <select className={`${styles.input} ${className}`} {...rest} />;
}

export function Chip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className={styles.chip}>
      {label}
      {onRemove ? (
        <button
          type="button"
          className={styles.chipRemove}
          onClick={onRemove}
          aria-label={`Remove ${label}`}
        >
          <X size={12} />
        </button>
      ) : null}
    </span>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.modalHeader}>
          <h2 className={styles.cardTitle}>{title}</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className={styles.errorNote}>{message}</p>;
}

export function SuccessNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className={styles.successNote}>{message}</p>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{title}</p>
      {hint ? <p className={styles.emptyHint}>{hint}</p> : null}
    </div>
  );
}
