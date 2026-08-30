import React, { useEffect, useId, useRef } from "react";
import { cn, getInitials, STATUS_LABELS, STATUS_COLORS } from "../../lib/utils";

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  loading,
  disabled,
  type = "button",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950";
  const variants = {
    primary: "bg-sky-600 hover:bg-sky-700 text-white",
    secondary:
      "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100",
    danger: "bg-red-500 hover:bg-red-600 text-white",
    outline:
      "border border-slate-200 hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-200",
    ghost:
      "hover:bg-slate-100 text-slate-600 dark:hover:bg-slate-800 dark:text-slate-300",
    success: "bg-emerald-500 hover:bg-emerald-600 text-white",
  };
  const sizes = {
    sm: "min-h-11 px-3 py-2 text-xs",
    md: "min-h-11 px-5 py-2.5 text-sm",
    lg: "min-h-12 px-6 py-3 text-base",
  };
  return (
    <button
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}

export function Badge({ status, children, className }) {
  const label = children || STATUS_LABELS[status] || status;
  const color = STATUS_COLORS[status] || "bg-slate-100 text-slate-600";
  return <span className={cn("status-badge", color, className)}>{label}</span>;
}

export function Avatar({ name, src, size = "md", className }) {
  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-base",
    xl: "w-20 h-20 text-xl",
  };
  return (
    <div
      className={cn(
        "rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300 font-bold flex items-center justify-center flex-shrink-0 overflow-hidden",
        sizes[size],
        className,
      )}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "sky",
  className,
}) {
  const colors = {
    sky: "fixly-tint-sky text-sky-600 dark:text-sky-300",
    violet:
      "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300",
    emerald: "fixly-tint-emerald text-emerald-600 dark:text-emerald-300",
    amber: "fixly-tint-amber text-amber-600 dark:text-amber-300",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300",
  };
  return (
    <div className={cn("fixly-card p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="text-2xl font-bold text-slate-900">{value ?? "-"}</p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-2xl",
            colors[color],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function Card({ children, className, ...props }) {
  return (
    <div className={cn("fixly-card", className)} {...props}>
      {children}
    </div>
  );
}

export function Input({ label, error, className, id, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "fixly-input",
          error && "border-red-400 focus:ring-red-400",
          className,
        )}
        {...props}
      />
      {error && <p id={errorId} role="alert" className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className, id, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "fixly-input resize-none",
          error && "border-red-400",
          className,
        )}
        {...props}
      />
      {error && <p id={errorId} role="alert" className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function Select({ label, error, className, children, id, ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}
      <select
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "fixly-input bg-white dark:bg-slate-900",
          error && "border-red-400",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p id={errorId} role="alert" className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function Spinner({ className }) {
  return (
    <div
      className={cn(
        "h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600 dark:border-slate-700",
        className,
      )}
    />
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
        <Icon className="h-7 w-7 text-slate-400" />
      </div>
      <h3 className="mb-1 font-semibold text-slate-800">{title}</h3>
      <p className="mb-6 max-w-xs text-sm text-slate-500">{description}</p>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, action }) {
  return (
    <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {action && <div className="w-full shrink-0 [&>a]:block [&_button]:w-full sm:w-auto sm:[&_button]:w-auto">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = "max-w-lg" }) {
  const closeRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-100 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:rounded-3xl",
          width,
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-6">
          <h2 id={titleId} className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close dialog"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6">{children}</div>
      </div>
    </div>
  );
}

export function StarRating({ rating, size = "sm" }) {
  const sizes = { sm: "w-3.5 h-3.5", md: "w-5 h-5" };
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={cn(
            sizes[size],
            i <= Math.round(rating)
              ? "text-amber-400"
              : "text-slate-200 dark:text-slate-700",
          )}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      {rating > 0 && (
        <span className="ml-1 text-xs text-slate-500">
          {Number(rating).toFixed(1)}
        </span>
      )}
    </div>
  );
}
