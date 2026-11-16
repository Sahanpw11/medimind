import { useEffect, useId, type ComponentProps, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CalendarClock, Check, CheckCircle2, ChevronLeft, ChevronRight, Info, UserX, XCircle } from 'lucide-react';
import { ApiError } from '../lib/api';
import { STATUS_LABEL } from '../lib/format';
import type { Status } from '../lib/types';

export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label="MediMind">
      <rect width="64" height="64" rx="14" fill="#00798C" />
      <polyline points="13,46 13,19 32,38 51,19 51,46" fill="none" stroke="#fff" strokeWidth="5.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Page frame: breadcrumb, title, optional actions. Content fills the available width (grid regions decide the columns). */
export function Screen({ title, subtitle, back, action, children }: { title: string; subtitle?: string; back?: { to: string; label: string }; action?: ReactNode; wide?: boolean; children: ReactNode }) {
  useEffect(() => { document.title = `${title} | MediMind`; }, [title]);
  return (
    <>
      <div className="page-head">
        <div>
          {back && <Link to={back.to} className="crumb"><ChevronLeft className="icon" aria-hidden />{back.label}</Link>}
          <h1>{title}</h1>
          {subtitle && <p className="sub">{subtitle}</p>}
        </div>
        {action && <div className="page-actions">{action}</div>}
      </div>
      {children}
    </>
  );
}

export function Avatar({ name, large }: { name: string; large?: boolean }) {
  const initials = name.replace(/^dr\.?\s+/i, '').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  return <span className={`avatar${large ? ' lg' : ''}`} aria-hidden>{initials || '?'}</span>;
}

export const Card = ({ title, hint, action, flush, children }: { title?: string; hint?: string; action?: ReactNode; flush?: boolean; children: ReactNode }) => (
  <section className="card" aria-label={title}>
    {title && <div className="card-head"><div><h2>{title}</h2>{hint && <p className="hint">{hint}</p>}</div>{action}</div>}
    <div className={`card-body${flush ? ' flush' : ''}`}>{children}</div>
  </section>
);

export function LinkRow({ to, icon, title, sub, detail }: { to: string; icon?: ReactNode; title: string; sub?: string; detail?: ReactNode }) {
  return (
    <Link to={to} className="row">
      {icon && <span className="row-icon">{icon}</span>}
      <span className="row-main"><span className="row-title">{title}</span>{sub && <span className="row-sub">{sub}</span>}</span>
      {detail && <span className="row-detail">{detail}</span>}
      <ChevronRight className="icon chev" aria-hidden />
    </Link>
  );
}

const STATUS_ICON = { booked: CalendarClock, confirmed: CheckCircle2, completed: Check, cancelled: XCircle, no_show: UserX } as const;
export function StatusChip({ status }: { status: Status }) {
  const I = STATUS_ICON[status];
  return <span className={`chip ${status}`}><I className="icon" aria-hidden />{STATUS_LABEL[status]}</span>;
}

export function Button({ loading, children, variant, compact, ...rest }: ComponentProps<'button'> & { loading?: boolean; variant?: 'secondary' | 'plain' | 'danger'; compact?: boolean }) {
  return (
    <button {...rest} className={`btn ${variant ?? ''} ${compact ? 'compact' : ''} ${rest.className ?? ''}`} disabled={rest.disabled || loading} aria-busy={loading || undefined}>
      {loading && <span className="spinner" aria-hidden />}{children}
    </button>
  );
}

export function TextField({ label, error, hint, ...rest }: ComponentProps<'input'> & { label: string; error?: string; hint?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-e` : hint ? `${id}-h` : undefined} {...rest} />
      {error ? <p className="field-error" id={`${id}-e`} role="alert">{error}</p> : hint ? <p className="group-foot" id={`${id}-h`} style={{ padding: '0 4px' }}>{hint}</p> : null}
    </div>
  );
}

export function SelectField({ label, error, children, ...rest }: ComponentProps<'select'> & { label: string; error?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="select" aria-invalid={!!error || undefined} {...rest}>{children}</select>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange(v: NoInfer<T>): void; options: { value: NoInfer<T>; label: string }[]; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}

export function Banner({ kind = 'info', title, children, action }: { kind?: 'info' | 'error' | 'emergency' | 'success'; title?: string; children?: ReactNode; action?: ReactNode }) {
  const I = kind === 'info' ? Info : kind === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div className={`banner ${kind}`} role={kind === 'info' || kind === 'success' ? 'status' : 'alert'}>
      <I className="icon" aria-hidden />
      <div className="banner-text">{title && <strong>{title}</strong>}{children}</div>
      {action}
    </div>
  );
}

export const ErrorState = ({ error, retry }: { error: unknown; retry?: () => void }) => (
  <Banner kind="error" title={error instanceof ApiError && error.status === 0 ? 'You appear to be offline' : 'Could not load this'} action={retry && <Button compact variant="secondary" onClick={retry}>Retry</Button>}>
    {error instanceof Error ? error.message : 'Please try again.'}
  </Banner>
);

export const Empty = ({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) => (
  <div className="empty">{icon}<h3>{title}</h3>{children && <p>{children}</p>}{action}</div>
);

export function SkeletonRows({ n = 4 }: { n?: number }) {
  return (
    <div className="group" aria-busy="true" aria-label="Loading">
      {Array.from({ length: n }, (_, i) => (
        <div className="row" key={i}><div className="row-main"><div className="skel skel-row" style={{ width: `${55 + ((i * 17) % 35)}%` }} /><div className="skel skel-row" style={{ width: '35%', height: 14 }} /></div></div>
      ))}
    </div>
  );
}

export function LoadMore({ hasNext, loading, onClick }: { hasNext: boolean; loading: boolean; onClick(): void }) {
  return hasNext ? <div className="pager"><Button variant="secondary" compact loading={loading} onClick={onClick}>Load more</Button></div> : null;
}
