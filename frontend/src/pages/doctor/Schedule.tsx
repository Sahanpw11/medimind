import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Sparkles } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { fmtDate, fmtTime } from '../../lib/format';
import type { Appointment, Page } from '../../lib/types';
import { Banner, Button, Card, Empty, ErrorState, LoadMore, Screen, Segmented, SkeletonRows, StatusChip } from '../../components/ui';

type Risk = { riskScore: number; riskBand: string; modelVersion: string };

function RowItem({ a }: { a: Appointment }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const setStatus = useMutation({ mutationFn: (status: string) => api(`/appointments/${a._id}`, { method: 'PATCH', body: { status } }), onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }) });
  const risk = useMutation({ mutationFn: () => api<Risk>('/ai/no-show-risk', { method: 'POST', body: { appointmentId: a._id } }) });
  const active = a.status === 'booked' || a.status === 'confirmed';
  const err = (setStatus.error ?? risk.error) as ApiError | null;
  return (
    <Fragment>
      <tr>
        <td data-label="Patient"><div className="cell-main"><b>{a.patientName}</b>{a.reason && <span>{a.reason}</span>}</div></td>
        <td data-label="When" className="num"><div className="cell-main"><b>{fmtDate(a.startAt)}</b><span>{fmtTime(a.startAt)} UTC</span></div></td>
        <td data-label="Type">{a.consultationType === 'online' ? 'Online' : 'In person'}</td>
        <td data-label="Status"><StatusChip status={a.status} /></td>
        <td className="actions"><Button compact variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Close' : 'Manage'}</Button></td>
      </tr>
      {open && (
        <tr><td colSpan={5} style={{ background: 'var(--surface-2)' }}>
          <div className="stack">
            {err && <Banner kind="error">{err.status === 503 ? 'The prediction service is unavailable right now.' : err.message}</Banner>}
            {risk.data && <Banner><Sparkles className="icon" aria-hidden /><div><strong>No-show risk: {risk.data.riskBand}</strong>Score {risk.data.riskScore.toFixed(2)} from model {risk.data.modelVersion}. A simulated educational model, not a clinical tool.</div></Banner>}
            <div className="btn-row">
              {a.status === 'booked' && <Button className="fit" compact variant="secondary" loading={setStatus.isPending} onClick={() => setStatus.mutate('confirmed')}>Confirm</Button>}
              {active && <Button className="fit" compact variant="secondary" loading={setStatus.isPending} onClick={() => setStatus.mutate('completed')}>Complete</Button>}
              {active && <Button className="fit" compact variant="secondary" loading={setStatus.isPending} onClick={() => setStatus.mutate('no_show')}>No-show</Button>}
              {active && <Button className="fit" compact variant="secondary" loading={risk.isPending} onClick={() => risk.mutate()}><Sparkles className="icon" aria-hidden />Check risk</Button>}
              <Link to={`/schedule/${a._id}/record`} state={{ appointment: a }} className="btn secondary compact fit">Visit record</Link>
              {active && <Button className="fit" compact variant="danger" loading={setStatus.isPending} onClick={() => setStatus.mutate('cancelled')}>Cancel</Button>}
            </div>
          </div>
        </td></tr>
      )}
    </Fragment>
  );
}

export default function Schedule() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const now = new Date().toISOString();
  const q = useInfiniteQuery({
    queryKey: ['schedule', tab], initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Page<Appointment>>(`/appointments?page=${pageParam}&limit=15&${tab === 'upcoming' ? `from=${encodeURIComponent(now)}&sort=startAt` : `to=${encodeURIComponent(now)}&sort=-startAt`}`),
    getNextPageParam: (p) => (p.page < p.pages ? p.page + 1 : undefined),
  });
  const rows = q.data?.pages.flatMap((p) => p.data) ?? [];
  return (
    <Screen title="Appointments" subtitle="Everything assigned to you. Open Manage to confirm, complete or record a visit." action={<div style={{ inlineSize: 260 }}><Segmented label="Show" value={tab} onChange={setTab} options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]} /></div>}>
      <div aria-live="polite">
        {q.isPending ? <SkeletonRows n={4} /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : rows.length === 0 ? (
          <Card><Empty icon={<CalendarDays />} title={`No ${tab} appointments`}>Appointments assigned to you will appear here.</Empty></Card>
        ) : (
          <Card flush>
            <table className="tbl"><thead><tr><th>Patient</th><th>When</th><th>Type</th><th>Status</th><th className="actions">Actions</th></tr></thead>
              <tbody>{rows.map((a) => <RowItem key={a._id} a={a} />)}</tbody></table>
            <div className="card-foot">{q.data!.pages[0].total} total</div>
          </Card>
        )}
        <LoadMore hasNext={!!q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()} />
      </div>
    </Screen>
  );
}
