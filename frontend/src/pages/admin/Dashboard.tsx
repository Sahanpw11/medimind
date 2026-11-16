import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck2, Monitor, Building2 } from 'lucide-react';
import { api } from '../../lib/api';
import { fmtDate, fmtTime, monthLabel, STATUS_LABEL } from '../../lib/format';
import type { ClinicOps, Overview } from '../../lib/types';
import { Card, Empty, ErrorState, Screen, Segmented, SkeletonRows, StatusChip } from '../../components/ui';
import { BarPanel, nf, type Pt } from '../../components/charts';

const RANGES = { '6': '6 months', '12': '12 months', all: 'All time' } as const;

export default function Dashboard() {
  const [range, setRange] = useState<keyof typeof RANGES>('12');
  const ops = useQuery({ queryKey: ['clinic-ops'], queryFn: () => api<ClinicOps>('/analytics/operations'), refetchInterval: 60_000 });
  const q = useQuery({
    queryKey: ['analytics', range],
    queryFn: () => {
      const now = Date.now();
      const from = range === 'all' ? new Date('2000-01-01') : new Date(now - Number(range) * 30.44 * 864e5);
      return api<Overview>(`/analytics/overview?from=${from.toISOString()}&to=${new Date(now + 200 * 864e5).toISOString()}`);
    },
  });
  const d = q.data, o = ops.data;
  const monthly = useMemo<Pt[]>(() => {
    if (!d) return [];
    const m = new Map<string, number>();
    for (const r of d.monthlyTrend) { const k = `${r.year}-${String(r.month).padStart(2, '0')}`; m.set(k, (m.get(k) ?? 0) + r.count); }
    return [...m.entries()].sort().map(([k, v]) => ({ label: monthLabel(Number(k.slice(0, 4)), Number(k.slice(5))), value: v }));
  }, [d]);
  const dayLabel = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });

  return (
    <Screen title="Dashboard" subtitle="Clinic operations today, then trends over time. No patient details are shown." action={<Link to="/admin/doctors" className="btn secondary fit">Manage doctors</Link>}>
      <div className="stack lg">
        <div>
          <h2 className="group-title" style={{ marginTop: 0 }}>Operations</h2>
          {ops.isError && <ErrorState error={ops.error} retry={() => ops.refetch()} />}
          {ops.isPending && <SkeletonRows n={3} />}
          {o && (
            <div className="stack lg">
              <section className="card" aria-label="Operations summary">
                <div className="stats">
                  <div className="stat"><span className="k">Appointments today</span><span className="v" data-testid="stat-today">{nf.format(o.today.length)}</span><span className="d">Across all doctors</span></div>
                  <div className="stat"><span className="k">Unconfirmed, next 7 days</span><span className="v">{nf.format(o.unconfirmed7)}</span><span className="d">Booked, awaiting a doctor</span></div>
                  <div className="stat"><span className="k">Cancellation rate</span><span className="v">{(o.cancellationRate90 * 100).toFixed(1)}%</span><span className="d">Last 90 days</span></div>
                  <div className="stat"><span className="k">Doctors on roster</span><span className="v">{nf.format(o.doctors)}</span><span className="d">Active in the directory</span></div>
                </div>
              </section>
              <div className="cols">
                <div className="s8">
                  <Card title="Today across the clinic" hint={fmtDate(o.generatedAt)} flush>
                    <div className="scroll-list">
                      {o.today.length === 0 ? <Empty icon={<CalendarCheck2 />} title="No appointments today">Bookings for today will appear here.</Empty> : o.today.map((a) => (
                        <div className="agenda-row" key={a._id} style={{ gridTemplateColumns: '72px minmax(0,1fr) auto' }}>
                          <span className="agenda-time num">{fmtTime(a.startAt)}</span>
                          <span className="row-main"><span className="row-title">{a.doctorName}</span><span className="row-sub">{a.specialty}</span></span>
                          <span className="agenda-meta"><span className="chip neutral">{a.consultationType === 'online' ? <Monitor className="icon" aria-hidden /> : <Building2 className="icon" aria-hidden />}{a.consultationType === 'online' ? 'Online' : 'In person'}</span><StatusChip status={a.status} /></span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
                <div className="s4 stack lg">
                  <BarPanel cls="" horizontal title="Calendar utilisation" sub="Share of available slots booked over the next 14 days, highest first" unit="% booked"
                    data={o.utilisation.slice(0, 10).map((u) => ({ label: u.name, value: u.pct }))} />
                </div>
                <BarPanel cls="s12" title="Next 14 days" sub="Appointments per day across the clinic" unit="appointments" data={o.daily.map((x) => ({ label: dayLabel(x.date), value: x.count }))} />
              </div>
            </div>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '8px 0 12px' }}>
            <h2 className="group-title" style={{ margin: 0 }}>Trends</h2>
            <div style={{ inlineSize: 300, maxInlineSize: '100%' }}><Segmented label="Date range" value={range} onChange={setRange} options={Object.entries(RANGES).map(([value, label]) => ({ value: value as keyof typeof RANGES, label }))} /></div>
          </div>
          <div aria-live="polite">
            {q.isError && <ErrorState error={q.error} retry={() => q.refetch()} />}
            {q.isPending && <div className="cols">{[0, 1, 2, 3].map((i) => <div key={i} className="panel s6"><div className="skel" style={{ height: 20, width: '40%' }} /><div className="skel" style={{ height: 200, marginTop: 16 }} /></div>)}</div>}
            {d && (
              <div className="stack lg">
                <section className="card" aria-label="Summary">
                  <div className="stats">
                    <div className="stat"><span className="k">Appointments</span><span className="v" data-testid="stat-appointments">{nf.format(d.totals.appointments)}</span><span className="d">In the selected range</span></div>
                    <div className="stat"><span className="k">No-shows</span><span className="v">{nf.format(d.totals.noShows)}</span><span className="d">{(d.totals.noShowRate * 100).toFixed(1)}% of appointments</span></div>
                    {[...d.byConsultationType].sort((a, b) => a.type.localeCompare(b.type)).map((c) => (
                      <div className="stat" key={c.type}><span className="k">{c.type === 'online' ? 'Online' : 'In person'}</span><span className="v">{nf.format(c.count)}</span><span className="d">Consultations</span></div>
                    ))}
                  </div>
                </section>
                <div className="cols even">
                  <BarPanel cls="s8" title="Appointments per month" sub="All statuses, by appointment date" data={monthly} unit="appointments" />
                  <BarPanel cls="s4" horizontal title="How appointments end" sub="Count by status" data={d.byStatus.map((s) => ({ label: STATUS_LABEL[s.status], value: s.count }))} unit="appointments" />
                  <BarPanel cls="s6" horizontal title="Appointments by specialty" sub="Which specialties are busiest" data={d.bySpecialty.map((s) => ({ label: s.specialty, value: s.count }))} unit="appointments" />
                  <BarPanel cls="s6" horizontal title="Busiest doctors" sub="Top 10 by total appointments" data={d.volumeByDoctor.map((v) => ({ label: v.name, value: v.totalAppointments }))} unit="appointments" />
                  <BarPanel cls="s6" horizontal title="Most common diagnoses" sub="From synthetic visit records, counted without patient details" data={d.topDiagnoses.map((x) => ({ label: `${x.code} ${x.description}`, value: x.count }))} unit="records" />
                  <BarPanel cls="s6" title="Patients by age band" sub="Computed from date of birth" data={d.ageBands.map((a) => ({ label: a.band, value: a.patients }))} unit="patients" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Screen>
  );
}
