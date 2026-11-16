import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Search, Trash2, UserPlus } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { daysLabel } from '../../lib/format';
import type { Doctor, Page } from '../../lib/types';
import { Avatar, Banner, Button, Card, Empty, ErrorState, LoadMore, Screen, SelectField, SkeletonRows, TextField } from '../../components/ui';

const PRESETS = { weekdays: [1, 2, 3, 4, 5], mwf: [1, 3, 5] } as const;
const avail = (days: readonly number[]) => days.map((dayOfWeek) => ({ dayOfWeek, start: '09:00', end: '17:00' }));

function RowItem({ d }: { d: Doctor }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false), [specialty, setSpecialty] = useState(d.specialty), [preset, setPreset] = useState<keyof typeof PRESETS>('weekdays');
  const save = useMutation({
    mutationFn: () => api(`/doctors/${d._id}`, { method: 'PUT', body: { specialty, availability: avail(PRESETS[preset]) } }),
    onSuccess: () => { setOpen(false); void qc.invalidateQueries({ queryKey: ['admin-doctors'] }); },
  });
  const [confirmDel, setConfirmDel] = useState(false);
  const del = useMutation({
    mutationFn: () => api(`/doctors/${d._id}`, { method: 'DELETE' }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-doctors'] }); void qc.invalidateQueries({ queryKey: ['doctors'] }); },
  });
  return (
    <Fragment>
      <tr>
        <td data-label="Doctor"><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Avatar name={d.name} /><b>{d.name}</b></div></td>
        <td data-label="Specialty">{d.specialty}</td>
        <td data-label="Availability">{daysLabel(d.availability.map((a) => a.dayOfWeek))}</td>
        <td className="actions"><Button compact variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Close' : 'Edit'}</Button></td>
      </tr>
      {open && (
        <tr><td colSpan={4} style={{ background: 'var(--surface-2)' }}>
          <div className="form">
            <div className="form-row">
              <TextField label="Specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} error={(save.error as ApiError | null)?.fieldError?.('specialty')} />
              <SelectField label="Weekly schedule (09:00 to 17:00 UTC)" value={preset} onChange={(e) => setPreset(e.target.value as keyof typeof PRESETS)}>
                <option value="weekdays">Monday to Friday</option><option value="mwf">Monday, Wednesday, Friday</option>
              </SelectField>
            </div>
            {save.isError && <Banner kind="error">{(save.error as Error).message}</Banner>}
            {del.isError && <Banner kind="error" title="Could not delete">{(del.error as Error).message}</Banner>}
            <div className="btn-row" style={{ alignItems: 'center' }}>
              <Button className="fit" loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button>
              <span style={{ flex: 1 }} />
              {confirmDel ? (
                <>
                  <span style={{ fontSize: 13.5 }}>Delete {d.name}?</span>
                  <Button className="fit" variant="danger" loading={del.isPending} onClick={() => del.mutate()}>Yes, delete</Button>
                  <Button className="fit" variant="secondary" onClick={() => setConfirmDel(false)}>Keep</Button>
                </>
              ) : <Button className="fit" variant="danger" onClick={() => setConfirmDel(true)}><Trash2 className="icon" aria-hidden />Delete doctor</Button>}
            </div>
          </div>
        </td></tr>
      )}
    </Fragment>
  );
}

export default function DoctorAdmin() {
  const qc = useQueryClient();
  const [sp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  useEffect(() => { setQ(sp.get('q') ?? ''); }, [sp]);
  const list = useInfiniteQuery({
    queryKey: ['admin-doctors', q], initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Page<Doctor>>(`/doctors?page=${pageParam}&limit=20&q=${encodeURIComponent(q)}`),
    getNextPageParam: (p) => (p.page < p.pages ? p.page + 1 : undefined),
  });
  const [f, setF] = useState({ name: '', specialty: '', email: '', password: '' }), [preset, setPreset] = useState<keyof typeof PRESETS>('weekdays');
  const create = useMutation({
    mutationFn: () => api('/doctors', { method: 'POST', body: { ...f, availability: avail(PRESETS[preset]) } }),
    onSuccess: () => { setF({ name: '', specialty: '', email: '', password: '' }); void qc.invalidateQueries({ queryKey: ['admin-doctors'] }); void qc.invalidateQueries({ queryKey: ['doctors'] }); },
  });
  const err = create.error instanceof ApiError ? create.error : null;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <Screen title="Doctors" subtitle="Manage the directory and weekly availability.">
      <div className="cols">
        <div className="s8 stack lg" aria-live="polite">
          <Card>
            <div className="field"><label htmlFor="aq">Search</label><div className="search"><Search aria-hidden /><input id="aq" className="input" type="search" placeholder="Name or specialty" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
          </Card>
          {list.isPending ? <SkeletonRows n={5} /> : list.isError ? <ErrorState error={list.error} retry={() => list.refetch()} /> : rows.length === 0 ? <Card><Empty icon={<Search />} title="No doctors match">Try a different search.</Empty></Card> : (
            <Card flush>
              <table className="tbl"><thead><tr><th>Doctor</th><th>Specialty</th><th>Availability</th><th className="actions">Actions</th></tr></thead><tbody>{rows.map((d) => <RowItem key={d._id} d={d} />)}</tbody></table>
              <div className="card-foot">{list.data!.pages[0].total} doctors</div>
            </Card>
          )}
          <LoadMore hasNext={!!list.hasNextPage} loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()} />
        </div>
        <div className="s4">
          <Card title="Add a doctor">
            <form className="form" onSubmit={(e: FormEvent) => { e.preventDefault(); create.mutate(); }} noValidate>
              <TextField label="Full name" value={f.name} onChange={set('name')} error={err?.fieldError('name')} />
              <TextField label="Specialty" value={f.specialty} onChange={set('specialty')} error={err?.fieldError('specialty')} />
              <TextField label="Login email" type="email" value={f.email} onChange={set('email')} error={err?.fieldError('email')} />
              <TextField label="Temporary password" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} error={err?.fieldError('password')} hint="At least 8 characters." />
              <SelectField label="Weekly schedule (09:00 to 17:00 UTC)" value={preset} onChange={(e) => setPreset(e.target.value as keyof typeof PRESETS)}><option value="weekdays">Monday to Friday</option><option value="mwf">Monday, Wednesday, Friday</option></SelectField>
              {err && !err.details && <Banner kind="error">{err.message}</Banner>}
              {create.isSuccess && <Banner kind="success">Doctor added to the directory.</Banner>}
              <Button type="submit" loading={create.isPending} disabled={!f.name || !f.specialty || !f.email || !f.password}><UserPlus className="icon" aria-hidden />Add doctor</Button>
            </form>
          </Card>
        </div>
      </div>
    </Screen>
  );
}
