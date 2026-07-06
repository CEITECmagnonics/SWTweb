/** Small shared UI primitives. */
import { useMemo, useState, type ReactNode } from 'react';
import katex from 'katex';

export function Formula({ latex, display = false }: { latex: string; display?: boolean }) {
  const html = useMemo(
    () => katex.renderToString(latex, { displayMode: display, throwOnError: false }),
    [latex, display],
  );
  return (
    <span
      className={display ? 'block overflow-x-auto py-1' : ''}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function Section({
  title,
  children,
  defaultOpen = true,
  right,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  right?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-slate-200 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
      >
        <span>{title}</span>
        <span className="flex items-center gap-2">
          {right}
          <svg
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

export function FieldRow({
  label,
  symbol,
  unit,
  tooltip,
  children,
}: {
  label: string;
  symbol?: string;
  unit?: string;
  tooltip?: string;
  children: ReactNode;
}) {
  return (
    <label className="mb-2 block" title={tooltip}>
      <span className="mb-0.5 flex items-baseline gap-1.5 text-xs text-slate-600 dark:text-slate-400">
        {symbol && <Formula latex={symbol} />}
        <span>{label}</span>
        {unit && <span className="text-slate-400 dark:text-slate-500">({unit})</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 ' +
  'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ' +
  'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export function NumberInput({
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
  nullable = false,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  nullable?: boolean;
}) {
  return (
    <input
      type="number"
      className={inputClass}
      value={value ?? ''}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step ?? 'any'}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          onChange(nullable ? null : null);
          return;
        }
        const num = Number(raw);
        if (Number.isFinite(num)) onChange(num);
      }}
    />
  );
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  title,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const styles = {
    primary:
      'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-400 dark:disabled:bg-slate-700',
    secondary:
      'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
    danger: 'border border-red-300 bg-white text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-slate-900 dark:hover:bg-red-950',
    ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200',
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
