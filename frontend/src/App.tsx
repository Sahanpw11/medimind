import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import type { Role } from './lib/types';
import { Shell } from './components/Shell';
import { SkeletonRows } from './components/ui';
import { homeFor, Login, Register } from './pages/Auth';
import Account from './pages/Account';

const Home = lazy(() => import('./pages/patient/Home'));
const Doctors = lazy(() => import('./pages/patient/Doctors'));
const DoctorDetail = lazy(() => import('./pages/patient/DoctorDetail'));
const Appointments = lazy(() => import('./pages/patient/Appointments'));
const Records = lazy(() => import('./pages/patient/Records'));
const Documents = lazy(() => import('./pages/patient/Documents'));
const Profile = lazy(() => import('./pages/patient/Profile'));
const Assistant = lazy(() => import('./pages/patient/Assistant'));
const Welcome = lazy(() => import('./pages/patient/Welcome'));
const Schedule = lazy(() => import('./pages/doctor/Schedule'));
const DoctorDashboard = lazy(() => import('./pages/doctor/DoctorDashboard'));
const VisitRecord = lazy(() => import('./pages/doctor/VisitRecord'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const DoctorAdmin = lazy(() => import('./pages/admin/DoctorAdmin'));

function Protected({ roles, children }: { roles?: Role[]; children: React.ReactNode }) {
  const { user, loading, signedOut } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="page" style={{ paddingTop: 80 }}><SkeletonRows n={3} /></div>;
  if (!user) return <Navigate to="/login" state={signedOut ? undefined : { from: loc.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Suspense fallback={<div className="page" style={{ paddingTop: 80 }}><SkeletonRows n={3} /></div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="welcome" element={<Protected roles={['patient']}><Welcome /></Protected>} />
        <Route element={<Protected><Shell /></Protected>}>
          <Route index element={user && user.role !== 'patient' ? <Navigate to={homeFor(user.role)} replace /> : <Protected roles={['patient']}><Home /></Protected>} />
          <Route path="doctors" element={<Protected roles={['patient']}><Doctors /></Protected>} />
          <Route path="doctors/:id" element={<Protected roles={['patient']}><DoctorDetail /></Protected>} />
          <Route path="appointments" element={<Protected roles={['patient']}><Appointments /></Protected>} />
          <Route path="records" element={<Protected roles={['patient']}><Records /></Protected>} />
          <Route path="documents" element={<Protected roles={['patient']}><Documents /></Protected>} />
          <Route path="assistant" element={<Protected roles={['patient']}><Assistant /></Protected>} />
          <Route path="profile" element={user?.role === 'patient' ? <Protected roles={['patient']}><Profile /></Protected> : <Account />} />
          <Route path="dashboard" element={<Protected roles={['doctor']}><DoctorDashboard /></Protected>} />
          <Route path="schedule" element={<Protected roles={['doctor']}><Schedule /></Protected>} />
          <Route path="schedule/:id/record" element={<Protected roles={['doctor']}><VisitRecord /></Protected>} />
          <Route path="admin" element={<Protected roles={['admin']}><Dashboard /></Protected>} />
          <Route path="admin/doctors" element={<Protected roles={['admin']}><DoctorAdmin /></Protected>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
