import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { statsApi } from '../services/api';

const REVIEWS = [
  {
    stars: '★★★★★',
    quote: 'Finally an app where I can see exactly where my driver is and what the fare will be before I even confirm.',
    initials: 'AP', color: 'pink', name: 'Ava P.', role: 'Rider · Austin, TX', dark: false,
  },
  {
    stars: '★★★★★',
    quote: 'The driver dashboard is clean. I can see my earnings, accept rides, and track my week — all in one place.',
    initials: 'ML', color: 'purple', name: 'Marcus L.', role: 'Driver · Austin, TX', dark: true,
  },
  {
    stars: '★★★★★',
    quote: 'The admin panel makes it so easy to manage everything — filter rides, assign drivers, view payments instantly.',
    initials: 'ST', color: 'pink', name: 'Sofia T.', role: 'Admin · Operations Lead', dark: false,
  },
  {
    stars: '★★★★★',
    quote: 'I love that I can set my driver preferences. Quiet ride, no music — exactly how I like it. Never going back.',
    initials: 'JK', color: 'purple', name: 'Jasmine K.', role: 'Rider · Houston, TX', dark: true,
  },
  {
    stars: '★★★★★',
    quote: 'RideFlow matched me with a rider two minutes after I went online. The earnings are transparent and fair.',
    initials: 'DW', color: 'pink', name: 'Darius W.', role: 'Driver · Dallas, TX', dark: false,
  },
  {
    stars: '★★★★★',
    quote: 'Super smooth booking experience. The map shows the real route and the fare estimate was spot on.',
    initials: 'RL', color: 'purple', name: 'Riley L.', role: 'Rider · San Antonio, TX', dark: true,
  },
];

const TestimonialsCarousel = () => {
  const [startIdx, setStartIdx] = useState(0);
  const total = REVIEWS.length;

  const prev = () => setStartIdx((i) => (i - 1 + total) % total);
  const next = () => setStartIdx((i) => (i + 1) % total);

  const displayed = [0, 1, 2].map((offset) => REVIEWS[(startIdx + offset) % total]);

  return (
    <div className="testimonials-carousel-wrap">
      <button className="testimonials-nav-btn" onClick={prev} aria-label="Previous">‹</button>

      <div className="testimonials-grid">
        {displayed.map((r, i) => (
          <div key={`${startIdx}-${i}`} className={`testimonial-card ${r.dark ? 'testimonial-dark' : 'testimonial-light'}`}>
            <div className="t-stars">{r.stars}</div>
            <p className="t-quote">"{r.quote}"</p>
            <div className="t-author">
              <div className={`t-avatar t-avatar-${r.color}`}>{r.initials}</div>
              <div>
                <div className="t-name">{r.name}</div>
                <div className="t-role">{r.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="testimonials-nav-btn" onClick={next} aria-label="Next">›</button>
    </div>
  );
};

const HomePage = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    statsApi.get()
      .then((res) => setStats(res.data?.data ?? null))
      .catch(() => {});
  }, []);

  const driver = stats?.featured_driver;

  return (
    <div className="landing">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-left">
          <h1 className="hero-headline">
            Rides,<br />Simplified.<br />
            <span className="hero-headline-magenta">For<br />Everyone.</span>
          </h1>

          <p className="hero-sub">
            Book a ride in seconds. Track your driver in real time.
            Arrive on schedule — with full fare transparency from the start.
          </p>

          <div className="hero-cta-row">
            <Link to="/sign-up" className="btn btn-magenta hero-cta-primary">Get started</Link>
            <Link to="/sign-in" className="btn btn-dark hero-cta-secondary">Sign in</Link>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-num">{stats ? stats.total_rides : '—'}</span>
              <span className="hero-stat-label">Rides booked</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-num">{stats ? stats.completed_rides : '—'}</span>
              <span className="hero-stat-label">Trips completed</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-num">{stats ? stats.total_riders : '—'}</span>
              <span className="hero-stat-label">Riders</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-num">{stats ? stats.total_drivers : '—'}</span>
              <span className="hero-stat-label">Drivers</span>
            </div>
          </div>
        </div>

        <div className="hero-right">
          <div className="driver-card">
            <div className="driver-card-header">
              <div className="driver-avatar">
                {driver ? driver.initials : '—'}
              </div>
              <div className="driver-info">
                <div className="driver-name">
                  {driver ? `${driver.name} · ${driver.license_plate}` : 'Loading…'}
                </div>
                <div className="driver-stars">
                  {'★'.repeat(Math.round(parseFloat(driver?.rating ?? 5)))}{' '}
                  <span>{driver?.rating ?? '—'}</span>
                </div>
              </div>
              <span className="arrived-badge">Arrived!</span>
            </div>

            <div className="map-placeholder">
              <div className="map-grid" />
              <div className="map-route">
                <div className="map-dot map-dot-you">
                  <span className="map-dot-label">You</span>
                </div>
                <div className="map-line" />
                <div className="map-dot map-dot-dest">
                  <span className="map-dot-label">Destination</span>
                </div>
              </div>
            </div>

            <div className="ride-status-bar">
              <div className="ride-status-label">RIDE STATUS</div>
              <div className="ride-status-track">
                <div className="rs-step rs-done">
                  <div className="rs-dot" /><span>Requested</span>
                </div>
                <div className="rs-line rs-line-done" />
                <div className="rs-step rs-done">
                  <div className="rs-dot" /><span>Accepted</span>
                </div>
                <div className="rs-line rs-line-done" />
                <div className="rs-step rs-done">
                  <div className="rs-dot" /><span>En Route</span>
                </div>
                <div className="rs-line" />
                <div className="rs-step">
                  <div className="rs-dot rs-dot-empty" /><span>In Progress</span>
                </div>
                <div className="rs-line" />
                <div className="rs-step">
                  <div className="rs-dot rs-dot-empty" /><span>Done</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Cards ────────────────────────────────────── */}
      <section className="features-section">
        <div className="feature-cards">
          <div className="feature-card feature-card-light">
            <div className="feature-icon-wrap feature-icon-light">
              <span className="feature-icon">⬡</span>
            </div>
            <h3>Live ride tracking</h3>
            <p>Watch your driver move in real time from request to dropoff.</p>
          </div>

          <div className="feature-card feature-card-dark">
            <div className="feature-icon-wrap feature-icon-dark">
              <span className="feature-icon">⬡</span>
            </div>
            <h3>Integrated payments</h3>
            <p>Auto payment records on completion with full history.</p>
          </div>

          <div className="feature-card feature-card-light">
            <div className="feature-icon-wrap feature-icon-light">
              <span className="feature-icon">⬡</span>
            </div>
            <h3>Admin dashboard</h3>
            <p>Live stats, ride management, and driver assignment in one view.</p>
          </div>
        </div>
      </section>

      {/* ── Mini Features ─────────────────────────────────────── */}
      <section className="mini-features">
        <div className="mini-feature">
          <div className="mini-num">01</div>
          <h4>Instant matching</h4>
          <p>Drivers matched to nearby requests automatically.</p>
        </div>
        <div className="mini-feature">
          <div className="mini-num">02</div>
          <h4>Transparent fares</h4>
          <p>See your exact fare — base, distance, and fees — before you confirm.</p>
        </div>
        <div className="mini-feature">
          <div className="mini-num">03</div>
          <h4>Live status updates</h4>
          <p>Every status change reflected to riders in real time.</p>
        </div>
        <div className="mini-feature">
          <div className="mini-num">04</div>
          <h4>Full ride history</h4>
          <p>Every completed trip logged with fare, route, and payment records.</p>
        </div>
      </section>

      {/* ── Differentiators ──────────────────────────────────── */}
      <section className="differentiators-section">
        <div className="diff-inner">
          <div className="diff-header">
            <div className="diff-eyebrow">Why RideFlow</div>
            <h2 className="diff-heading">What sets us apart</h2>
            <p className="diff-sub">
              Built around trust, transparency, and real user control — not growth at all costs.
            </p>
          </div>
          <div className="diff-grid">
            <div className="diff-card">
              <div className="diff-num">01</div>
              <h3>No surge pricing, ever</h3>
              <p>
                Fixed model: base fare plus distance. The full cost is shown before you confirm.
                No demand multipliers, no unexplained spikes. Competitors optimize for revenue —
                we optimize for predictability.
              </p>
            </div>
            <div className="diff-card">
              <div className="diff-num">02</div>
              <h3>Real safety control</h3>
              <p>
                Half our full-time driver fleet is female — 5 out of 10. Every driver is
                background-checked. You can choose a driver that matches your comfort level.
                That is actual control, not just a policy statement.
              </p>
            </div>
            <div className="diff-card">
              <div className="diff-num">03</div>
              <h3>Transparent fare breakdown</h3>
              <p>
                Base rate, distance, and service fee shown individually before you book.
                No hidden charges. No algorithmic price adjustments happening behind the scenes.
                What you see is what you pay.
              </p>
            </div>
            <div className="diff-card">
              <div className="diff-num">04</div>
              <h3>Purpose-built roles</h3>
              <p>
                A clear separation between rider, driver, and admin means fewer clicks and less
                noise. Faster decisions at every level. Competitors keep adding features —
                we reduce friction instead.
              </p>
            </div>
            <div className="diff-card diff-card-full">
              <div className="diff-num">05</div>
              <h3>Built for trust, not volume</h3>
              <p>
                RideFlow is not designed to maximize ride volume at the expense of user experience.
                Surge pricing removed. Fare transparency enforced. Safety control built in.
                App complexity reduced. You know exactly what you are paying, who is driving, and why.
                That is the one-line difference: a rideshare platform that replaces unpredictable pricing
                and limited safety control with transparent fares, real driver choice, and a system
                users actually understand.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────── */}
      <section className="testimonials-section">
        <h2 className="testimonials-heading">What riders &amp; drivers are saying</h2>
        <TestimonialsCarousel />
      </section>

      {/* ── CTA Banner ────────────────────────────────────────── */}
      <section className="contact-section">
        <div className="contact-inner">
          <div className="contact-left">
            <div className="contact-label">GET STARTED TODAY</div>
            <h2 className="contact-heading">Ready to ride?</h2>
            <p className="contact-sub">
              Create an account and book your first ride in under a minute.
              Drivers can sign up to start earning immediately.
            </p>
            <div className="hero-cta-row">
              <Link to="/sign-up" className="btn btn-magenta hero-cta-primary">Create account</Link>
              <Link to="/sign-in" className="btn btn-dark hero-cta-secondary">Sign in</Link>
            </div>
            <p className="contact-fine">Role assigned at sign-up — choose rider, driver, or admin.</p>
          </div>

          <div className="contact-right">
            <div className="contact-info-item">
              <div>
                <div className="contact-info-label">EMAIL</div>
                <div className="contact-info-value">hello@rideflow.app</div>
              </div>
            </div>
            <div className="contact-info-item">
              <div>
                <div className="contact-info-label">UNIVERSITY</div>
                <div className="contact-info-value">UT Austin · MIS 372T</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="footer-brand">
          <span className="footer-logo">
            <span className="brand-ride">Ride</span>
            <span className="brand-flow">Flow</span>
          </span>
          <span className="footer-course">MIS 372T · Full Stack Development · Spring 2026</span>
        </div>
        <div className="footer-credit">
          Built by Suhani Tiwari &nbsp;·&nbsp; University of Texas at Austin
        </div>
      </footer>
    </div>
  );
};

export default HomePage;