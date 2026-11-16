import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import type { Role } from '../lib/types';
import { Banner, Button, Logo, TextField } from '../components/ui';

export const homeFor = (r: Role) => (r === 'admin' ? '/admin' : r === 'doctor' ? '/dashboard' : '/');
const DEMOS = [['Patient', 'patient@demo.test'], ['Doctor', 'doctor@demo.test'], ['Administrator', 'admin@demo.test']];

function AuthShell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-aside">
        <div className="brand"><Logo /> MediMind</div>
        <div>
          <h2>Appointments and records, kept in one place.</h2>
          <div className="auth-points">
            <div><b>Book without clashes</b><span>Each 30-minute slot is reserved once, so two people can never hold the same time.</span></div>
            <div><b>Your history stays yours</b><span>Records are visible only to you and to doctors you have seen.</span></div>
            <div><b>Learn within limits</b><span>The assistant explains general health topics, cites its sources and never diagnoses.</span></div>
          </div>
        </div>
        <small>Educational prototype. Synthetic data only. Not medical advice.</small>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <div className="brand"><Logo /> MediMind</div>
          <div className="auth-brand"><h1>{title}</h1><p>{sub}</p></div>
          {children}
        </div>
      </main>
    </div>
  );
}

export function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [err, setErr] = useState<ApiError | null>(null), [busy, setBusy] = useState(false);
  if (user) return <Navigate to={from ?? homeFor(user.role)} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { const u = await login(email, password); nav(from ?? homeFor(u.role), { replace: true }); }
    catch (x) { setErr(x as ApiError); } finally { setBusy(false); }
  }
  return (
    <AuthShell title="Sign in" sub="Welcome back. Enter your details to continue.">
      <form className="form" onSubmit={submit} noValidate>
        {err && <Banner kind="error">{err.message}</Banner>}
        <TextField label="Email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" loading={busy} disabled={!email || !password}>Sign in</Button>
        <p style={{ textAlign: 'center' }}>New here? <Link to="/register">Create an account</Link></p>
      </form>
      <details>
        <summary style={{ minHeight: 44, display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'var(--ink-2)' }}>Demo accounts (synthetic data)</summary>
        <div className="demo-list" style={{ marginTop: 8 }}>
          {DEMOS.map(([label, mail]) => (
            <button key={mail} type="button" onClick={() => { setEmail(mail); setPassword('Demo@12345'); }}><span>{label}</span><span style={{ color: 'var(--ink-2)' }}>{mail}</span></button>
          ))}
        </div>
      </details>
    </AuthShell>
  );
}

export function Register() {
  const { user, register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ fullName: '', email: '', dateOfBirth: '', password: '' });
  const [err, setErr] = useState<ApiError | null>(null), [busy, setBusy] = useState(false);
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await register(f); nav('/', { replace: true }); } catch (x) { setErr(x as ApiError); } finally { setBusy(false); }
  }
  return (
    <AuthShell title="Create your account" sub="Patient accounts only. Please use fabricated details.">
      <form className="form" onSubmit={submit} noValidate>
        {err && !err.details && <Banner kind="error">{err.message}</Banner>}
        <TextField label="Full name" autoComplete="name" required value={f.fullName} onChange={set('fullName')} error={err?.fieldError('fullName')} />
        <TextField label="Email" type="email" autoComplete="email" required value={f.email} onChange={set('email')} error={err?.fieldError('email')} />
        <TextField label="Date of birth" type="date" required value={f.dateOfBirth} onChange={set('dateOfBirth')} error={err?.fieldError('dateOfBirth')} max={new Date().toISOString().slice(0, 10)} />
        <TextField label="Password" type="password" autoComplete="new-password" required value={f.password} onChange={set('password')} error={err?.fieldError('password')} hint="At least 8 characters, with a letter and a number." />
        <Button type="submit" loading={busy} disabled={!f.fullName || !f.email || !f.dateOfBirth || !f.password}>Create account</Button>
        <p style={{ textAlign: 'center' }}>Already registered? <Link to="/login">Sign in</Link></p>
      </form>
    </AuthShell>
  );
}
