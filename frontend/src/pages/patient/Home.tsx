import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarPlus, CalendarClock, Download, FileText, MessageCircleHeart, Monitor, Building2, Share, UserRound } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fmtDate, fmtDateTime, fmtTime } from '../../lib/format';
import { useInstall } from '../../lib/pwa';
import type { Patient, PatientOverview } from '../../lib/types';
import { Banner, Button, Card, Empty, ErrorState, LinkRow, Screen, SkeletonRows, StatusChip } from '../../components/ui';
import { nf } from '../../components/charts';

function relative(iso: string, now: number) {
  const m = Math.round((new Date(iso).getTime() - now) / 60000);
  if (m < 60) return m < 1 ? 'now' : `in ${m} min`;
  if (m < 1440) return `in ${Math.floor(m / 60)} h`;
  const d = Math.round(m / 1440);
  return d === 1 ? 'tomorrow' : `in ${d} days`;
}

export default function Home() {
  const { user } = useAuth();
  const pwa = useInstall();
  const me = useQuery({ queryKey: ['patient', user!.profileId], queryFn: () => api<Patient>(`/patients/${user!.profileId}`) });
  const q = useQuery({ queryKey: ['patient-dash'], queryFn: () => api<PatientOverview>('/analytics/patient'), refetchInterval: 60_000 });
  const d = q.data;
  const now = d ? new Date(d.generatedAt).getTime() : Date.now();
  const first = me.data?.fullName.split(' ')[0];
  const next = d?.upcoming[0];
  const lastVitals = d?.vitals.at(-1);

  return (
    <Screen title={first ? `Hello, ${first}` : 'Hello'} subtitle="Your upcoming care, your history and your health at a glance." action={<Link to="/doctors" className="btn fit"><CalendarPlus className="icon" aria-hidden />Find a doctor</Link>}>
      {q.isError && <ErrorState error={q.error} retry={() => q.refetch()} />}
      {q.isPending && <SkeletonRows n={4} />}
      {d && (
        <div className="stack lg">
          <section className="card" aria-label="Summary">
            <div className="stats">
              <div className="stat"><span className="k">Upcoming visits</span><span className="v" data-testid="stat-upcoming">{nf.format(d.upcomingCount)}</span><span className="d">Booked or confirmed</span></div>
              <div className="stat"><span className="k">Next visit</span><span className="v" style={{ fontSize: 22 }}>{next ? relative(next.startAt, now) : 'None'}</span><span className="d">{next ? next.doctorName : 'Nothing booked'}</span></div>
              <div className="stat"><span className="k">Completed visits</span><span className="v">{nf.format(d.completed12)}</span><span className="d">Last 12 months</span></div>
              <div className="stat"><span className="k">Records and files</span><span className="v">{nf.format(d.records + d.documents)}</span><span className="d">{d.records} records, {d.documents} documents</span></div>
            </div>
          </section>

          <div className="cols">
            <div className="s8 stack lg">
              <Card title="Next appointment" action={next && <Link to={`/doctors/${next.doctorId}?reschedule=${next._id}`} className="btn secondary compact">Reschedule</Link>}>
                {next ? (
                  <div className="next-visit">
                    <div className="when"><span className="num">{fmtTime(next.startAt)}</span><small>{fmtDate(next.startAt)} UTC</small></div>
                    <div className="who"><b>{next.doctorName}</b><span>{next.specialty}</span>{next.reason && <span>Reason: {next.reason}</span>}</div>
                    <div className="chips"><span className="chip neutral">{next.consultationType === 'online' ? <Monitor className="icon" aria-hidden /> : <Building2 className="icon" aria-hidden />}{next.consultationType === 'online' ? 'Online' : 'In person'}</span><StatusChip status={next.status} /></div>
                  </div>
                ) : <Empty icon={<CalendarClock />} title="Nothing booked yet" action={<Link to="/doctors" className="btn">Find a doctor</Link>}>Choose a doctor and pick a time that suits you.</Empty>}
              </Card>
              {d.upcoming.length > 1 && (
                <Card title="Also coming up" flush action={<Link to="/appointments" className="btn plain compact">View all</Link>}>
                  {d.upcoming.slice(1).map((a) => (
                    <Link key={a._id} to="/appointments" className="row">
                      <span className="row-main"><span className="row-title">{a.doctorName}</span><span className="row-sub">{a.specialty}</span></span>
                      <span className="row-detail num">{fmtDateTime(a.startAt)}</span><StatusChip status={a.status} />
                    </Link>
                  ))}
                </Card>
              )}
            </div>

            <div className="s4 stack lg">
              <Card title="Health snapshot">
                {me.isPending ? <div className="skel" style={{ height: 90 }} /> : me.data && (
                  <dl className="dl" style={{ gridTemplateColumns: '1fr' }}>
                    <div className="kv"><dt>Allergies</dt><dd>{me.data.allergies.length ? <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{me.data.allergies.map((a) => <span key={a.substance} className={`chip ${a.severity === 'Severe' ? 'cancelled' : 'neutral'}`}>{a.substance}, {a.severity}</span>)}</span> : 'None recorded'}</dd></div>
                    <div className="kv"><dt>Last recorded vitals</dt><dd className="num">{lastVitals ? `${lastVitals.systolicBP ?? '?'}/${lastVitals.diastolicBP ?? '?'} mmHg, ${lastVitals.heartRate ?? '?'} bpm (${fmtDate(lastVitals.visitAt)})` : 'No vitals recorded'}</dd></div>
                    <div className="kv"><dt>Emergency contact</dt><dd>{me.data.emergencyContact.name}, {me.data.emergencyContact.relationship}</dd></div>
                  </dl>
                )}
              </Card>
              <Card title="Shortcuts" flush>
                <LinkRow to="/assistant" icon={<MessageCircleHeart />} title="Ask the assistant" sub="General health education" />
                <LinkRow to="/documents" icon={<FileText />} title="Documents" sub={`${d.documents} on file`} />
                <LinkRow to="/profile" icon={<UserRound />} title="Profile" sub="Allergies and emergency contact" />
              </Card>
              {pwa.canInstall && <Banner action={<Button compact variant="secondary" onClick={pwa.install}><Download className="icon" aria-hidden />Install</Button>}>Add MediMind to your home screen.</Banner>}
              {pwa.iosHint && <Banner><Share className="icon" aria-hidden /> On iPhone: tap Share, then Add to Home Screen.</Banner>}
            </div>
          </div>

        </div>
      )}
    </Screen>
  );
}
