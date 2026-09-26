// Legacy component API, now drawn with the design system tokens so every
// screen shares one look. New code should prefer components/ui directly.
import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn, getInitials } from "../../lib/utils";
import { buttonClasses } from "../ui/buttonClasses";
import { StatusBadge } from "../ui/StatusBadge";
import { IconChip } from "../ui/IconChip";
import { EmptyState as DsEmptyState } from "../ui/EmptyState";
import { TONES, avatarTone } from "../../lib/tones";
import { JOB_STATUS, RESPONSE_STATUS } from "../../lib/jobs";

const BUTTON_VARIANTS = { primary: "primary", secondary: "secondary", outline: "secondary", ghost: "ghost", danger: "danger", success: "success" };

export function Button({ children, variant = "primary", size = "md", className, loading, disabled, type = "button", ...props }) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant: BUTTON_VARIANTS[variant] || "primary", size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />}
      {children}
    </button>
  );
}

// `label` is aria-only (sets aria-label on the switch button) - it renders
// no visible text. A caller that needs a visible label renders its own
// next to the Toggle, as ProfileSettings.jsx does.
export function Toggle({ checked, onChange, disabled, label, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        checked ? "bg-brand" : "bg-line-strong",
        className,
      )}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-[#fff] shadow-sm transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

/** Status pill for jobs, proposals and invites. */
export function Badge({ status, children, className }) {
  const meta = JOB_STATUS[status] || RESPONSE_STATUS[status] || { label: status, tone: "slate" };
  return <StatusBadge tone={meta.tone} className={className}>{children || meta.label}</StatusBadge>;
}

export function Avatar({ name, src, size = "md", className }) {
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-base", xl: "h-20 w-20 text-xl" };
  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ring-1 ring-inset", TONES[avatarTone(name)].chip, sizes[size], className)}>
      {src ? <img src={src} alt={name ? `${name}` : ""} className="h-full w-full object-cover" /> : getInitials(name)}
    </div>
  );
}

const STAT_TONES = { sky: "sky", violet: "violet", emerald: "emerald", amber: "amber", rose: "rose", indigo: "indigo" };

export function StatCard({ icon: Icon, label, value, sub, color = "sky", className }) {
  return (
    <div className={cn("rounded-card border border-line/80 bg-surface p-4 shadow-card sm:p-5", className)}>
      <IconChip icon={Icon} tone={STAT_TONES[color] || "sky"} />
      <p className="mt-4 text-[13px] font-medium text-fg-muted">{label}</p>
      <p className="mt-0.5 whitespace-nowrap text-[22px] font-bold leading-tight tracking-tight text-fg tabular-nums sm:text-[26px]">{value ?? "—"}</p>
      {sub && <p className="mt-1 text-xs text-fg-subtle">{sub}</p>}
    </div>
  );
}

export function Card({ children, className, ...props }) {
  return (
    <div className={cn("rounded-card border border-line/80 bg-surface shadow-card", className)} {...props}>
      {children}
    </div>
  );
}

const FIELD_LABEL = "block text-sm font-medium text-fg";
const FIELD_ERROR = "text-xs font-medium text-rose-600 dark:text-rose-400";

export function Input({ label, error, hint, className, id, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={inputId} className={FIELD_LABEL}>{label}</label>}
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn("fixly-input", error && "fixly-input-error", className)}
        {...props}
      />
      {error ? <p id={errorId} role="alert" className={FIELD_ERROR}>{error}</p> : hint ? <p id={hintId} className="text-xs text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

export function Textarea({ label, error, hint, className, id, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={inputId} className={FIELD_LABEL}>{label}</label>}
      <textarea
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn("fixly-input min-h-[5.5rem] resize-y py-2.5", error && "fixly-input-error", className)}
        {...props}
      />
      {error ? <p id={errorId} role="alert" className={FIELD_ERROR}>{error}</p> : hint ? <p id={hintId} className="text-xs text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

export function Select({ label, error, hint, className, children, id, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  return (
    <div className="space-y-1.5">
      {label && <label htmlFor={inputId} className={FIELD_LABEL}>{label}</label>}
      <select
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={cn("fixly-input fixly-select", error && "fixly-input-error", className)}
        {...props}
      >
        {children}
      </select>
      {error ? <p id={errorId} role="alert" className={FIELD_ERROR}>{error}</p> : hint ? <p className="text-xs text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

export function Spinner({ className }) {
  return <div className={cn("h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand", className)} role="status" aria-label="Loading" />;
}

export function EmptyState({ icon, title, description, action }) {
  return <DsEmptyState icon={icon} title={title} description={description} action={action} />;
}

export function PageHeader({ title, description, action }) {
  return (
    <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {action && <div className="w-full shrink-0 sm:w-auto [&>a]:block [&_button]:w-full sm:[&_button]:w-auto">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = "max-w-lg" }) {
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Runs only when the modal opens or closes, so parent re-renders never
  // steal focus from a field the user is typing in.
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onCloseRef.current?.();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn("relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-overlay border border-line bg-surface shadow-overlay sm:rounded-overlay", width)}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-fg">{title}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="-mr-2 flex h-9 w-9 items-center justify-center rounded-control text-fg-subtle hover:bg-subtle hover:text-fg [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

export function StarRating({ rating, size = "sm" }) {
  const sizes = { sm: "h-3.5 w-3.5", md: "h-5 w-5" };
  const value = Number(rating) || 0;
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={value > 0 ? `${value.toFixed(1)} out of 5 stars` : "No rating yet"}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={cn(sizes[size], i <= Math.round(value) ? "text-amber-400" : "text-line-strong")} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      {value > 0 && <span className="ml-1 text-xs font-medium text-fg-muted" aria-hidden="true">{value.toFixed(1)}</span>}
    </div>
  );
}
