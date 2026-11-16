import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, LogOut, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useInstall } from '../../lib/pwa';
import type { Patient } from '../../lib/types';
import { Avatar, Banner, Button, Card, ErrorState, Screen, SelectField, SkeletonRows, TextField } from '../../components/ui';

export default function Profile() {
  const { user, logout } = useAuth();
  const pwa = useInstall();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['patient', user!.profileId], queryFn: () => api<Patient>(`/patients/${user!.profileId}`) });
  const [f, setF] = useState<Patient | null>(null);
  useEffect(() => { if (q.data) setF(q.data); }, [q.data]);
  const save = useMutation({
    mutationFn: (p: Patient) => api<Patient>(`/patients/${user!.profileId}`, { method: 'PUT', body: { fullName: p.fullName, dateOfBirth: p.dateOfBirth, contact: p.contact, address: p.address, allergies: p.allergies, emergencyContact: p.emergencyContact } }),
    onSuccess: (p) => qc.setQueryData(['patient', user!.profileId], p),
  });
  if (q.isPending || !f) return <Screen title="Profile">{q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : <SkeletonRows n={4} />}</Screen>;
  const err = save.error instanceof ApiError ? save.error : null;
  const fe = (k: string) => err?.fieldError(k);
  const set = (patch: Partial<Patient>) => setF({ ...f, ...patch });

  return (
    <Screen title="Profile" subtitle="Keep your details and allergies current. Clinicians rely on them.">
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(f); }} noValidate>
        <div className="cols">
          <div className="s8 stack lg">
            <Card title="About you">
              <div className="form">
                <div className="form-row">
                  <TextField label="Full name" value={f.fullName} onChange={(e) => set({ fullName: e.target.value })} error={fe('fullName')} />
                  <TextField label="Date of birth" type="date" value={f.dateOfBirth.slice(0, 10)} onChange={(e) => set({ dateOfBirth: e.target.value })} error={fe('dateOfBirth')} />
                </div>
                <div className="form-row">
                  <TextField label="Phone" type="tel" value={f.contact?.phone ?? ''} onChange={(e) => set({ contact: { ...f.contact, phone: e.target.value } })} />
                  <TextField label="City" value={f.address?.city ?? ''} onChange={(e) => set({ address: { ...f.address, city: e.target.value } })} />
                  <TextField label="Country" value={f.address?.country ?? ''} onChange={(e) => set({ address: { ...f.address, country: e.target.value } })} />
                </div>
              </div>
            </Card>
            <Card title="Allergies" hint="Up to 50, stored inside your profile document">
              <div className="stack">
                {f.allergies.length === 0 && <p style={{ color: 'var(--ink-2)' }}>No known allergies recorded.</p>}
                {f.allergies.map((a, i) => (
                  <div className="form-row" key={i} style={{ alignItems: 'end', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) auto' }}>
                    <TextField label={`Allergy ${i + 1}`} value={a.substance} onChange={(e) => set({ allergies: f.allergies.map((x, j) => (j === i ? { ...x, substance: e.target.value } : x)) })} />
                    <SelectField label="Severity" value={a.severity} onChange={(e) => set({ allergies: f.allergies.map((x, j) => (j === i ? { ...x, severity: e.target.value as Patient['allergies'][0]['severity'] } : x)) })}>
                      <option>Mild</option><option>Moderate</option><option>Severe</option>
                    </SelectField>
                    <Button type="button" variant="danger" className="fit" aria-label={`Remove allergy ${i + 1}`} onClick={() => set({ allergies: f.allergies.filter((_, j) => j !== i) })}><Trash2 className="icon" aria-hidden />Remove</Button>
                  </div>
                ))}
                <div><Button type="button" variant="secondary" className="fit" disabled={f.allergies.length >= 50} onClick={() => set({ allergies: [...f.allergies, { substance: '', severity: 'Mild' }] })}><Plus className="icon" aria-hidden />Add allergy</Button></div>
              </div>
            </Card>
            <Card title="Emergency contact">
              <div className="form-row">
                <TextField label="Name" value={f.emergencyContact.name} onChange={(e) => set({ emergencyContact: { ...f.emergencyContact, name: e.target.value } })} error={fe('emergencyContact.name')} />
                <TextField label="Relationship" value={f.emergencyContact.relationship} onChange={(e) => set({ emergencyContact: { ...f.emergencyContact, relationship: e.target.value } })} error={fe('emergencyContact.relationship')} />
                <TextField label="Phone" type="tel" value={f.emergencyContact.phone ?? ''} onChange={(e) => set({ emergencyContact: { ...f.emergencyContact, phone: e.target.value } })} />
              </div>
            </Card>
            {err && !err.details && <Banner kind="error">{err.message}</Banner>}
            {err?.details && <Banner kind="error" title="Please fix the highlighted fields">{err.details.map((d) => d.message).join('. ')}</Banner>}
            {save.isSuccess && <Banner kind="success">Profile saved.</Banner>}
            <div><Button type="submit" className="fit" loading={save.isPending}>Save changes</Button></div>
          </div>
          <div className="s4 stack lg">
            <Card title="Account">
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}><Avatar name={f.fullName} large /><div><b>{f.fullName}</b><p style={{ color: 'var(--ink-2)', overflowWrap: 'anywhere' }}>{user!.email}</p></div></div>
              <div className="stack sm">
                {pwa.canInstall && <Button type="button" variant="secondary" onClick={pwa.install}><Download className="icon" aria-hidden />Install MediMind</Button>}
                <Button type="button" variant="danger" onClick={() => void logout()}><LogOut className="icon" aria-hidden />Sign out</Button>
              </div>
            </Card>
          </div>
        </div>
      </form>
    </Screen>
  );
}
