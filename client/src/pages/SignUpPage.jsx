import { useState } from 'react';
import { SignUp } from '@clerk/react';
import { Link } from 'react-router-dom';

const RIDER_INFO = {
  icon: '🚗',
  badge: 'Quick setup · under 2 min',
  badgeCls: 'role-badge-green',
  title: "Let's get you riding",
  intro: "You're almost there! Here's all you'll need to create your rider account:",
  points: [
    'Your name and email address',
    'A secure password',
    'A payment method (credit, debit, or cash on arrival)',
  ],
  note: 'No waiting period or background check — just sign up and your first ride is minutes away.',
  cta: 'Create Rider Account →',
};

const DRIVER_INFO = {
  icon: '🛞',
  badge: 'Application required · reviewed within 3–5 days',
  badgeCls: 'role-badge-amber',
  title: 'Driver Application Overview',
  intro: 'All RideFlow drivers go through a thorough vetting process to keep riders safe:',
  steps: [
    { icon: '📋', text: 'Submit your application (takes ~10 min)' },
    { icon: '🔍', text: 'Background check — criminal history & driving record' },
    { icon: '🚘', text: 'Vehicle inspection — year, condition & insurance' },
    { icon: '📄', text: 'Document upload — license, registration, proof of insurance' },
    { icon: '✅', text: 'Onboarding module — quick online orientation (~30 min)' },
  ],
  note: 'Once approved, you keep 65% of every fare — one of the best splits in the industry.',
  cta: 'Start Driver Application →',
};

const SignUpPage = () => {
  const [step,       setStep]       = useState('role');
  const [chosenRole, setChosenRole] = useState(null);

  const pickRole = (roleId) => {
    setChosenRole(roleId);
    setStep('info');
  };

  const confirmRole = () => {
    sessionStorage.setItem('rideflow-pending-role', chosenRole);
    setStep('signup');
  };

  /* ── Step: Clerk sign-up form ─────────────────────────────────────────── */
  if (step === 'signup') {
    return (
      <div className="auth-page">
        <SignUp routing="path" path="/sign-up" fallbackRedirectUrl="/onboarding" />
      </div>
    );
  }

  /* ── Step: Role info screen ───────────────────────────────────────────── */
  if (step === 'info') {
    const info = chosenRole === 'rider' ? RIDER_INFO : DRIVER_INFO;
    return (
      <div className="onboarding-page">
        <div className="onboarding-card onboarding-card-info">
          <button className="role-info-back" onClick={() => setStep('role')}>← Back</button>

          <div className="onboarding-logo">
            <span className="brand-ride">Ride</span>
            <span className="brand-flow">Flow</span>
          </div>

          <span className="role-icon" style={{ fontSize: '2.5rem', display: 'block', margin: '0.5rem 0' }}>
            {info.icon}
          </span>

          <span className={`role-badge ${info.badgeCls}`} style={{ marginBottom: '0.75rem' }}>
            {info.badge}
          </span>

          <h2 className="role-info-title">{info.title}</h2>
          <p className="role-info-intro">{info.intro}</p>

          <div className="role-info-steps">
            {chosenRole === 'rider'
              ? info.points.map((p, i) => (
                  <div key={i} className="role-info-step">
                    <span className="role-info-step-check">✓</span>
                    <span>{p}</span>
                  </div>
                ))
              : info.steps.map((s, i) => (
                  <div key={i} className="role-info-step">
                    <span className="role-info-step-icon">{s.icon}</span>
                    <span>{s.text}</span>
                  </div>
                ))}
          </div>

          <div className="role-info-note">{info.note}</div>

          <div className="role-info-actions">
            <button className="btn btn-magenta role-info-cta" onClick={confirmRole}>
              {info.cta}
            </button>
            <Link to="/sign-in" className="role-info-signin">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Step: Role selection ─────────────────────────────────────────────── */
  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <div className="onboarding-logo">
          <span className="brand-ride">Ride</span>
          <span className="brand-flow">Flow</span>
        </div>
        <h1 className="onboarding-heading">How will you use RideFlow?</h1>
        <p className="onboarding-sub">Choose your role to get started.</p>
        <div className="onboarding-roles">
          <button className="role-card" onClick={() => pickRole('rider')}>
            <span className="role-badge role-badge-green">Quick signup · 2 min</span>
            <span className="role-icon">🚗</span>
            <h3 className="role-title">I'm a Rider</h3>
            <p className="role-desc">Request rides instantly. Track your driver. Pay in-app.</p>
          </button>
          <button className="role-card" onClick={() => pickRole('driver')}>
            <span className="role-badge role-badge-amber">Application required</span>
            <span className="role-icon">🛞</span>
            <h3 className="role-title">I'm a Driver</h3>
            <p className="role-desc">Apply, get approved, and start earning. Keep 65% of every fare.</p>
          </button>
        </div>
        <p className="onboarding-signin-note">
          Already have an account?{' '}
          <Link to="/sign-in" className="onboarding-signin-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default SignUpPage;
