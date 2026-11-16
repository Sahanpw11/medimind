import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { Patient } from '../../lib/types';
import { Banner, Button, Logo, SelectField, SkeletonRows, TextField } from '../../components/ui';

const STEPS = ['About you', 'Allergies', 'Emergency contact'];

export default function Welcome() {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['patient', user!.profileId], queryFn: () => api<Patient>(`/patients/${user!.profileId}`) });
  const [f, setF] = useState<Patient | null>(null), [step, setStep] = useState(0), [noAllergies, setNoAllergies] = useState(false);
  useEffect(() => { if (q.data && !f) setF(q.data); }, [q.data, f]);

  const finish = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<Patient>(`/patients/${user!.profileId}`, { method: 'PUT', body: { ...body, onboardingDone: true } }),
    onSuccess: (p) => { qc.setQueryData(['patient', user!.profileId], p); nav('/', { replace: true }); },
  });

  if (q.isPending || !f) return <div className="welcome"><div className="welcome-card"><SkeletonRows n={3} /></div></div>;
  if (q.data?.onboardingDone !== false && !finish.isPending) return <Navigate to="/" replace />; // already done (or a seeded account)

  const set = (patch: Partial<Patient>) => setF({ ...f, ...patch });
  const err = finish.error instanceof ApiError ? finish.error : null;
  const ec = f.emergencyContact;
  const ecMissing = ec.name === 'Not provided' || !ec.name.trim() || ec.relationship === 'Unknown' || !ec.relationship.trim();
  const allergiesOk = noAllergies || f.allergies.length > 0;
  const last = step === STEPS.length - 1;
  const canContinue = step === 1 ? allergiesOk && f.allergies.every((a) => a.substance.trim()) : step === 2 ? !ecMissing : true;

  const save = () => finish.mutate({
    contact: f.contact, address: f.address,
    allergies: f.allergies.filter((a) => a.substance.trim()),
    emergencyContact: { name: ec.name === 'Not provided' ? 'Not provided' : ec.name, relationship: ec.relationship, ...(ec.phone && { phone: ec.phone }) },
  });

  return (
    <div className="welcome">
      <div className="welcome-card">
        <div className="brand" style={{ padding: 0 }}><Logo /><span>MediMind</span></div>
        <div>
          <h1 className="welcome-title">Welcome, {f.fullName.split(' ')[0]}</h1>
          <p style={{ color: 'var(--ink-2)', marginTop: 4 }}>Three quick questions so your doctors have what they need. You can change all of this later in your profile.</p>
        </div>
        <ol className="steps" aria-label="Progress">
          {STEPS.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined} className={i < step ? 'done' : undefined}><span className="dot">{i + 1}</span>{s}</li>)}
        </ol>

        <form className="form" onSubmit={(e) => { e.preventDefault(); if (last) save(); else setStep(step + 1); }} noValidate>
          {step === 0 && (
            <>
              <h2 className="welcome-step">About you</h2>
              <TextField label="Phone number" type="tel" autoComplete="tel" value={f.contact?.phone ?? ''} onChange={(e) => set({ contact: { ...f.contact, phone: e.target.value } })} />
              <div className="form-row">
                <TextField label="City" autoComplete="address-level2" value={f.address?.city ?? ''} onChange={(e) => set({ address: { ...f.address, city: e.target.value } })} />
                <TextField label="Country" autoComplete="country-name" value={f.address?.country ?? ''} onChange={(e) => set({ address: { ...f.address, country: e.target.value } })} />
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="welcome-step">Allergies</h2>
              <p style={{ color: 'var(--ink-2)' }}>Medicines, foods or other things that cause you a reaction. Clinicians use this to keep prescribing safe.</p>
              <label className="check"><input type="checkbox" checked={noAllergies} onChange={(e) => { setNoAllergies(e.target.checked); if (e.target.checked) set({ allergies: [] }); }} />I have no known allergies</label>
              {!noAllergies && (
                <div className="stack">
                  {f.allergies.map((a, i) => (
                    <div className="form-row" key={i} style={{ alignItems: 'end', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) auto' }}>
                      <TextField label={`Allergy ${i + 1}`} value={a.substance} onChange={(e) => set({ allergies: f.allergies.map((x, j) => (j === i ? { ...x, substance: e.target.value } : x)) })} />
                      <SelectField label="Severity" value={a.severity} onChange={(e) => set({ allergies: f.allergies.map((x, j) => (j === i ? { ...x, severity: e.target.value as Patient['allergies'][0]['severity'] } : x)) })}><option>Mild</option><option>Moderate</option><option>Severe</option></SelectField>
                      <Button type="button" variant="danger" className="fit" aria-label={`Remove allergy ${i + 1}`} onClick={() => set({ allergies: f.allergies.filter((_, j) => j !== i) })}><Trash2 className="icon" aria-hidden /></Button>
                    </div>
                  ))}
                  <div><Button type="button" variant="secondary" className="fit" onClick={() => set({ allergies: [...f.allergies, { substance: '', severity: 'Mild' }] })}><Plus className="icon" aria-hidden />Add an allergy</Button></div>
                </div>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="welcome-step">Emergency contact</h2>
              <p style={{ color: 'var(--ink-2)' }}>Someone we can reach if there is a problem during a visit.</p>
              <TextField label="Contact name" value={ec.name === 'Not provided' ? '' : ec.name} onChange={(e) => set({ emergencyContact: { ...ec, name: e.target.value } })} error={err?.fieldError('emergencyContact.name')} />
              <div className="form-row">
                <TextField label="Relationship" value={ec.relationship === 'Unknown' ? '' : ec.relationship} onChange={(e) => set({ emergencyContact: { ...ec, relationship: e.target.value } })} error={err?.fieldError('emergencyContact.relationship')} />
                <TextField label="Contact phone" type="tel" value={ec.phone ?? ''} onChange={(e) => set({ emergencyContact: { ...ec, phone: e.target.value } })} />
              </div>
            </>
          )}

          {err && !err.details && <Banner kind="error">{err.message}</Banner>}
          {err?.details && <Banner kind="error" title="Please check your answers">{err.details.map((d) => d.message).join('. ')}</Banner>}
          <div className="welcome-actions">
            <Button type="button" variant="plain" className="fit" loading={finish.isPending && finish.variables?.skip === true} onClick={() => finish.mutate({ skip: true })}>Skip for now</Button>
            <span style={{ flex: 1 }} />
            {step > 0 && <Button type="button" variant="secondary" className="fit" onClick={() => setStep(step - 1)}>Back</Button>}
            <Button type="submit" className="fit" disabled={!canContinue} loading={finish.isPending && finish.variables?.skip !== true}>{last ? 'Finish' : 'Continue'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
