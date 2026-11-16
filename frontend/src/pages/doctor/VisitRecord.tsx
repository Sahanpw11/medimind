import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { fmtDate } from '../../lib/format';
import type { Appointment, MedicalRecord, Page } from '../../lib/types';
import { Banner, Button, Card, ErrorState, Screen, SkeletonRows, TextField } from '../../components/ui';

export default function VisitRecord() {
  const a = (useLocation().state as { appointment?: Appointment } | null)?.appointment;
  const qc = useQueryClient();
  const [dx, setDx] = useState([{ code: '', description: '' }]);
  const [v, setV] = useState({ systolicBP: '', diastolicBP: '', heartRate: '' }), [meds, setMeds] = useState(''), [notes, setNotes] = useState(''), [follow, setFollow] = useState(false);
  const history = useQuery({ enabled: !!a, queryKey: ['patient-records', a?.patientId], queryFn: () => api<Page<MedicalRecord>>(`/medical-records/patient/${a!.patientId}?limit=5`) });
  const save = useMutation({
    mutationFn: () => {
      const num = (s: string) => (s === '' ? undefined : Number(s));
      return api('/medical-records', { method: 'POST', body: {
        patientId: a!.patientId, appointmentId: a!._id, visitAt: a!.startAt,
        diagnoses: dx.filter((d) => d.code || d.description),
        vitals: { systolicBP: num(v.systolicBP), diastolicBP: num(v.diastolicBP), heartRate: num(v.heartRate) },
        medications: meds.split(',').map((m) => m.trim()).filter(Boolean), notes: notes.trim() || undefined, followUpRequired: follow } });
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['patient-records'] }); },
  });
  if (!a) return <Navigate to="/schedule" replace />;
  const err = save.error instanceof ApiError ? save.error : null;

  return (
    <Screen title="Visit record" subtitle={`${a.patientName}, ${fmtDate(a.startAt)}`} back={{ to: '/schedule', label: 'Appointments' }}>
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }} noValidate>
        <div className="cols">
          <div className="s8 stack lg">
            <Card title="Diagnoses" hint="Synthetic demonstration data only">
              <div className="stack">
                {dx.map((d, i) => (
                  <div className="form-row" key={i}>
                    <TextField label={`Code ${i + 1}`} value={d.code} placeholder="Z00.0" onChange={(e) => setDx(dx.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))} />
                    <TextField label="Description" value={d.description} placeholder="General examination" onChange={(e) => setDx(dx.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                  </div>
                ))}
                <div><Button type="button" variant="secondary" className="fit" disabled={dx.length >= 5} onClick={() => setDx([...dx, { code: '', description: '' }])}><Plus className="icon" aria-hidden />Add diagnosis</Button></div>
              </div>
            </Card>
            <Card title="Vitals">
              <div className="form-row">
                <TextField label="Systolic BP (mmHg)" inputMode="numeric" value={v.systolicBP} onChange={(e) => setV({ ...v, systolicBP: e.target.value })} />
                <TextField label="Diastolic BP (mmHg)" inputMode="numeric" value={v.diastolicBP} onChange={(e) => setV({ ...v, diastolicBP: e.target.value })} />
                <TextField label="Heart rate (bpm)" inputMode="numeric" value={v.heartRate} onChange={(e) => setV({ ...v, heartRate: e.target.value })} />
              </div>
            </Card>
            <Card title="Plan">
              <div className="form">
                <TextField label="Medications (comma separated)" value={meds} onChange={(e) => setMeds(e.target.value)} />
                <div className="field"><label htmlFor="notes">Notes</label><textarea id="notes" className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} /></div>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} />Follow-up required</label>
              </div>
            </Card>
            {err && <Banner kind="error" title="Could not save">{err.details ? err.details.map((d) => `${d.field}: ${d.message}`).join('. ') : err.message}</Banner>}
            {save.isSuccess && <Banner kind="success">Record saved and added to the patient&apos;s history.</Banner>}
            <div><Button type="submit" className="fit" loading={save.isPending} disabled={!dx.some((d) => d.code && d.description)}>Save record</Button></div>
          </div>
          <div className="s4">
            <Card title="Earlier records" hint="This patient, most recent first" flush>
              {history.isPending ? <SkeletonRows n={2} /> : history.isError ? <div style={{ padding: 20 }}><ErrorState error={history.error} retry={() => history.refetch()} /></div> : history.data.data.length === 0 ? <div className="row"><span className="row-sub">No earlier records.</span></div> : (
                history.data.data.map((r) => <div className="row" key={r._id}><span className="row-main"><span className="row-title">{fmtDate(r.visitAt)}</span><span className="row-sub">{r.diagnoses.map((d) => d.description).join(', ')}</span></span></div>)
              )}
            </Card>
          </div>
        </div>
      </form>
    </Screen>
  );
}
