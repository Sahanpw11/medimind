import type { ReactNode } from 'react';
import { Link, Navigate, NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Patient } from '../lib/types';
import { BarChart3, CalendarDays, ClipboardList, FileText, Home, LogOut, MessageCircleHeart, Stethoscope, UserRound, Users } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useOnline } from '../lib/pwa';
import type { Role } from '../lib/types';
import { Avatar, Logo } from './ui';
import { Bell_, HeaderSearch, NewMenu, Popover } from './HeaderBits';

interface Item { to: string; label: string; icon: ReactNode; end?: boolean; desktop?: boolean }
const I = (C: typeof Home) => <C className="icon" aria-hidden />;

// desktop: false keeps an item out of the header nav (it lives in the avatar menu) but still on the phone tab bar.
const NAV: Record<Role, Item[]> = {
  patient: [
    { to: '/', label: 'Home', icon: I(Home), end: true, desktop: true },
    { to: '/doctors', label: 'Doctors', icon: I(Stethoscope), desktop: true },
    { to: '/appointments', label: 'Visits', icon: I(CalendarDays), desktop: true },
    { to: '/assistant', label: 'Assistant', icon: I(MessageCircleHeart), desktop: true },
    { to: '/records', label: 'Records', icon: I(ClipboardList), desktop: true },
    { to: '/documents', label: 'Documents', icon: I(FileText), desktop: true },
    { to: '/profile', label: 'Profile', icon: I(UserRound), desktop: false },
  ],
  doctor: [
    { to: '/dashboard', label: 'Dashboard', icon: I(BarChart3), desktop: true },
    { to: '/schedule', label: 'Appointments', icon: I(CalendarDays), desktop: true },
    { to: '/profile', label: 'Account', icon: I(UserRound), desktop: false },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', icon: I(BarChart3), end: true, desktop: true },
    { to: '/admin/doctors', label: 'Doctors', icon: I(Users), desktop: true },
    { to: '/profile', label: 'Account', icon: I(UserRound), desktop: false },
  ],
};
// Phone tab bar: the patient's 7 items do not fit, so Records and Documents live under Home shortcuts there.
const MOBILE_HIDE = new Set(['/records', '/documents']);

export function Shell() {
  const { user, logout } = useAuth();
  const online = useOnline();
  const items = NAV[user!.role];
  const name = user!.email.split('@')[0];
  // Freshly registered patients (onboardingDone === false) finish a short welcome flow first. Seeded patients have no flag.
  const profile = useQuery({ enabled: user!.role === 'patient', queryKey: ['patient', user!.profileId], queryFn: () => api<Patient>(`/patients/${user!.profileId}`) });
  if (user!.role === 'patient' && profile.data?.onboardingDone === false) return <Navigate to="/welcome" replace />;
  return (
    <div className="app">
      <a href="#main" className="sr-only">Skip to content</a>
      <header className="topbar">
        <Link to="/" className="brand"><Logo /><span>MediMind</span></Link>
        <nav className="hnav" aria-label="Main">
          {items.filter((i) => i.desktop).map((i) => <NavLink key={i.to} to={i.to} end={i.end} aria-label={i.label}>{i.icon}<span className="lbl">{i.label}</span></NavLink>)}
        </nav>
        <div className="spacer" />
        <HeaderSearch role={user!.role} destinations={items.map((i) => ({ label: i.label, to: i.to }))} />
        <NewMenu role={user!.role} />
        <Bell_ />
        <Popover label="Account menu" className="usertrigger" trigger={<><Avatar name={name} /><span className="who"><b>{name}</b><span>{user!.role}</span></span></>}>
          {(close) => (
            <>
              <div className="meta">{user!.email}</div>
              <Link to="/profile" className="mi" onClick={close}><UserRound className="icon" aria-hidden />{user!.role === 'patient' ? 'Profile' : 'Account'}</Link>
              <button type="button" className="mi danger" onClick={() => void logout()}><LogOut className="icon" aria-hidden />Sign out</button>
            </>
          )}
        </Popover>
      </header>
      {!online && <div className="offline-bar" role="status">You are offline. Medical data is never stored on this device, so it will reload when you reconnect.</div>}
      <main id="main" className="content"><Outlet /></main>
      <footer className="app-foot">Educational prototype. Synthetic data only. Not medical advice.</footer>
      <nav className="tabbar" aria-label="Main">
        {items.filter((i) => !MOBILE_HIDE.has(i.to)).map((i) => <NavLink key={i.to} to={i.to} end={i.end}>{i.icon}<span>{i.label}</span></NavLink>)}
      </nav>
    </div>
  );
}
