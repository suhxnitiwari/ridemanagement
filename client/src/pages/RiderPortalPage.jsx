import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useUser, useAuth } from '@clerk/react';
import PortalNavbar from '../components/PortalNavbar';
import { ridersApi, ridesApi, driversApi, paymentsApi, aiApi, setAuthToken } from '../services/api';

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

// Characters that never appear in real street addresses
const ADDR_INVALID_RE = /[!$%^&*=[\]{};:"<>?`~|\\]/;
const isValidAddressInput = (s) => !ADDR_INVALID_RE.test(s);

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

const formatMethod = (method, lastFour) => {
  if (lastFour) return `${capWords(method)} ···· ${lastFour}`;
  return capWords(method);
};

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

      <Suspense fallback={<div className="map-fallback">Loading map…</div>}>
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
  const { user } = useUser();
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
  const [booking,          setBooking]          = useState(false);
  const [bookError,        setBookError]        = useState('');
  const [bookSuccess,      setBookSuccess]      = useState(false);
  const [pickupInputError, setPickupInputError] = useState('');
  const [dropoffInputError,setDropoffInputError]= useState('');
  const [pickupGeoFailed,  setPickupGeoFailed]  = useState(false);
  const [dropoffGeoFailed, setDropoffGeoFailed] = useState(false);
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

  const [riderStats,              setRiderStats]              = useState(null);
  const [riderProfile,            setRiderProfile]            = useState(null);

  const [activeRide,              setActiveRide]              = useState(null);
  const [activeDriver,            setActiveDriver]            = useState(null);
  const [activeRidePickupCoords,  setActiveRidePickupCoords]  = useState(null);
  const [activeRideDropoffCoords, setActiveRideDropoffCoords] = useState(null);
  const [loadingActive,           setLoadingActive]           = useState(false);
  const [activeError,             setActiveError]             = useState('');

  const baseFare   = 2.50;
  const PER_MILE   = 1.75;
  const distFare   = routeInfo ? routeInfo.miles * PER_MILE : 0;
  const serviceFee = routeInfo ? 1.20 : 0;
  const total      = Math.max(baseFare + distFare + serviceFee, 5.00);

  /* geocode + autocomplete pickup */
  useEffect(() => {
    if (pickupSelected.current) { pickupSelected.current = false; return; }
    if (!pickup.trim() || !isValidAddressInput(pickup)) return;
    const t = setTimeout(async () => {
      const coords = await geocode(pickup);
      setPickupCoords(coords);
      setPickupGeoFailed(pickup.trim().length >= 3 && !coords);
      setPickupSuggestions(await searchAddresses(pickup));
    }, 400);
    return () => clearTimeout(t);
  }, [pickup]);

  /* geocode + autocomplete dropoff */
  useEffect(() => {
    if (dropoffSelected.current) { dropoffSelected.current = false; return; }
    if (!dropoff.trim() || !isValidAddressInput(dropoff)) return;
    const t = setTimeout(async () => {
      const coords = await geocode(dropoff);
      setDropoffCoords(coords);
      setDropoffGeoFailed(dropoff.trim().length >= 3 && !coords);
      setDropoffSuggestions(await searchAddresses(dropoff));
    }, 400);
    return () => clearTimeout(t);
  }, [dropoff]);

  /* get real driving route when both coords are ready */
  useEffect(() => {
    if (!pickupCoords || !dropoffCoords) { setRouteInfo(null); return; }
    getRoute(pickupCoords, dropoffCoords).then(setRouteInfo);
  }, [pickupCoords, dropoffCoords]);

  /* fetch rider's real stats once on mount */
  useEffect(() => {
    ridesApi.getAll()
      .then((res) => {
        const raw = res.data?.data ?? res.data ?? [];
        const all = Array.isArray(raw) ? raw : [];
        const done = all.filter((r) => r.status === 'completed' && r.fare);
        const totalSpent = done.reduce((sum, r) => sum + parseFloat(r.fare), 0);
        const now = new Date();
        const monthDone = done.filter((r) => {
          const d = new Date(r.createdAt);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const monthSpent = monthDone.reduce((sum, r) => sum + parseFloat(r.fare), 0);
        setRiderStats({
          total: all.filter((r) => r.status !== 'cancelled').length,
          totalSpent,
          avg: done.length > 0 ? totalSpent / done.length : 0,
          monthCount: monthDone.length,
          monthSpent,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    ridersApi.getMe()
      .then((res) => setRiderProfile(res.data?.data ?? null))
      .catch(() => {});
  }, []);

  const handleGetSuggestions = async (dest = dropoff.trim()) => {
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
      setAiError(err?.response?.data?.message || 'Could not get suggestions. Try again.');
    } finally {
      setAiLoading(false);
    }
  };

  /* auto-trigger suggestions as user types a dropoff */
  useEffect(() => {
    if (!dropoff.trim()) { setAiSuggestions(''); setAiError(''); return; }
    if (dropoff.length < 3 || aiLoading) return;
    const t = setTimeout(() => handleGetSuggestions(dropoff.trim()), 1200);
    return () => clearTimeout(t);
  }, [dropoff]); // eslint-disable-line react-hooks/exhaustive-deps

  /* auto-fetch suggestions when active ride tab opens */
  useEffect(() => {
    if (activeTab !== 'active' || !activeRide?.dropoff_location || aiSuggestions || aiLoading) return;
    handleGetSuggestions(activeRide.dropoff_location);
  }, [activeTab, activeRide]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBookRide = async () => {
    setBooking(true);
    setBookError('');
    try {
      const token = await getToken();
      if (token) setAuthToken(token);
      const rideRes = await ridesApi.create({ pickup_location: pickup, dropoff_location: dropoff, fare: total });
      const newRide = rideRes.data?.data;
      if (newRide?.ride_id) {
        await paymentsApi.create({
          ride_id: newRide.ride_id,
          amount: total,
          payment_method: riderProfile?.default_payment_method || 'credit_card',
          status: 'pending',
        });
      }
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
                <div className="book-success">
                  <div className="book-success-emoji">🎉</div>
                  <div className="book-success-title">Ride requested!</div>
                  <div className="book-success-sub">Your driver will be assigned shortly.</div>
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
                        const val = e.target.value;
                        setPickup(val);
                        setPickupCoords(null);
                        setPickupGeoFailed(false);
                        if (bookError) setBookError('');
                        setPickupInputError(
                          val.trim() && !isValidAddressInput(val)
                            ? 'Invalid characters. Please enter a real street address.'
                            : ''
                        );
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
                        const val = e.target.value;
                        setDropoff(val);
                        setDropoffCoords(null);
                        setDropoffGeoFailed(false);
                        if (bookError) setBookError('');
                        setDropoffInputError(
                          val.trim() && !isValidAddressInput(val)
                            ? 'Invalid characters. Please enter a real street address.'
                            : ''
                        );
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

                  <Suspense fallback={<div className="map-fallback map-fallback-md">Loading map…</div>}>
                    <RideMap pickupCoords={pickupCoords} dropoffCoords={dropoffCoords} />
                  </Suspense>

                  <div className="ride-form-fare">
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
                    <div className="alert-error">
                      {bookError}
                    </div>
                  )}

                  <button
                    className="btn-portal-cta"
                    disabled={!pickup.trim() || !dropoff.trim() || !!pickupInputError || !!dropoffInputError || !pickupCoords || !dropoffCoords || !routeInfo || booking}
                    onClick={handleBookRide}
                  >
                    {booking ? 'Requesting…' : 'Request Ride'}
                  </button>
                  {(!pickup.trim() || !dropoff.trim()) && (
                    <p className="book-hint">Enter both pickup and dropoff to continue.</p>
                  )}
                  {pickup.trim() && pickupInputError && (
                    <p className="book-hint book-hint-error">{pickupInputError}</p>
                  )}
                  {dropoff.trim() && dropoffInputError && (
                    <p className="book-hint book-hint-error">{dropoffInputError}</p>
                  )}
                  {pickup.trim() && !pickupInputError && pickupGeoFailed && (
                    <p className="book-hint book-hint-error">Pickup not found. Try a more specific address.</p>
                  )}
                  {dropoff.trim() && !dropoffInputError && dropoffGeoFailed && (
                    <p className="book-hint book-hint-error">Dropoff not found. Try a more specific address.</p>
                  )}
                  {pickup.trim() && dropoff.trim() && !pickupInputError && !dropoffInputError && !pickupGeoFailed && !dropoffGeoFailed && (!pickupCoords || !dropoffCoords) && (
                    <p className="book-hint">Resolving addresses…</p>
                  )}

                </>
              )}
            </div>
          </div>

          <div className="portal-panel">
            <div className="portal-stats-row">
              <div className="portal-stat-card">
                <div className="portal-stat-label">Total Rides</div>
                <div className="portal-stat-value">{riderStats ? riderStats.total : '—'}</div>
                <div className="portal-stat-sub">lifetime rides</div>
              </div>
              <div className="portal-stat-card">
                <div className="portal-stat-label">Total Spent</div>
                <div className="portal-stat-value stat-magenta">
                  {riderStats ? `$${riderStats.totalSpent.toFixed(2)}` : '—'}
                </div>
                <div className="portal-stat-sub">
                  {riderStats && riderStats.avg > 0 ? `avg $${riderStats.avg.toFixed(2)} / ride` : 'avg — / ride'}
                </div>
              </div>
              <div className="portal-stat-card portal-stat-full">
                <div className="portal-stat-label">Spent This Month</div>
                <div className="portal-stat-value stat-magenta">
                  {riderStats ? `$${riderStats.monthSpent.toFixed(2)}` : '—'}
                </div>
                <div className="portal-stat-sub">
                  {riderStats ? `${riderStats.monthCount} ride${riderStats.monthCount !== 1 ? 's' : ''} this month` : ''}
                </div>
              </div>
            </div>

            <div className="p-card ai-assistant-card">
              <div className="section-label">AI Destination Assistant</div>
              {aiLoading ? (
                <div className="ai-loading-text">Getting suggestions…</div>
              ) : aiError ? (
                <div className="alert-error-sm">{aiError}</div>
              ) : aiSuggestions ? (
                <div className="ai-suggestions-text">{aiSuggestions}</div>
              ) : (
                <p className="ai-placeholder-text">
                  Enter a destination then click below to get AI suggestions.
                </p>
              )}
              <button
                className="btn-portal-cta ai-suggest-btn"
                disabled={!dropoff.trim() || aiLoading}
                onClick={handleGetSuggestions}
              >
                {aiLoading ? 'Getting suggestions…' : 'Suggest things to do'}
              </button>

              <div className="ai-chat-divider">
                <span className="ai-chat-label">Trip assistant chat</span>
                <button className="btn-strata-toggle" onClick={() => setStrataOpen((o) => !o)}>
                  {strataOpen ? 'Close chat' : 'Open chat'}
                </button>
              </div>
              {strataOpen && (
                <iframe
                  src="https://strata.fyi/embed?workspace=mis372t"
                  loading="lazy"
                  allow="clipboard-write"
                  className="strata-iframe"
                />
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
              <div className="p-card p-card-state">
                Loading your ride…
              </div>
            ) : activeError ? (
              <div className="p-card p-card-error">{activeError}</div>
            ) : !activeRide ? (
              <div className="p-card p-card-centered">
                <div className="no-ride-title">No active ride</div>
                <div className="no-ride-sub">
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
                  className={`btn-help${activeDriver ? '' : ' btn-help-dim'}`}
                >
                  Contact Driver
                </a>
                {activeRide && (
                  <button
                    className="btn-help btn-help-danger"
                    onClick={() => setShowCancel(true)}
                  >
                    Cancel Ride
                  </button>
                )}
              </div>
              {activeRide && (
                <p className="active-help-note">
                  Cancellations after driver acceptance may incur a $2.00 fee.
                </p>
              )}
            </div>

            {activeRide && (
              <div className="p-card ride-details-card">
                <div className="section-label">Ride details</div>
                <div className="account-field account-field-sm">
                  <span className="account-field-label">Ride #</span>
                  <span className="account-field-value">R{activeRide.ride_id}</span>
                </div>
                <div className="account-field account-field-sm">
                  <span className="account-field-label">Driver</span>
                  <span className="account-field-value">
                    {activeDriver
                      ? `${activeDriver.first_name} ${activeDriver.last_name[0]}.`
                      : 'Awaiting driver'}
                  </span>
                </div>
                <div className="account-field account-field-sm">
                  <span className="account-field-label">Vehicle</span>
                  <span className="account-field-value">
                    {activeDriver
                      ? `${activeDriver.vehicle_model} · ${activeDriver.license_plate}`
                      : '—'}
                  </span>
                </div>
                <div className="account-field account-field-sm">
                  <span className="account-field-label">Pickup</span>
                  <span className="account-field-value account-field-value-sm">
                    {activeRide.pickup_location}
                  </span>
                </div>
                <div className="account-field account-field-sm">
                  <span className="account-field-label">Dropoff</span>
                  <span className="account-field-value account-field-value-sm">
                    {activeRide.dropoff_location}
                  </span>
                </div>
                <div className="account-field account-field-sm no-border">
                  <span className="account-field-label">Est. Fare</span>
                  <span className="account-field-value account-field-value-accent">
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

            {activeRide && (
              <div className="p-card ai-assistant-card">
                <div className="section-label">Things to do at your destination</div>
                {aiLoading ? (
                  <div className="ai-loading-text">Getting suggestions…</div>
                ) : aiError ? (
                  <div className="alert-error-sm">{aiError}</div>
                ) : aiSuggestions ? (
                  <div className="ai-suggestions-text">{aiSuggestions}</div>
                ) : (
                  <div className="ai-loading-text">Fetching destination ideas…</div>
                )}
                <button
                  className="btn-portal-cta ai-suggest-btn"
                  disabled={aiLoading}
                  onClick={() => handleGetSuggestions(activeRide.dropoff_location)}
                >
                  {aiLoading ? 'Getting suggestions…' : 'Refresh suggestions'}
                </button>
              </div>
            )}
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

            <div className="cancel-modal-body">
              <div className="p-card cancel-warning-card">
                <div className="cancel-warning-title">⚠️ Cancellation fee: $2.00</div>
                <div className="cancel-warning-text">
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
                  className="cancel-reason-select"
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
                  if (!activeRide) return;
                  setCancelling(true);
                  try {
                    await ridesApi.update(activeRide.ride_id, { status: 'cancelled' });
                    try {
                      await paymentsApi.create({
                        ride_id: activeRide.ride_id,
                        amount: 2.00,
                        payment_method: riderProfile?.default_payment_method || 'credit_card',
                        status: 'completed',
                      });
                    } catch (feeErr) {
                      console.error('Cancellation fee failed:', feeErr.response?.data || feeErr.message);
                    }
                    setActiveRide(null);
                    setRides([]);
                  } catch (err) {
                    console.error('Cancel failed:', err.response?.data || err.message);
                  } finally {
                    setCancelling(false);
                    setShowCancel(false);
                    setCancelReason('');
                  }
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
              <div className="table-empty table-empty-error">{ridesError}</div>
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
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .map((r) => (
                    <tr key={r.ride_id}>
                      <td><span className="ride-id-link">R{r.ride_id}</span></td>
                      <td className="td-date">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
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
              <div className="table-empty table-empty-error">{paymentsError}</div>
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
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .map((p) => (
                    <tr key={p.payment_id}>
                      <td><span className="ride-id-link">PAY-{p.payment_id}</span></td>
                      <td className="td-date">
                        {p.createdAt ? new Date(p.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                      </td>
                      <td><span className="ride-id-link">R{p.ride_id}</span></td>
                      <td><strong>${parseFloat(p.amount).toFixed(2)}</strong></td>
                      <td>{formatMethod(p.payment_method, p.card_last_four)}</td>
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
                <div className="profile-avatar">
                  {user?.firstName && user?.lastName
                    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
                    : user?.firstName
                      ? user.firstName.slice(0, 2).toUpperCase()
                      : '?'}
                </div>
                <div>
                  <div className="profile-name">
                    {user?.firstName && user?.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user?.firstName || '—'}
                  </div>
                  <div className="profile-since">
                    {user?.createdAt
                      ? `Member since ${new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
                      : 'Member'}
                  </div>
                </div>
              </div>

              <div className="section-label">Account info</div>
              <div className="account-field">
                <span className="account-field-label">Full Name</span>
                <span className="account-field-value">
                  {user?.firstName && user?.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user?.firstName || '—'}
                </span>
              </div>
              <div className="account-field">
                <span className="account-field-label">Email</span>
                <span className="account-field-value">
                  {user?.emailAddresses?.[0]?.emailAddress || '—'}
                </span>
              </div>
              <div className="account-field">
                <span className="account-field-label">Phone</span>
                <span className="account-field-value">
                  {riderProfile?.phone_number || user?.phoneNumbers?.[0]?.phoneNumber || '—'}
                </span>
              </div>
              <div className="account-field">
                <span className="account-field-label">Default Payment</span>
                <span className="account-field-value">
                  {riderProfile?.default_payment_method
                    ? riderProfile.default_payment_method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                    : '—'}
                </span>
              </div>
              <div className="account-field">
                <span className="account-field-label">Rider Rating</span>
                <span className="account-field-value">
                  {riderProfile?.rating ? `${parseFloat(riderProfile.rating).toFixed(2)} ★` : '—'}
                </span>
              </div>

              <div className="section-label section-label-mt">Ride preferences</div>
              <div className="account-field">
                <span className="account-field-label">Temperature</span>
                <span className="account-field-value">
                  {{ cool: 'Cool', warm: 'Warm', any: 'Any' }[riderProfile?.preferred_temp] || '—'}
                </span>
              </div>
              <div className="account-field">
                <span className="account-field-label">Music</span>
                <span className="account-field-value">
                  {{ off: 'Off', low: 'Low', riders_choice: "Rider's Choice" }[riderProfile?.preferred_music] || '—'}
                </span>
              </div>
              <div className="account-field">
                <span className="account-field-label">Conversation</span>
                <span className="account-field-value">
                  {{ quiet: 'Quiet', chatty: 'Chatty', any: 'Any' }[riderProfile?.preferred_conversation] || '—'}
                </span>
              </div>

            </div>

            <div className="profile-stats-col">
              <div className="p-card profile-stat-card">
                <div className="portal-stat-label">Total Rides</div>
                <div className="portal-stat-value">{riderStats ? riderStats.total : '—'}</div>
                <div className="portal-stat-sub">lifetime rides</div>
              </div>
              <div className="p-card profile-stat-card">
                <div className="portal-stat-label">Total Spent</div>
                <div className="portal-stat-value stat-magenta">
                  {riderStats ? `$${riderStats.totalSpent.toFixed(2)}` : '—'}
                </div>
                <div className="portal-stat-sub">all time</div>
              </div>
              <div className="p-card profile-stat-card">
                <div className="portal-stat-label">Avg Fare</div>
                <div className="portal-stat-value">
                  {riderStats && riderStats.avg > 0 ? `$${riderStats.avg.toFixed(2)}` : '—'}
                </div>
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
