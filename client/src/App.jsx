import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { AppProvider, useAppContext } from './context/AppContext';
import Navbar           from './components/Navbar';
import Toast            from './components/Toast';
import ProtectedRoute   from './components/ProtectedRoute';
import HomePage         from './pages/HomePage';
import OnboardingPage   from './pages/OnboardingPage';
import RidersPage       from './pages/RidersPage';
import RiderPortalPage  from './pages/RiderPortalPage';
import DriverPortalPage from './pages/DriverPortalPage';
import AdminPage        from './pages/AdminPage';
import SignInPage       from './pages/SignInPage';
import SignUpPage       from './pages/SignUpPage';
import { setAuthToken } from './services/api';

const AuthSync = () => {
  const { getToken, isSignedIn } = useAuth();
  useEffect(() => {
    if (!isSignedIn) { setAuthToken(null); return; }
    const sync = async () => { setAuthToken(await getToken()); };
    sync();
    const interval = setInterval(sync, 55 * 1000);
    return () => clearInterval(interval);
  }, [isSignedIn, getToken]);
  return null;
};

const PORTAL_ROUTES = ['/rider', '/driver', '/admin'];

const AppInner = () => {
  const location = useLocation();
  const isHome   = location.pathname === '/';
  const isPortal = PORTAL_ROUTES.includes(location.pathname);
  const isAuth   = ['/sign-in', '/sign-up', '/onboarding'].some((p) => location.pathname.startsWith(p));

  const { theme, toggleTheme, toasts, removeToast, addToast } = useAppContext();

  return (
    <div className={`app-shell${isPortal ? ' portal-mode' : ''}`}>
      <AuthSync />
      {!isPortal && !isAuth && (
        <Navbar
          theme={theme}
          onThemeToggle={toggleTheme}
          showThemeToggle={!isHome}
          showCta={isHome}
        />
      )}

      <main className={!isHome && !isPortal && !isAuth ? 'main-content' : ''}>
        <Routes>
          <Route path="/"          element={<HomePage />} />
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />

          <Route path="/onboarding" element={
            <ProtectedRoute><OnboardingPage /></ProtectedRoute>
          } />

          <Route path="/rider" element={
            <ProtectedRoute requiredRole="rider">
              <RiderPortalPage theme={theme} onThemeToggle={toggleTheme} />
            </ProtectedRoute>
          } />
          <Route path="/driver" element={
            <ProtectedRoute requiredRole="driver">
              <DriverPortalPage theme={theme} onThemeToggle={toggleTheme} />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute requiredRole="admin">
              <AdminPage theme={theme} onThemeToggle={toggleTheme} />
            </ProtectedRoute>
          } />
          <Route path="/riders" element={
            <ProtectedRoute requiredRole="admin">
              <RidersPage addToast={addToast} />
            </ProtectedRoute>
          } />
        </Routes>
      </main>

      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

const App = () => (
  <AppProvider>
    <AppInner />
  </AppProvider>
);

export default App;
