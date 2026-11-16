import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { fmtDate, fmtTime } from '../../lib/format';
import type { Appointment, Page } from '../../lib/types';
import { Banner, Button, Card, Empty, ErrorState, LoadMore, Screen, Segmented, SkeletonRows, StatusChip } from '../../components/ui';

function RowItem({ a }: { a: Appointment }) {
  const [confirm, setConfirm] = useState(false);
  const qc = useQueryClient();
  const cancel = useMutation({ mutationFn: () => api(`/appointments/${a._id}`, { method: 'PATCH', body: { status: 'cancelled' } }), onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }) });
  const changeable = (a.status === 'booked' || a.status === 'confirmed') && new Date(a.startAt) > new Date();
  return (
    <tr>
      <td data-label="Doctor"><div className="cell-main"><b>{a.doctorName}</b><span>{a.specialty}</span></div></td>
      <td data-label="When" className="num"><div className="cell-main"><b>{fmtDate(a.startAt)}</b><span>{fmtTime(a.startAt)} UTC</span></div></td>
      <td data-label="Type">{a.consultationType === 'online' ? 'Online' : 'In person'}</td>
      <td data-label="Status"><StatusChip status={a.status} /></td>
      <td className="actions">
        {cancel.error && <Banner kind="error">{(cancel.error as ApiError).message}</Banner>}
        {changeable ? (confirm ? (
          <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13.5 }}>Cancel this visit?</span>
            <Button compact variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>Yes, cancel</Button>
            <Button compact variant="secondary" onClick={() => setConfirm(false)}>Keep</Button>
          </span>
        ) : (
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <Link to={`/doctors/${a.doctorId}?reschedule=${a._id}`} className="btn secondary compact">Reschedule</Link>
            <Button compact variant="danger" onClick={() => setConfirm(true)}>Cancel</Button>
          </span>
        )) : <span style={{ color: 'var(--ink-3)', fontSize: 13.5 }}>No changes possible</span>}
      </td>
    </tr>
  );
}

export default function Appointments() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const now = new Date().toISOString();
  const q = useInfiniteQuery({
    queryKey: ['appointments', tab], initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Page<Appointment>>(`/appointments?page=${pageParam}&limit=15&${tab === 'upcoming' ? `from=${encodeURIComponent(now)}&sort=startAt` : `to=${encodeURIComponent(now)}&sort=-startAt`}`),
    getNextPageParam: (p) => (p.page < p.pages ? p.page + 1 : undefined),
  });
  const rows = q.data?.pages.flatMap((p) => p.data) ?? [];
  return (
    <Screen title="Visits" subtitle="Your appointments. Reschedule or cancel anything still upcoming." action={<div style={{ inlineSize: 260 }}><Segmented label="Show" value={tab} onChange={setTab} options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]} /></div>}>
      <div aria-live="polite">
        {q.isPending ? <SkeletonRows n={4} /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : rows.length === 0 ? (
          <Card><Empty icon={<CalendarDays />} title={tab === 'upcoming' ? 'No upcoming visits' : 'No past visits'} action={tab === 'upcoming' ? <Link to="/doctors" className="btn">Find a doctor</Link> : undefined}>
            {tab === 'upcoming' ? 'Book an appointment and it will appear here.' : 'Completed and cancelled visits will appear here.'}
          </Empty></Card>
        ) : (
          <Card flush>
            <table className="tbl"><thead><tr><th>Doctor</th><th>When</th><th>Type</th><th>Status</th><th className="actions">Actions</th></tr></thead>
              <tbody>{rows.map((a) => <RowItem key={a._id} a={a} />)}</tbody></table>
            <div className="card-foot">{q.data!.pages[0].total} total</div>
          </Card>
        )}
        <LoadMore hasNext={!!q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()} />
      </div>
    </Screen>
  );
}
