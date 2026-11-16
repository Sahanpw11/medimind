import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronDown, Plus, Search, Stethoscope } from 'lucide-react';
import { api } from '../lib/api';
import type { Notice, Role } from '../lib/types';

/** Click-outside / Escape aware popover. Panel content is only in the DOM while open. */
export function Popover({ label, trigger, className, align = 'end', children }: { label: string; trigger: ReactNode; className?: string; align?: 'start' | 'end'; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <div className="pop" ref={ref}>
      <button type="button" className={className} aria-haspopup="true" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>{trigger}</button>
      {open && <div className={`pop-panel ${align}`}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

const QUICK: Record<Role, { label: string; to: string }[]> = {
  patient: [{ label: 'Book an appointment', to: '/doctors' }, { label: 'Upload a document', to: '/documents' }, { label: 'Ask the assistant', to: '/assistant' }],
  doctor: [{ label: 'Record a visit', to: '/schedule' }, { label: "Today's agenda", to: '/dashboard' }],
  admin: [{ label: 'Add a doctor', to: '/admin/doctors' }, { label: 'View analytics', to: '/admin' }],
};

export function NewMenu({ role }: { role: Role }) {
  return (
    <Popover label="Create new" className="btn-new" trigger={<><Plus className="icon" aria-hidden /><span className="lbl">New</span><ChevronDown className="icon" aria-hidden /></>}>
      {(close) => QUICK[role].map((q) => <Link key={q.to} to={q.to} className="mi" onClick={close}>{q.label}</Link>)}
    </Popover>
  );
}

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`; if (m < 1440) return `${Math.floor(m / 60)} h ago`; return `${Math.floor(m / 1440)} d ago`;
}

export function Bell_() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ data: Notice[]; unread: number }>('/notifications'), refetchInterval: 60_000 });
  const read = useMutation({ mutationFn: () => api('/notifications/read', { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const unread = q.data?.unread ?? 0;
  return (
    <Popover label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="icon-btn" trigger={<><Bell className="icon" aria-hidden />{unread > 0 && <span className="badge num">{unread > 9 ? '9+' : unread}</span>}</>}>
      {() => (
        <div className="notice-panel">
          <div className="notice-head"><b>Notifications</b>{unread > 0 && <button type="button" className="linkish" onClick={() => read.mutate()}>Mark all as read</button>}</div>
          {q.isPending ? <p className="notice-empty">Loading</p> : q.data && q.data.data.length === 0 ? <p className="notice-empty">Nothing yet. Booking activity will appear here.</p> : q.data?.data.map((n) => (
            <div key={n._id} className={`notice${n.status === 'unread' ? ' unread' : ''}`}><span>{n.message}</span><small>{ago(n.createdAt)}</small></div>
          ))}
          {q.isError && <p className="notice-empty">Could not load notifications.</p>}
        </div>
      )}
    </Popover>
  );
}

interface Dest { label: string; to: string }

export function HeaderSearch({ role, destinations }: { role: Role; destinations: Dest[] }) {
  const nav = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [v, setV] = useState(''), [focus, setFocus] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); } };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, []);
  const term = v.trim();
  const pages = term ? destinations.filter((d) => d.label.toLowerCase().includes(term.toLowerCase())) : destinations;
  const results: (Dest & { icon?: boolean })[] = [
    ...(term && role !== 'doctor' ? [{ label: `Search doctors for "${term}"`, to: `${role === 'admin' ? '/admin/doctors' : '/doctors'}?q=${encodeURIComponent(term)}`, icon: true }] : []),
    ...pages,
  ];
  const go = (to: string) => { nav(to); setV(''); setFocus(false); input.current?.blur(); };
  return (
    <div className="hsearch">
      <Search className="icon" aria-hidden />
      <input ref={input} type="search" aria-label="Search or jump to a page" placeholder="Search or jump to..." value={v} autoComplete="off"
        onChange={(e) => setV(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 120)}
        onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) go(results[0].to); if (e.key === 'Escape') { setV(''); input.current?.blur(); } }} />
      {focus && results.length > 0 && (
        <div className="pop-panel start search-results" role="listbox" aria-label="Results">
          {results.map((r) => <button key={r.to} type="button" role="option" aria-selected="false" className="mi" onMouseDown={(e) => { e.preventDefault(); go(r.to); }}>{r.icon ? <Stethoscope className="icon" aria-hidden /> : null}{r.label}</button>)}
        </div>
      )}
    </div>
  );
}
