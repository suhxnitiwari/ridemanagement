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
            <h3>Real-time ride tracking</h3>
            <p>Track your ride from request to dropoff with live updates at every stage.</p>
          </div>

          <div className="feature-card feature-card-accent">
            <div className="feature-icon-wrap feature-icon-accent">
              <span className="feature-icon">⬡</span>
            </div>
            <h3>Seamless payments</h3>
            <p>Automatic payment processing with instant records and full ride history.</p>
          </div>

          <div className="feature-card feature-card-light">
            <div className="feature-icon-wrap feature-icon-light">
              <span className="feature-icon">⬡</span>
            </div>
            <h3>Full system visibility</h3>
            <p>Riders, drivers, and admins each have a clear, purpose-built view of the platform.</p>
          </div>
        </div>
      </section>


      {/* ── Differentiators ──────────────────────────────────── */}
      <section className="differentiators-section">
        <div className="diff-inner">
          <div className="diff-eyebrow">Why RideFlow</div>
          <h2 className="diff-heading">What sets us apart</h2>
          <p className="diff-sub">
            Built for trust and transparency — not growth at all costs.
          </p>
          <div className="diff-list">
            <div className="diff-item">
              <div className="diff-num">01</div>
              <div>
                <h3>Fixed pricing. No surge.</h3>
                <p>Know your exact fare upfront with a simple base + distance model.</p>
              </div>
            </div>
            <div className="diff-item">
              <div className="diff-num">02</div>
              <div>
                <h3>Background-checked drivers</h3>
                <p>Every driver is fully vetted and verified for safety and reliability.</p>
              </div>
            </div>
            <div className="diff-item">
              <div className="diff-num">03</div>
              <div>
                <h3>Safety you can control</h3>
                <p>Choose a female driver from a 50/50 male–female driver network and use a real-time safety button during rides.</p>
              </div>
            </div>
            <div className="diff-item">
              <div className="diff-num">04</div>
              <div>
                <h3>Fair pay for drivers (65%)</h3>
                <p>Drivers keep 65% of every ride, creating better incentives and better service.</p>
              </div>
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
              Book your first ride in under a minute. Drivers go through a thorough background check before joining the platform.
            </p>
            <div className="hero-cta-row">
              <Link to="/sign-up" className="btn btn-magenta hero-cta-primary">Create account</Link>
              <Link to="/sign-in" className="btn btn-dark hero-cta-secondary">Sign in</Link>
            </div>
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
                <div className="contact-info-label">PHONE</div>
                <div className="contact-info-value">(512) 448-0193</div>
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