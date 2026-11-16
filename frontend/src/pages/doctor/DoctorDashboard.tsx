import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck2, CalendarClock, CalendarDays, FileText, Monitor, Building2, UserX } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fmtDate, fmtTime, STATUS_LABEL } from '../../lib/format';
import type { AgendaItem, Doctor, DoctorOverview } from '../../lib/types';
import { Banner, Button, Card, Empty, ErrorState, Screen, SkeletonRows, StatusChip } from '../../components/ui';
import { BarPanel, nf } from '../../components/charts';

function relative(iso: string, now: number) {
  const m = Math.round((new Date(iso).getTime() - now) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `in ${m} min`;
  if (m < 1440) return `in ${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim();
  return `in ${Math.round(m / 1440)} days`;
}
const TypeChip = ({ t }: { t: AgendaItem['consultationType'] }) => (t === 'online' ? <span className="chip neutral"><Monitor className="icon" aria-hidden />Online</span> : <span className="chip neutral"><Building2 className="icon" aria-hidden />In person</span>);

export default function DoctorDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['doctor', user!.profileId], queryFn: () => api<Doctor>(`/doctors/${user!.profileId}`), staleTime: 600_000 });
  const q = useQuery({ queryKey: ['doctor-dash'], queryFn: () => api<DoctorOverview>('/analytics/doctor'), refetchInterval: 60_000 });
  const confirm = useMutation({ mutationFn: (id: string) => api(`/appointments/${id}`, { method: 'PATCH', body: { status: 'confirmed' } }), onSuccess: () => qc.invalidateQueries({ queryKey: ['doctor-dash'] }) });
  const d = q.data;
  const now = d ? new Date(d.generatedAt).getTime() : Date.now();

  return (
    <Screen title="Dashboard" subtitle={me.data ? `${me.data.name}, ${me.data.specialty}. Times are UTC.` : 'Your day at a glance.'} action={<Link to="/schedule" className="btn secondary fit"><CalendarDays className="icon" aria-hidden />All appointments</Link>}>
      {q.isError && <ErrorState error={q.error} retry={() => q.refetch()} />}
      {q.isPending && <SkeletonRows n={4} />}
      {d && (
        <div className="stack lg">
          <section className="card" aria-label="Summary">
            <div className="stats">
              <div className="stat"><span className="k">Today</span><span className="v" data-testid="stat-today">{nf.format(d.today.length)}</span><span className="d">{d.todayDone} completed</span></div>
              <div className="stat"><span className="k">Awaiting confirmation</span><span className="v">{nf.format(d.awaiting)}</span><span className="d">Booked, not yet confirmed</span></div>
              <div className="stat"><span className="k">Next 7 days</span><span className="v">{nf.format(d.upcoming7)}</span><span className="d">Booked or confirmed</span></div>
              <div className="stat"><span className="k">No-show rate</span><span className="v">{(d.noShowRate * 100).toFixed(1)}%</span><span className="d">Last 90 days</span></div>
            </div>
          </section>

          <div className="cols">
            <div className="s8 stack lg">
              <Card title="Today's agenda" hint={fmtDate(d.generatedAt)} flush>
                {d.today.length === 0 ? <Empty icon={<CalendarCheck2 />} title="Nothing scheduled today">Your next appointment is shown on the right.</Empty> : d.today.map((a) => (
                  <div className="agenda-row" key={a._id}>
                    <span className="agenda-time num">{fmtTime(a.startAt)}</span>
                    <span className="row-main"><span className="row-title">{a.patientName}</span><span className="row-sub">{a.reason || 'Consultation'}</span></span>
                    <span className="agenda-meta"><TypeChip t={a.consultationType} /><StatusChip status={a.status} /></span>
                    <span className="agenda-actions">
                      {a.status === 'booked' && <Button compact variant="secondary" loading={confirm.isPending && confirm.variables === a._id} onClick={() => confirm.mutate(a._id)}>Confirm</Button>}
                      <Link to={`/schedule/${a._id}/record`} state={{ appointment: a }} className="btn secondary compact"><FileText className="icon" aria-hidden />Record</Link>
                    </span>
                  </div>
                ))}
              </Card>
              <BarPanel cls="" title="Next 14 days" sub="Appointments per day, booked, confirmed and completed" unit="appointments"
                data={d.daily.map((x) => ({ label: new Date(x.date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }), value: x.count }))} />
            </div>
            <div className="s4 stack lg">
              <Card title="Next patient">
                {d.next ? (
                  <div className="stack">
                    <div><b style={{ fontSize: 18 }}>{d.next.patientName}</b><p style={{ color: 'var(--ink-2)' }}>{d.next.reason || 'Consultation'}</p></div>
                    <dl className="dl" style={{ gridTemplateColumns: '1fr 1fr' }}>
                      <div className="kv"><dt>When</dt><dd className="num"><b>{fmtDate(d.next.startAt)}</b><br />{fmtTime(d.next.startAt)} UTC</dd></div>
                      <div className="kv"><dt>Starts</dt><dd><b>{relative(d.next.startAt, now)}</b></dd></div>
                    </dl>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><TypeChip t={d.next.consultationType} /><StatusChip status={d.next.status} /></div>
                    <Link to={`/schedule/${d.next._id}/record`} state={{ appointment: d.next }} className="btn">Open visit record</Link>
                  </div>
                ) : <Empty icon={<CalendarClock />} title="No upcoming patients">New bookings will appear here.</Empty>}
              </Card>
              <Card title="Needs confirmation" hint="Earliest first" flush>
                {confirm.isError && <div style={{ padding: 16 }}><Banner kind="error">{(confirm.error as Error).message}</Banner></div>}
                {d.attention.length === 0 ? <div className="row"><span className="row-sub">Everything booked is confirmed.</span></div> : d.attention.map((a) => (
                  <div className="row" key={a._id}>
                    <span className="row-main"><span className="row-title">{a.patientName}</span><span className="row-sub num">{fmtDate(a.startAt)}, {fmtTime(a.startAt)}</span></span>
                    <Button compact variant="secondary" loading={confirm.isPending && confirm.variables === a._id} onClick={() => confirm.mutate(a._id)}>Confirm</Button>
                  </div>
                ))}
              </Card>
              <BarPanel cls="" horizontal title="Recent outcomes" sub="Last 90 days" unit="appointments" data={d.outcomes.map((o) => ({ label: STATUS_LABEL[o.status], value: o.count }))} />
            </div>
          </div>

          {d.noShowRate >= 0.15 && <Banner kind="info"><UserX className="icon" aria-hidden /> Your no-show rate is {(d.noShowRate * 100).toFixed(0)}%. Use &quot;Check risk&quot; on upcoming appointments to see which ones may need a reminder.</Banner>}
        </div>
      )}
    </Screen>
  );
}
