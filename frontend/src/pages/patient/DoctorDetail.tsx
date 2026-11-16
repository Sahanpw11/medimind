import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MapPin, Monitor, Building2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { DAYS, fmtDate, fmtDateTime, fmtTime, isoDay } from '../../lib/format';
import type { Appointment, Doctor, Slot } from '../../lib/types';
import { Avatar, Banner, Button, Card, ErrorState, Screen, Segmented, SkeletonRows } from '../../components/ui';

export default function DoctorDetail() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const reschedule = sp.get('reschedule');
  const qc = useQueryClient();
  const doc = useQuery({ queryKey: ['doctor', id], queryFn: () => api<Doctor>(`/doctors/${id}`) });

  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => new Date(Date.now() + i * 864e5)), []);
  const worksOn = (d: Date) => !!doc.data?.availability.some((a) => a.dayOfWeek === d.getUTCDay());
  const [date, setDate] = useState<string>('');
  const [slot, setSlot] = useState<string>('');
  const [type, setType] = useState<'online' | 'in_person'>('in_person');
  const [reason, setReason] = useState('');
  const [done, setDone] = useState<Appointment | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const scrollStrip = (dir: number) => strip.current?.scrollBy({ left: dir * strip.current.clientWidth * 0.8, behavior: 'smooth' });
  const userPicked = useRef(false); // until the user picks a day, auto-advance past days with no bookable slot

  useEffect(() => { if (doc.data && !date) { const d = days.find(worksOn); if (d) setDate(isoDay(d)); } }, [doc.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const slots = useQuery({ queryKey: ['slots', id, date], enabled: !!date, queryFn: () => api<{ slots: Slot[] }>(`/doctors/${id}/slots?date=${date}`), staleTime: 0 });
  useEffect(() => setSlot(''), [date]);
  useEffect(() => {
    if (userPicked.current || !slots.data || !doc.data) return;
    if (slots.data.slots.some((s) => s.status === 'available')) return;
    const i = days.findIndex((d) => isoDay(d) === date);
    const next = days.slice(i + 1).find(worksOn);
    if (next) setDate(isoDay(next));
  }, [slots.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = useMutation({
    mutationFn: () => { userPicked.current = true; return reschedule
      ? api<Appointment>(`/appointments/${reschedule}`, { method: 'PATCH', body: { startAt: slot } })
      : api<Appointment>('/appointments', { method: 'POST', body: { doctorId: id, startAt: slot, consultationType: type, ...(reason.trim() && { reason: reason.trim() }) } }); },
    onSuccess: (a) => { setDone(a); void qc.invalidateQueries({ queryKey: ['appointments'] }); },
    onError: (e) => { if (e instanceof ApiError && e.status === 409) { setSlot(''); void slots.refetch(); } },
  });

  if (doc.isPending) return <Screen title="Doctor" back={{ to: '/doctors', label: 'Doctors' }}><SkeletonRows n={3} /></Screen>;
  if (doc.isError) return <Screen title="Doctor" back={{ to: '/doctors', label: 'Doctors' }}><ErrorState error={doc.error} retry={() => doc.refetch()} /></Screen>;
  const d = doc.data;

  if (done) {
    return (
      <Screen title={reschedule ? 'Rescheduled' : 'Booked'}>
        <Card>
          <div className="confirm" role="status">
            <svg className="tick" viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="36" cy="36" r="31" /><path d="M22 37l10 10 18-21" /></svg>
            <h2 style={{ fontSize: 22 }}>{reschedule ? 'Appointment moved' : 'Appointment booked'}</h2>
            <p style={{ color: 'var(--ink-2)' }}>{d.name}<br /><span className="num">{fmtDateTime(done.startAt)}</span></p>
            <div className="btn-row" style={{ marginTop: 8 }}><Link to="/appointments" className="btn fit">View my visits</Link><Link to="/" className="btn secondary fit">Back to Home</Link></div>
          </div>
        </Card>
      </Screen>
    );
  }

  const err = submit.error instanceof ApiError ? submit.error : null;
  return (
    <Screen title={d.name} subtitle={d.specialty} back={{ to: reschedule ? '/appointments' : '/doctors', label: reschedule ? 'Visits' : 'Doctors' }}>
      <div className="cols">
        <div className="s4 stack lg">
          <Card>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
              <Avatar name={d.name} large />
              <div><h2 style={{ fontSize: 18, fontWeight: 600 }}>{d.name}</h2><p style={{ color: 'var(--ink-2)' }}>{d.specialty}</p></div>
            </div>
            <dl className="dl" style={{ gridTemplateColumns: '1fr' }}>
              <div className="kv"><dt>Location</dt><dd style={{ display: 'flex', gap: 6, alignItems: 'center' }}><MapPin className="icon" aria-hidden />{d.clinic?.city ?? 'Not listed'}</dd></div>
              <div className="kv"><dt>Consultations</dt><dd style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {d.consultationTypes.includes('in_person') && <span className="chip neutral"><Building2 className="icon" aria-hidden />In person</span>}
                {d.consultationTypes.includes('online') && <span className="chip neutral"><Monitor className="icon" aria-hidden />Online</span>}
              </dd></div>
            </dl>
          </Card>
          <Card title="Weekly availability" hint="Times are in UTC" flush>
            {d.availability.map((a) => <div className="row" key={a.dayOfWeek}><span className="row-main"><span className="row-title">{DAYS[a.dayOfWeek]}</span></span><span className="row-detail num">{a.start} to {a.end}</span></div>)}
          </Card>
        </div>

        <div className="s8">
          <Card title={reschedule ? 'Choose a new time' : 'Book an appointment'} action={<div className="strip-nav"><button type="button" aria-label="Earlier days" onClick={() => scrollStrip(-1)}><ChevronLeft className="icon" aria-hidden /></button><button type="button" aria-label="Later days" onClick={() => scrollStrip(1)}><ChevronRight className="icon" aria-hidden /></button></div>}>
            <div className="stack lg">
              {reschedule && <Banner>Choose a new time for your existing appointment.</Banner>}
              <div>
                <h3 className="group-title" style={{ marginTop: 0 }}>Choose a day</h3>
                <div className="date-strip" role="group" aria-label="Available days" ref={strip}>
                  {days.map((day) => {
                    const key = isoDay(day);
                    return (
                      <button key={key} type="button" disabled={!worksOn(day)} aria-pressed={date === key} aria-label={`${fmtDate(day.toISOString())}${worksOn(day) ? '' : ', unavailable'}`} onClick={() => { userPicked.current = true; setDate(key); }}>
                        <span className="dow">{DAYS[day.getUTCDay()]}</span><span className="dom num">{day.getUTCDate()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="group-title" style={{ marginTop: 0 }}>Choose a time (UTC)</h3>
                {slots.isPending && date ? <SkeletonRows n={2} /> : slots.isError ? <ErrorState error={slots.error} retry={() => slots.refetch()} /> : (
                  <>
                    <div className="slots" role="group" aria-label="Available times">
                      {slots.data?.slots.map((s) => (
                        <button key={s.startAt} type="button" className="slot" disabled={s.status !== 'available'} aria-pressed={slot === s.startAt}
                          aria-label={`${fmtTime(s.startAt)}${s.status === 'taken' ? ', already booked' : s.status === 'past' ? ', past' : ''}`} onClick={() => { userPicked.current = true; setSlot(s.startAt); }}>
                          {fmtTime(s.startAt)}
                        </button>
                      ))}
                    </div>
                    {slots.data && slots.data.slots.length === 0 && <p className="group-foot">The doctor does not see patients on this day.</p>}
                    {slots.data && slots.data.slots.length > 0 && !slots.data.slots.some((s) => s.status === 'available') && userPicked.current && <p className="group-foot" role="status">Every time on this day is now booked. Choose another day above.</p>}
                    <div className="legend" style={{ marginTop: 12 }}><span>Available</span><span className="l-sel">Selected</span><span className="l-taken">Unavailable</span></div>
                  </>
                )}
              </div>

              {!reschedule && (
                <div className="form-row">
                  <div className="field"><span className="label">Consultation type</span>
                    <Segmented label="Consultation type" value={type} onChange={setType} options={[{ value: 'in_person', label: 'In person' }, { value: 'online', label: 'Online' }]} />
                  </div>
                  <div className="field"><label htmlFor="reason">Reason for visit (optional)</label>
                    <input id="reason" className="input" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: routine checkup" />
                  </div>
                </div>
              )}

              {err && <Banner kind="error" title={err.status === 409 ? 'That time was just taken' : 'Could not book'}>{err.status === 409 ? 'Someone else booked it first. The times above are refreshed; please choose another.' : err.message}</Banner>}
              <div className="summary-box" aria-live="polite">
                <span style={{ color: 'var(--ink-2)', fontSize: 13.5 }}>Selected time</span>
                <b className="num">{slot ? fmtDateTime(slot) : 'Choose a time to continue'}</b>
              </div>
              <Button disabled={!slot} loading={submit.isPending} onClick={() => submit.mutate()}>{reschedule ? 'Confirm new time' : 'Book appointment'}</Button>
            </div>
          </Card>
        </div>
      </div>
    </Screen>
  );
}
