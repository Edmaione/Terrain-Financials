import type { ReactNode } from 'react';

const styles: Record<string, string> = {
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  info: 'border-slate-200 bg-slate-50 text-slate-900',
};

export default function AlertBanner({
  variant = 'info',
  title,
  message,
  actions,
}: {
  variant?: 'error' | 'success' | 'info';
  title?: string;
  message: string;
  actions?: ReactNode;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${styles[variant]}`}>
      {title && <p className="font-semibold">{title}</p>}
      <p className={title ? 'mt-1' : undefined}>{message}</p>
      {actions && <div className="mt-3">{actions}</div>}
    </div>
  );
}
