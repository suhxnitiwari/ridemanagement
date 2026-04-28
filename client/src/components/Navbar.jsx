import { Link, useLocation } from 'react-router-dom';
import { useAuth, useUser, UserButton, SignInButton } from '@clerk/react';

const ALL_LINKS = [
  { label: 'Riders',  to: '/rider',  roles: ['rider',  'manager'] },
  { label: 'Drivers', to: '/driver', roles: ['driver', 'manager'] },
  { label: 'Admin',   to: '/admin',  roles: ['admin',  'manager'] },
];

const Navbar = ({ theme, onThemeToggle, showThemeToggle, showCta }) => {
  const location = useLocation();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const role = user?.publicMetadata?.role;
  const navLinks = role
    ? ALL_LINKS.filter((link) => link.roles.includes(role))
    : ALL_LINKS;
  const isLight = theme === 'light';

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <span className="brand-ride">Ride</span>
        <span className="brand-flow">Flow</span>
      </Link>

      <div className="navbar-nav">
        {navLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`nav-link${location.pathname === link.to ? ' active' : ''}`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="navbar-right">
        {(showThemeToggle || showCta) && (
          <label className="theme-toggle" aria-label="Toggle theme">
            <span>{isLight ? 'Light' : 'Dark'}</span>
            <span className="toggle-switch">
              <input
                type="checkbox"
                checked={isLight}
                onChange={onThemeToggle}
              />
              <span className="toggle-track" />
              <span className="toggle-thumb" />
            </span>
          </label>
        )}

        {showCta && !isSignedIn && (
          <button className="btn-dark">Get notified</button>
        )}

        {isSignedIn ? (
          <UserButton afterSignOutUrl="/" />
        ) : (
          <SignInButton mode="modal">
            <button className="btn btn-primary btn-sm">Sign in</button>
          </SignInButton>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
