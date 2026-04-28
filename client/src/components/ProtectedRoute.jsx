import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/react';
import { Navigate } from 'react-router-dom';
import { setAuthToken } from '../services/api';

const ROLE_HOME = { rider: '/rider', driver: '/driver', admin: '/admin' };

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    getToken().then((token) => {
      setAuthToken(token);
      setTokenReady(true);
    });
  }, [isLoaded, isSignedIn, getToken]);

  if (!isLoaded || (isSignedIn && !tokenReady)) {
    return (
      <div className="auth-loading">
        <span className="spinner" />
        Loading…
      </div>
    );
  }

  if (!isSignedIn) return <Navigate to="/sign-in" replace />;

  const role = user?.publicMetadata?.role;

  // Signed in but no role yet → must complete onboarding first
  if (!role && requiredRole !== null) return <Navigate to="/onboarding" replace />;

  // admin and manager can access any portal
  if (requiredRole && role !== requiredRole && role !== 'manager' && role !== 'admin') {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
};

export default ProtectedRoute;
