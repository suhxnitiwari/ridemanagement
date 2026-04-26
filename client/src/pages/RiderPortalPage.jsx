import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useUser, useAuth } from '@clerk/react';
import PortalNavbar from '../components/PortalNavbar';
import { ridesApi, driversApi, paymentsApi, aiApi, setAuthToken } from '../services/api';

const RideMap = lazy(() => import('../components/RideMap'));

const searchAddresses = async (query) => {
  if (!query || query.length < 3) return [];
  const params = new URLSearchParams({ q: query, limit: '5', lang: 'en', lat: '30.2672', lon: '-97.7431' });
  try {
    const res = await fetch(`https://photon.komoot.io/api/?${params}`);
    const data = await res.json();
    return (data.features || []).map((f) => {
      const p = f.properties;
      const parts = [
        p.housenumber && p.street ? `${p.housenumber} ${p.street}` : (p.name || p.street),
        p.city, p.state, p.postcode, p.country,
      ].filter(Boolean);
      return { label: parts.join(', '), lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
    });
  } catch { return []; }
};

const geocode = async (address) => {
  if (!address.trim()) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'RideFlow-App' } });
    const data = await res.json();
    if (!data.length) return null;
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch { return null; }
};

const getRoute = async (pickup, dropoff) => {
  // OSRM gives real driving distance + duration (not straight-line)
  const url = `https://router.project-osrm.org/route/v1/driving/${pickup[1]},${pickup[0]};${dropoff[1]},${dropoff[0]}?overview=false`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes?.[0]) {
      return {
        miles:   data.routes[0].distance / 1609.34,
        minutes: Math.round(data.routes[0].duration / 60),
      };
    }
  } catch {}
  return null;
};

const TABS = [
  { id: 'book',         label: 'Book a Ride'   },
  { id: 'active',       label: 'Active Ride'   },
  { id: 'history',      label: 'Ride History'  },
  { id: 'transactions', label: 'Transactions'  },
  { id: 'profile',      label: 'Profile'       },
];

const STATUS_STEPS = ['Requested', 'Accepted', 'En Route', 'In Progress', 'Done'];

const STATUS_STEP_INDEX = {
  requested:   0,
  accepted:    1,
  en_route:    2,
  in_progress: 3,
  completed:   4,
};

const STATUS_TEXT = {
  requested:   'Waiting for a driver to accept your ride',
  accepted:    'Driver accepted — heading to your pickup',
  en_route:    'Driver en route to your pickup',
  in_progress: 'Your ride is in progress',
};

const FALLBACK_PICKUP  = [30.2849, -97.7341];
const FALLBACK_DROPOFF = [30.2672, -97.7431];

const capWords = (s) =>
  s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const statusClass = (s) => `status-badge status-${s}`;

/* ── Active Ride Card ──────────────────────────────────────────────────────── */
const ActiveRideCard = ({ ride, driver, pickupCoords, dropoffCoords }) => {
  const currentStep = STATUS_STEP_INDEX[ride?.status] ?? 0;
  const initials    = driver
    ? `${driver.first_name[0]}${driver.last_name[0]}`.toUpperCase()
    : '?';
  const driverName  = driver
    ? `${driver.first_name} ${driver.last_name[0]}.`
    : 'Awaiting driver';
  const vehicleInfo = driver
    ? `${driver.vehicle_model} · ${driver.license_plate}`
    : '—';

  return (
    <div className="active-ride-card">
      <div className="active-ride-driver-row">
        <div className="driver-avatar">{initials}</div>
        <div className="active-ride-driver-info">
          <div className="active-ride-name">{driverName}</div>
          <div className="active-ride-vehicle">{vehicleInfo}</div>
        </div>
        {ride?.status && (
          <span className={statusClass(ride.status)}>{capWords(ride.status)}</span>
        )}
      </div>
      <div className="active-ride-status-text">
        {STATUS_TEXT[ride?.status] || 'Awaiting update'}
      </div>

      <Suspense fallback={<div style={{ height: 280, background: 'var(--bg-secondary)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading map…</div>}>
        <RideMap
          pickupCoords={pickupCoords   || FALLBACK_PICKUP}
          dropoffCoords={dropoffCoords || FALLBACK_DROPOFF}
        />
      </Suspense>

      <div className="ride-status-bar">
        <div className="ride-status-label">RIDE STATUS</div>
        <div className="ride-status-track">
          {STATUS_STEPS.map((s, i) => (
            <span key={s}>
              <div className={`rs-step${i <= currentStep ? ' rs-done' : ''}`}>
                <div className={`rs-dot${i > currentStep ? ' rs-dot-empty' : ''}`} />
                <span>{s}</span>
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div className={`rs-line${i < currentStep ? ' rs-line-done' : ''}`} />
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Rider Portal Page ─────────────────────────────────────────────────────── */
const RiderPortalPage = ({ theme, onThemeToggle }) => {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState('book');
  const [pickup,    setPickup]    = useState('');
  const [dropoff,   setDropoff]   = useState('');

  const [pickupCoords,  setPickupCoords]  = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [pickupSuggestions,  setPickupSuggestions]  = useState([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState([]);
  const pickupSelected  = useRef(false);
  const dropoffSelected = useRef(false);
  const pickupInputRef  = useRef(null);
  const dropoffInputRef = useRef(null);
  const [pickupRect,  setPickupRect]  = useState(null);
  const [dropoffRect, setDropoffRect] = useState(null);
  const [routeInfo,    setRouteInfo]    = useState(null);
  const [booking,      setBooking]      = useState(false);
  const [bookError,    setBookError]    = useState('');
  const [bookSuccess,  setBookSuccess]  = useState(false);
  const [showCancel,   setShowCancel]   = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling,   setCancelling]   = useState(false);

  const [rides,    setRides]    = useState([]);
  const [payments, setPayments] = useState([]);
  const [loadingRides,    setLoadingRides]    = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [ridesError,    setRidesError]    = useState('');
  const [paymentsError, setPaymentsError] = useState('');

  const [aiSuggestions, setAiSuggestions] = useState('');
  const [aiLoading,     setAiLoading]     = useState(false);
  const [aiError,       setAiError]       = useState('');
  const [strataOpen,    setStrataOpen]    = useState(false);

  const [activeRide,              setActiveRide]              = useState(null);
  const [activeDriver,            setActiveDriver]            = useState(null);
  const [activeRidePickupCoords,  setActiveRidePickupCoords]  = useState(null);
  const [activeRideDropoffCoords, setActiveRideDropoffCoords] = useState(null);
  const [loadingActive,           setLoadingActive]           = useState(false);
  const [activeError,             setActiveError]             = useState('');

  const baseFare   = 2.50;
  const PER_MILE   = 1.75;
  const distFare   = routeInfo ? routeInfo.miles * PER_MILE : 0;
  const serviceFee = (pickup || dropoff) ? 1.20 : 0;
  const total      = Math.max(baseFare + distFare + serviceFee, 5.00);

  /* geocode + autocomplete pickup */
  useEffect(() => {
    if (pickupSelected.current) { pickupSelected.current = false; return; }
    const t = setTimeout(async () => {
      setPickupCoords(await geocode(pickup));
      setPickupSuggestions(await searchAddresses(pickup));
    }, 400);
    return () => clearTimeout(t);
  }, [pickup]);

  /* geocode + autocomplete dropoff */
  useEffect(() => {
    if (dropoffSelected.current) { dropoffSelected.current = false; return; }
    const t = setTimeout(async () => {
      setDropoffCoords(await geocode(dropoff));
      setDropoffSuggestions(await searchAddresses(dropoff));
    }, 400);
    return () => clearTimeout(t);
  }, [dropoff]);

  /* get real driving route when both coords are ready */
  useEffect(() => {
    if (!pickupCoords || !dropoffCoords) { setRouteInfo(null); return; }
    getRoute(pickupCoords, dropoffCoords).then(setRouteInfo);
  }, [pickupCoords, dropoffCoords]);

  const handleGetSuggestions = async () => {
    const dest = dropoff.trim();
    if (!dest) return;
    setAiSuggestions('');
    setAiError('');
    setAiLoading(true);
    try {
      const token = await getToken();
      if (token) setAuthToken(token);
      const res = await aiApi.getDestinationSuggestions(dest);
      setAiSuggestions(res.data?.suggestions || '');
    } catch (err) {
      console.error('AI suggestions failed:', err?.response?.status, err?.message);
      setAiError(err?.response?.data?.message || 'Could not get suggestions. Try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleBookRide = async () => {
    setBooking(true);
    setBookError('');
    try {
      const token = await getToken();
      if (token) setAuthToken(token);
      await ridesApi.create({ pickup_location: pickup, dropoff_location: dropoff, fare: total });
      setBookSuccess(true);
      setPickup('');
      setDropoff('');
      setPickupCoords(null);
      setDropoffCoords(null);
      setActiveTab('active');
    } catch (err) {
      console.error('Book ride failed:', err?.response?.status, err?.response?.data, err?.message);
      if (!err.response) {
        setBookError('Could not reach the server. It may be waking up — wait 30 seconds and try again.');
      } else {
        setBookError(err.response.data?.message || `Error ${err.response.status}: Failed to book ride.`);
      }
    } finally {
      setBooking(false);
    }
  };

  /* fetch active ride when that tab is opened */
  useEffect(() => {
    if (activeTab !== 'active') return;
    setLoadingActive(true);
    setActiveError('');
    (async () => {
      try {
        const res = await ridesApi.getAll({ statuses: 'requested,accepted,en_route,in_progress' });
        const raw = res.data?.data ?? res.data ?? [];
        const sorted = (Array.isArray(raw) ? raw : [])
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const ride = sorted[0] || null;
        setActiveRide(ride);
        if (!ride) { setActiveDriver(null); return; }

        if (ride.driver_id) {
          try {
            const dr = await driversApi.getById(ride.driver_id);
            setActiveDriver(dr.data?.data ?? null);
          } catch { setActiveDriver(null); }
        } else {
          setActiveDriver(null);
        }

        const [pc, dc] = await Promise.all([
          geocode(ride.pickup_location),
          geocode(ride.dropoff_location),
        ]);
        setActiveRidePickupCoords(pc);
        setActiveRideDropoffCoords(dc);
      } catch {
        setActiveError('Failed to load active ride.');
      } finally {
        setLoadingActive(false);
      }
    })();
  }, [activeTab]);

  /* fetch on tab change — always refresh so data stays current */
  useEffect(() => {
    if (activeTab === 'history') {
      setLoadingRides(true);
      setRidesError('');
      ridesApi.getAll()
        .then((res) => {
          const raw = res.data?.data ?? res.data ?? [];
          setRides(Array.isArray(raw) ? raw : []);
        })
        .catch((err) => setRidesError(err.response?.data?.message || 'Failed to load rides.'))
        .finally(() => setLoadingRides(false));
    }
    if (activeTab === 'transactions') {
      setLoadingPayments(true);
      setPaymentsError('');
      paymentsApi.getAll()
        .then((res) => {
          const raw = res.data?.data ?? res.data ?? [];
          setPayments(Array.isArray(raw) ? raw : []);
        })
        .catch((err) => setPaymentsError(err.response?.data?.message || 'Failed to load transactions.'))
        .finally(() => setLoadingPayments(false));
    }
  }, [activeTab]);

  return (
    <div className="portal-shell">
      {(() => {
        const { user } = useUser();
        const userInitials = user?.firstName && user?.lastName
          ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
          : user?.firstName
            ? user.firstName.slice(0, 2).toUpperCase()
            : '';
        const userName = user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName[0]}.`
          : user?.firstName || '';
        return (
          <PortalNavbar
            role="Rider"
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            theme={theme}
            onThemeToggle={onThemeToggle}
            userInitials={userInitials}
            userName={userName}
          />
        );
      })()}

      {/* ── Book a Ride ────────────────────────────────────────────── */}
      {activeTab === 'book' && (
        <div className="portal-page">
          <div className="portal-panel">
            <div className="section-label">Request a ride</div>
            <div className="p-card ride-form-fields">
              {bookSuccess ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</div>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Ride requested!</div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Your driver will be assigned shortly.</div>
                  <button className="btn-portal-cta" onClick={() => setBookSuccess(false)}>Book another</button>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <span className="field-label">Pickup location</span>
                    <input
                      ref={pickupInputRef}
                      value={pickup}
                      onChange={(e) => {
                        setPickup(e.target.value);
                        if (pickupInputRef.current) setPickupRect(pickupInputRef.current.getBoundingClientRect());
                      }}
                      onFocus={() => { if (pickupInputRef.current) setPickupRect(pickupInputRef.current.getBoundingClientRect()); }}
                      onBlur={() => setTimeout(() => setPickupSuggestions([]), 150)}
                      placeholder="Enter pickup address…"
                      autoComplete="off"
                    />
                    {pickupSuggestions.length > 0 && pickupRect && (
                      <div className="autocomplete-dropdown" style={{ position: 'fixed', top: pickupRect.bottom + 2, left: pickupRect.left, width: pickupRect.width }}>
                        {pickupSuggestions.map((s, i) => (
                          <div
                            key={i}
                            className="autocomplete-item"
                            onMouseDown={() => {
                              pickupSelected.current = true;
                              setPickup(s.label);
                              setPickupCoords([s.lat, s.lon]);
                              setPickupSuggestions([]);
                            }}
                          >
                            {s.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <span className="field-label">Dropoff location</span>
                    <input
                      ref={dropoffInputRef}
                      value={dropoff}
                      onChange={(e) => {
                        setDropoff(e.target.value);
                        if (dropoffInputRef.current) setDropoffRect(dropoffInputRef.current.getBoundingClientRect());
                      }}
                      onFocus={() => { if (dropoffInputRef.current) setDropoffRect(dropoffInputRef.current.getBoundingClientRect()); }}
                      onBlur={() => setTimeout(() => setDropoffSuggestions([]), 150)}
                      placeholder="Enter destination…"
                      autoComplete="off"
                    />
                    {dropoffSuggestions.length > 0 && dropoffRect && (
                      <div className="autocomplete-dropdown" style={{ position: 'fixed', top: dropoffRect.bottom + 2, left: dropoffRect.left, width: dropoffRect.width }}>
                        {dropoffSuggestions.map((s, i) => (
                          <div
                            key={i}
                            className="autocomplete-item"
                            onMouseDown={() => {
                              dropoffSelected.current = true;
                              setDropoff(s.label);
                              setDropoffCoords([s.lat, s.lon]);
                              setDropoffSuggestions([]);
                            }}
                          >
                            {s.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Suspense fallback={<div style={{ height: 260, background: 'var(--surface)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading map…</div>}>
                    <RideMap pickupCoords={pickupCoords} dropoffCoords={dropoffCoords} />
                  </Suspense>

                  <div className="ride-form-fare" style={{ marginTop: '1rem' }}>
                    <div className="fare-row"><span>Base fare</span><span>${baseFare.toFixed(2)}</span></div>
                    <div className="fare-row">
                      <span>Distance {routeInfo ? `(${routeInfo.miles.toFixed(1)} mi)` : pickup && dropoff ? '(calculating…)' : ''}</span>
                      <span>{routeInfo ? `$${distFare.toFixed(2)}` : '—'}</span>
                    </div>
                    <div className="fare-row"><span>Service fee</span><span>${serviceFee.toFixed(2)}</span></div>
                    <div className="fare-row fare-total">
                      <span>Total estimate {routeInfo ? `· ~${routeInfo.minutes} min drive` : ''}</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>

                  {bookError && (
                    <div style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '8px', padding: '0.75rem 1rem', color: '#b91c1c', fontSize: '0.9rem', marginTop: '0.5rem', fontWeight: 500 }}>
                      {bookError}
                    </div>
                  )}

                  <button
                    className="btn-portal-cta"
                    disabled={!pickup.trim() || !dropoff.trim() || booking}
                    onClick={handleBookRide}
                  >
                    {booking ? 'Requesting…' : 'Request Ride'}
                  </button>
                  {(!pickup.trim() || !dropoff.trim()) && (
                    <p className="book-hint">Enter both pickup and dropoff to continue.</p>
                  )}

                </>
              )}
            </div>
          </div>

          <div className="portal-panel">
            <div className="portal-stats-row">
              <div className="portal-stat-card">
                <div className="portal-stat-label">Total Rides</div>
                <div className="portal-stat-value">42</div>
                <div className="portal-stat-sub">lifetime rides</div>
              </div>
              <div className="portal-stat-card">
                <div className="portal-stat-label">Total Spent</div>
                <div className="portal-stat-value stat-magenta">$384</div>
                <div className="portal-stat-sub">avg $9.14 / ride</div>
              </div>
              <div className="portal-stat-card portal-stat-full">
                <div className="portal-stat-label">Spent This Month</div>
                <div className="portal-stat-value stat-magenta">$47.22</div>
                <div className="portal-stat-sub">3 rides in April · +12% vs last month</div>
              </div>
            </div>

            <div className="p-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="section-label">AI Destination Assistant</div>
              {aiLoading ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Getting suggestions…</div>
              ) : aiError ? (
                <div style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '8px', padding: '0.6rem 0.8rem', color: '#b91c1c', fontSize: '0.85rem' }}>
                  {aiError}
                </div>
              ) : aiSuggestions ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'pre-line', lineHeight: 1.7 }}>
                  {aiSuggestions}
                </div>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                  Enter a destination then click below to get AI suggestions.
                </p>
              )}
              <button
                className="btn-portal-cta"
                disabled={!dropoff.trim() || aiLoading}
                onClick={handleGetSuggestions}
                style={{ marginTop: '0.25rem' }}
              >
                {aiLoading ? 'Getting suggestions…' : 'Suggest things to do'}
              </button>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Trip assistant chat</span>
                <button
                  onClick={() => setStrataOpen((o) => !o)}
                  style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  {strataOpen ? 'Close chat' : 'Open chat'}
                </button>
              </div>
              {strataOpen && (
                <div className="strata-chat-widget">
                  <iframe
                    src="https://strata.fyi/embed?workspace=mis372t"
                    loading="lazy"
                    allow="clipboard-write"
                    style={{ width: '100%', height: '420px', border: 'none', borderRadius: '8px' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Active Ride ─────────────────────────────────────────────── */}
      {activeTab === 'active' && (
        <div className="active-ride-page">
          <div className="active-ride-left">
            <div className="page-header">
              <h1>Active Ride</h1>
              <p>
                {loadingActive ? 'Loading…'
                  : activeError ? activeError
                  : activeRide  ? STATUS_TEXT[activeRide.status] || 'Ride in progress'
                  : 'No active ride found'}
              </p>
            </div>

            {loadingActive ? (
              <div className="p-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading your ride…
              </div>
            ) : activeError ? (
              <div className="p-card" style={{ padding: '1.5rem', color: 'var(--danger)' }}>{activeError}</div>
            ) : !activeRide ? (
              <div className="p-card" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', marginBottom: '0.5rem', fontWeight: 600 }}>No active ride</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                  You don't have a ride in progress right now.
                </div>
                <button className="btn-portal-cta" onClick={() => setActiveTab('book')}>
                  Book a Ride
                </button>
              </div>
            ) : (
              <ActiveRideCard
                ride={activeRide}
                driver={activeDriver}
                pickupCoords={activeRidePickupCoords}
                dropoffCoords={activeRideDropoffCoords}
              />
            )}
          </div>

          <div className="active-ride-right">
            <div className="p-card active-ride-actions">
              <div className="section-label">Need help?</div>
              <div className="active-help-row">
                <a
                  href={activeDriver?.phone_number ? `tel:${activeDriver.phone_number}` : '#'}
                  className="btn-help"
                  style={{ textDecoration: 'none', textAlign: 'center', opacity: activeDriver ? 1 : 0.5 }}
                >
                  Contact Driver
                </a>
                <button
                  className="btn-help btn-help-danger"
                  onClick={() => setShowCancel(true)}
                  disabled={!activeRide}
                >
                  Cancel Ride
                </button>
              </div>
              <p className="active-help-note">
                Cancellations after driver acceptance may incur a $2.00 fee.
              </p>
            </div>

            {activeRide && (
              <div className="p-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="section-label">Ride details</div>
                <div className="account-field" style={{ padding: '0.6rem 0' }}>
                  <span className="account-field-label">Ride #</span>
                  <span className="account-field-value">R{activeRide.ride_id}</span>
                </div>
                <div className="account-field" style={{ padding: '0.6rem 0' }}>
                  <span className="account-field-label">Driver</span>
                  <span className="account-field-value">
                    {activeDriver
                      ? `${activeDriver.first_name} ${activeDriver.last_name[0]}.`
                      : 'Awaiting driver'}
                  </span>
                </div>
                <div className="account-field" style={{ padding: '0.6rem 0' }}>
                  <span className="account-field-label">Vehicle</span>
                  <span className="account-field-value">
                    {activeDriver
                      ? `${activeDriver.vehicle_model} · ${activeDriver.license_plate}`
                      : '—'}
                  </span>
                </div>
                <div className="account-field" style={{ padding: '0.6rem 0' }}>
                  <span className="account-field-label">Pickup</span>
                  <span className="account-field-value" style={{ fontSize: '0.82rem' }}>
                    {activeRide.pickup_location}
                  </span>
                </div>
                <div className="account-field" style={{ padding: '0.6rem 0' }}>
                  <span className="account-field-label">Dropoff</span>
                  <span className="account-field-value" style={{ fontSize: '0.82rem' }}>
                    {activeRide.dropoff_location}
                  </span>
                </div>
                <div className="account-field" style={{ padding: '0.6rem 0', border: 'none' }}>
                  <span className="account-field-label">Est. Fare</span>
                  <span className="account-field-value" style={{ color: 'var(--magenta)' }}>
                    {activeRide.fare ? `$${parseFloat(activeRide.fare).toFixed(2)}` : '—'}
                  </span>
                </div>
              </div>
            )}

            <div className="rider-tips p-card">
              <div className="section-label">Safety tips</div>
              <div className="tip-item">
                <span className="tip-icon">🔒</span>
                <span>Verify the license plate before getting in.</span>
              </div>
              <div className="tip-item">
                <span className="tip-icon">📱</span>
                <span>Share your trip details with a friend.</span>
              </div>
              <div className="tip-item">
                <span className="tip-icon">⭐</span>
                <span>Rate your driver after every ride.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Ride Modal ────────────────────────────────────────── */}
      {showCancel && (
        <div className="modal-overlay" onClick={() => setShowCancel(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cancel Ride?</h2>
              <button className="modal-close" onClick={() => setShowCancel(false)}>×</button>
            </div>

            <div style={{ padding: '0 0 1rem' }}>
              <div className="p-card" style={{ background: 'var(--warning-bg, #fff8e1)', border: '1px solid var(--warning, #f59e0b)', marginBottom: '1rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>⚠️ Cancellation fee: $2.00</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {activeDriver
                  ? `Your driver ${activeDriver.first_name} ${activeDriver.last_name[0]}. has accepted. A $2.00 fee applies.`
                  : 'A cancellation fee may apply depending on ride status.'}
                </div>
              </div>

              <div className="form-group">
                <span className="field-label">Reason for cancellation</span>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}
                >
                  <option value="">Select a reason…</option>
                  <option value="wait_too_long">Driver is taking too long</option>
                  <option value="wrong_address">Wrong pickup address</option>
                  <option value="plans_changed">Plans changed</option>
                  <option value="found_alternative">Found another ride</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowCancel(false)} disabled={cancelling}>
                Keep Ride
              </button>
              <button
                className="btn btn-danger"
                disabled={!cancelReason || cancelling}
                onClick={async () => {
                  setCancelling(true);
                  await new Promise((r) => setTimeout(r, 800));
                  setCancelling(false);
                  setShowCancel(false);
                  setCancelReason('');
                }}
              >
                {cancelling ? 'Cancelling…' : 'Confirm Cancel ($2.00)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ride History ─────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="history-page">
          <div className="page-header">
            <h1>Ride History</h1>
            <p>All rides recorded on the RideFlow platform</p>
          </div>

          <div className="table-wrap">
            {loadingRides ? (
              <div className="table-empty">Loading rides…</div>
            ) : ridesError ? (
              <div className="table-empty" style={{ color: 'var(--danger)' }}>{ridesError}</div>
            ) : rides.length === 0 ? (
              <div className="table-empty">No rides found.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Ride ID</th>
                    <th>Date &amp; Time</th>
                    <th>Pickup</th>
                    <th>Dropoff</th>
                    <th>Status</th>
                    <th>Fare</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rides]
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .map((r) => (
                    <tr key={r.ride_id}>
                      <td><span className="ride-id-link">R{r.ride_id}</span></td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {r.created_at ? new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                      </td>
                      <td>{r.pickup_location}</td>
                      <td>{r.dropoff_location}</td>
                      <td>
                        <span className={statusClass(r.status)}>
                          {capWords(r.status)}
                        </span>
                      </td>
                      <td>{r.fare ? `$${parseFloat(r.fare).toFixed(2)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Transactions ─────────────────────────────────────────────── */}
      {activeTab === 'transactions' && (
        <div className="history-page">
          <div className="page-header">
            <h1>Transactions</h1>
            <p>Full payment history on RideFlow</p>
          </div>

          <div className="table-wrap">
            {loadingPayments ? (
              <div className="table-empty">Loading transactions…</div>
            ) : paymentsError ? (
              <div className="table-empty" style={{ color: 'var(--danger)' }}>{paymentsError}</div>
            ) : payments.length === 0 ? (
              <div className="table-empty">No transactions found.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Payment ID</th>
                    <th>Date &amp; Time</th>
                    <th>Ride</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...payments]
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                    .map((p) => (
                    <tr key={p.payment_id}>
                      <td><span className="ride-id-link">PAY-{p.payment_id}</span></td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {p.created_at ? new Date(p.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                      </td>
                      <td><span className="ride-id-link">R{p.ride_id}</span></td>
                      <td><strong>${parseFloat(p.amount).toFixed(2)}</strong></td>
                      <td>{capWords(p.payment_method)}</td>
                      <td>
                        <span className={statusClass(p.status)}>
                          {capWords(p.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Profile ──────────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="account-page">
          <div className="page-header">
            <h1>Profile</h1>
            <p>Your RideFlow rider account</p>
          </div>

          <div className="profile-layout">
            <div className="p-card profile-card">
              <div className="profile-avatar-row">
                <div className="profile-avatar">ST</div>
                <div>
                  <div className="profile-name">Suhani Tiwari</div>
                  <div className="profile-since">Member since Jan 2026</div>
                </div>
              </div>

              <div className="section-label">Account info</div>
              <div className="account-field">
                <span className="account-field-label">Full Name</span>
                <span className="account-field-value">Suhani Tiwari</span>
              </div>
              <div className="account-field">
                <span className="account-field-label">Email</span>
                <span className="account-field-value">rider@rideflow.app</span>
              </div>
              <div className="account-field">
                <span className="account-field-label">Phone</span>
                <span className="account-field-value">(512) 471-5921</span>
              </div>
              <div className="account-field">
                <span className="account-field-label">Default Payment</span>
                <span className="account-field-value">Credit Card</span>
              </div>

              <div className="section-label" style={{ marginTop: '1.5rem' }}>Ride Preferences</div>
              <div className="account-field">
                <span className="account-field-label">Driver Gender</span>
                <span className="account-field-value">Female preferred</span>
              </div>
              <div className="account-field">
                <span className="account-field-label">Vehicle Type</span>
                <span className="account-field-value">Sedan</span>
              </div>
              <div className="account-field">
                <span className="account-field-label">Music</span>
                <span className="account-field-value">Quiet / No music</span>
              </div>
              <div className="account-field">
                <span className="account-field-label">Conversation</span>
                <span className="account-field-value">Minimal chat</span>
              </div>
            </div>

            <div className="profile-stats-col">
              <div className="p-card profile-stat-card">
                <div className="portal-stat-label">Total Rides</div>
                <div className="portal-stat-value">42</div>
                <div className="portal-stat-sub">lifetime rides</div>
              </div>
              <div className="p-card profile-stat-card">
                <div className="portal-stat-label">Total Spent</div>
                <div className="portal-stat-value stat-magenta">$384.00</div>
                <div className="portal-stat-sub">all time</div>
              </div>
              <div className="p-card profile-stat-card">
                <div className="portal-stat-label">Avg Fare</div>
                <div className="portal-stat-value">$9.14</div>
                <div className="portal-stat-sub">per ride</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiderPortalPage;
