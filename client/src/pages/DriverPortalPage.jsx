import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@clerk/react';
import PortalNavbar from '../components/PortalNavbar';
import { driversApi, ridesApi, paymentsApi } from '../services/api';

const TABS = [
  { id: 'dashboard', label: 'Dashboard'  },
  { id: 'find',      label: 'Find Rides' },
  { id: 'my-rides',  label: 'My Rides'  },
  { id: 'earnings',  label: 'Earnings'  },
];

const DRIVER_CUT = 0.65;

const capWords = (s) =>
  s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const fmt = (n) => `$${n.toFixed(2)}`;
const fmtCut = (n) => fmt(n * DRIVER_CUT);

/* ── In-Progress Ride Card ─────────────────────────────────────────────────── */
const InProgressCard = ({ ride, onComplete, onCancel, mutating }) => {
  if (!ride) return (
    <div className="in-progress-card in-progress-no-ride">
      No active ride right now.
    </div>
  );

  return (
    <div className="in-progress-card">
      <div className="ip-status-badge">
        <span className="ip-status-dot" />
        {ride.status.replace('_', ' ').toUpperCase()}
      </div>
      <div className="ip-fare-row">
        <div className="ip-route">
          <div className="ip-stop">
            <div className="ip-dot ip-dot-pickup" />
            {ride.pickup_location}
          </div>
          <div className="ip-stop">
            <div className="ip-dot ip-dot-dropoff" />
            {ride.dropoff_location}
          </div>
        </div>
        <div className="ip-fare-info">
          <div className="ip-fare">{ride.fare ? fmt(parseFloat(ride.fare)) : '—'}</div>
          <div className="ip-distance">Ride #{ride.ride_id}</div>
        </div>
      </div>
      <div className="ip-progress-bar">
        <div className="ip-progress-fill" />
      </div>
      <div className="ip-actions">
        <button className="btn-complete" onClick={onComplete} disabled={mutating}>
          {mutating === 'complete' ? 'Completing…' : 'Complete ride'}
        </button>
        <button className="btn-cancel-ride" onClick={onCancel} disabled={mutating}>
          {mutating === 'cancel' ? 'Cancelling…' : 'Cancel'}
        </button>
      </div>
    </div>
  );
};

/* ── DriverPortalPage ──────────────────────────────────────────────────────── */
const DriverPortalPage = ({ theme, onThemeToggle }) => {
  const [activeTab,      setActiveTab]      = useState('dashboard');
  const [driverProfile,  setDriverProfile]  = useState(null);
  const [allRides,       setAllRides]       = useState([]);
  const [availableRides, setAvailableRides] = useState([]);
  const [myRides,        setMyRides]        = useState([]);
  const [payments,       setPayments]       = useState([]);
  const [activeRide,     setActiveRide]     = useState(null);
  const [loadingRides,   setLoadingRides]   = useState(false);
  const [loadingPayments,setLoadingPayments]= useState(false);
  const [accepting,      setAccepting]      = useState(null);
  const [mutating,       setMutating]       = useState(null);
  const [isAvailable,    setIsAvailable]    = useState(true);

  // ── Fetch driver profile + all rides on mount ──────────────────────────────
  useEffect(() => {
    driversApi.getMe()
      .then((res) => setDriverProfile(res.data?.data ?? null))
      .catch(() => {});

    ridesApi.getAll()
      .then((res) => {
        const raw = res.data?.data ?? res.data ?? [];
        setAllRides(Array.isArray(raw) ? raw : []);
      })
      .catch(() => {});

    ridesApi.getAll({ statuses: 'in_progress,accepted,en_route' })
      .then((res) => setActiveRide(res.data.data?.[0] ?? null))
      .catch(() => {});
  }, []);

  // ── Tab-triggered fetches ──────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'find') {
      setLoadingRides(true);
      ridesApi.getAll({ status: 'requested' })
        .then((res) => setAvailableRides(res.data.data ?? []))
        .catch(() => {})
        .finally(() => setLoadingRides(false));
    }
    if (activeTab === 'my-rides') {
      setLoadingRides(true);
      ridesApi.getAll()
        .then((res) => setMyRides(res.data.data ?? []))
        .catch(() => {})
        .finally(() => setLoadingRides(false));
    }
    if (activeTab === 'earnings') {
      setLoadingPayments(true);
      paymentsApi.getAll()
        .then((res) => setPayments(res.data.data ?? []))
        .catch(() => {})
        .finally(() => setLoadingPayments(false));
    }
  }, [activeTab]);

  // ── Computed earnings from real rides ──────────────────────────────────────
  const driverRides = useMemo(() => {
    if (!driverProfile) return [];
    return allRides.filter((r) => r.driver_id === driverProfile.driver_id && r.status === 'completed' && r.fare);
  }, [allRides, driverProfile]);

  const earningsStats = useMemo(() => {
    const now = new Date();
    const startOf = (d) => { const c = new Date(d); c.setHours(0,0,0,0); return c; };
    const todayStart = startOf(now);
    const weekAnchor = new Date(now); weekAnchor.setDate(now.getDate() - now.getDay());
    const weekStart  = startOf(weekAnchor);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);

    const sum = (rides) => rides.reduce((s, r) => s + parseFloat(r.fare) * DRIVER_CUT, 0);

    const today = driverRides.filter((r) => new Date(r.createdAt) >= todayStart);
    const week  = driverRides.filter((r) => new Date(r.createdAt) >= weekStart);
    const month = driverRides.filter((r) => new Date(r.createdAt) >= monthStart);
    const year  = driverRides.filter((r) => new Date(r.createdAt) >= yearStart);

    return {
      today:      { amount: sum(today), count: today.length },
      week:       { amount: sum(week),  count: week.length  },
      month:      { amount: sum(month), count: month.length },
      year:       { amount: sum(year),  count: year.length  },
      total:      driverRides.length,
    };
  }, [driverRides]);

  const weeklyChart = useMemo(() => {
    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const data = DAY_LABELS.map((label, idx) => {
      const target = new Date(now);
      target.setDate(now.getDate() - now.getDay() + idx);
      const dayStr = target.toDateString();
      const amount = driverRides
        .filter((r) => new Date(r.createdAt).toDateString() === dayStr)
        .reduce((s, r) => s + parseFloat(r.fare) * DRIVER_CUT, 0);
      return { label, amount };
    });
    const max = Math.max(...data.map((d) => d.amount), 1);
    return data.map((d) => ({ ...d, pct: Math.round((d.amount / max) * 100) }));
  }, [driverRides]);

  const recentCompleted = useMemo(() =>
    [...driverRides]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 4),
  [driverRides]);

  const completionRate = useMemo(() => {
    if (!driverProfile) return null;
    const mine = allRides.filter((r) => r.driver_id === driverProfile.driver_id);
    const done = mine.filter((r) => r.status === 'completed').length;
    const total = mine.filter((r) => ['completed', 'cancelled'].includes(r.status)).length;
    return total > 0 ? Math.round((done / total) * 100) : null;
  }, [allRides, driverProfile]);

  // ── Accept / Complete / Cancel ─────────────────────────────────────────────
  const handleAcceptRide = async (ride) => {
    setAccepting(ride.ride_id);
    try {
      await ridesApi.update(ride.ride_id, { status: 'accepted' });
      setAvailableRides((prev) => prev.filter((r) => r.ride_id !== ride.ride_id));
    } catch (_) {}
    finally { setAccepting(null); }
  };

  const handleCompleteRide = async () => {
    if (!activeRide) return;
    setMutating('complete');
    try {
      await ridesApi.update(activeRide.ride_id, { status: 'completed' });
      setActiveRide(null);
      setMyRides([]);
      setAllRides([]);
    } catch (err) {
      console.error('Complete ride failed:', err.response?.data || err.message);
    } finally { setMutating(null); }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;
    setMutating('cancel');
    try {
      await ridesApi.update(activeRide.ride_id, { status: 'cancelled' });
      setActiveRide(null);
      setMyRides([]);
      setAllRides([]);
    } catch (err) {
      console.error('Cancel ride failed:', err.response?.data || err.message);
    } finally { setMutating(null); }
  };

  // ── Navbar ─────────────────────────────────────────────────────────────────
  const { user } = useUser();
  const userInitials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user?.firstName ? user.firstName.slice(0, 2).toUpperCase() : '';
  const userName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName[0]}.`
    : user?.firstName || '';

  const extraPill = (
    <button
      className={`avail-pill${isAvailable ? '' : ' avail-pill-off'}`}
      onClick={() => setIsAvailable((v) => !v)}
    >
      <span className="live-pill-dot" />
      {isAvailable ? 'Available' : 'Not Available'}
    </button>
  );

  return (
    <div className="portal-shell">
      <PortalNavbar
        role="Driver"
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        theme={theme}
        onThemeToggle={onThemeToggle}
        userInitials={userInitials}
        userName={userName}
        extraPill={extraPill}
      />

      {/* ── Dashboard ──────────────────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <div className="driver-dashboard">
          <div className="driver-dashboard-header">
            <h1 className="driver-dashboard-title">Dashboard</h1>
            <div className="driver-dashboard-subtitle">Your performance at a glance</div>
          </div>

          <div className="driver-stats-row">
            <div className="driver-stat-card">
              <div className="driver-stat-label">Today's Earnings</div>
              <div className="driver-stat-value">{fmt(earningsStats.today.amount)}</div>
              <div className="driver-stat-sub">{earningsStats.today.count} ride{earningsStats.today.count !== 1 ? 's' : ''}</div>
            </div>
            <div className="driver-stat-card">
              <div className="driver-stat-label">This Week</div>
              <div className="driver-stat-value">{fmt(earningsStats.week.amount)}</div>
              <div className="driver-stat-sub">{earningsStats.week.count} ride{earningsStats.week.count !== 1 ? 's' : ''}</div>
            </div>
            <div className="driver-stat-card">
              <div className="driver-stat-label">This Month</div>
              <div className="driver-stat-value">{fmt(earningsStats.month.amount)}</div>
              <div className="driver-stat-sub">{earningsStats.month.count} ride{earningsStats.month.count !== 1 ? 's' : ''}</div>
            </div>
            <div className="driver-stat-card">
              <div className="driver-stat-label">Driver Rating</div>
              <div className="driver-stat-value">
                {driverProfile?.rating ? `${parseFloat(driverProfile.rating).toFixed(1)} ★` : '—'}
              </div>
              <div className="driver-stat-sub">{earningsStats.total} total ride{earningsStats.total !== 1 ? 's' : ''}</div>
            </div>
          </div>

          <div className="driver-page">
            <div className="portal-panel">
              <div className="section-label">Current Ride</div>
              <InProgressCard
                ride={activeRide}
                onComplete={handleCompleteRide}
                onCancel={handleCancelRide}
                mutating={mutating}
              />

              <div className="section-label section-label-mt">Weekly Earnings</div>
              <div className="p-card">
                <div className="earnings-chart">
                  {weeklyChart.map((e) => (
                    <div className="earnings-row" key={e.label}>
                      <span className="earnings-day">{e.label}</span>
                      <div className="earnings-bar-wrap">
                        <div className="earnings-bar" style={{ width: `${e.pct}%` }} />
                      </div>
                      <span className="earnings-amt">{fmt(e.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="portal-panel">
              <div className="section-label">Completion Rate</div>
              <div className="p-card acceptance-card">
                <div className="acceptance-rate">
                  {completionRate !== null ? `${completionRate}%` : '—'}
                </div>
                <div className="acceptance-sub">
                  {completionRate !== null ? `${earningsStats.total} completed rides` : 'No rides yet'}
                </div>
                <div className="acceptance-bar-wrap">
                  <div className="acceptance-bar" style={{ width: `${completionRate ?? 0}%` }} />
                </div>
              </div>

              <div className="section-label section-label-mt">Recent Completed</div>
              <div className="p-card">
                {recentCompleted.length === 0 ? (
                  <div className="no-data-text">
                    No completed rides yet.
                  </div>
                ) : recentCompleted.map((r) => (
                  <div className="completed-item" key={r.ride_id}>
                    <div>
                      <div className="completed-route">
                        {r.pickup_location} → {r.dropoff_location}
                      </div>
                      <div className="completed-id">R{r.ride_id}</div>
                    </div>
                    <div className="completed-fare">{r.fare ? fmtCut(parseFloat(r.fare)) : '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Find Rides ─────────────────────────────────────────────── */}
      {activeTab === 'find' && (
        <div className="find-rides-page">
          <div className="page-header">
            <h1>Find Rides</h1>
            <p>Open ride requests available for pickup</p>
          </div>

          {loadingRides ? (
            <div className="table-empty">Looking for available rides…</div>
          ) : availableRides.length === 0 ? (
            <div className="no-rides-state">
              <div className="no-rides-icon">🚗</div>
              <h3>No rides available right now</h3>
              <p>New requests will appear here automatically. Stay online!</p>
            </div>
          ) : (
            <div className="ride-request-grid">
              {availableRides.map((ride) => (
                <div className="ride-request-card" key={ride.ride_id}>
                  <div className="rr-header">
                    <span className="rr-id">Ride #{ride.ride_id}</span>
                    <span className="rr-fare">
                      {ride.fare && parseFloat(ride.fare) > 0 ? fmt(parseFloat(ride.fare)) : '$5.00'}
                    </span>
                  </div>
                  <div className="rr-stops">
                    <div className="rr-stop">
                      <div className="stop-dot-pickup" />
                      <span>{ride.pickup_location}</span>
                    </div>
                    <div className="rr-connector" />
                    <div className="rr-stop">
                      <div className="stop-dot-dropoff" />
                      <span>{ride.dropoff_location}</span>
                    </div>
                  </div>
                  <div className="rr-actions">
                    <button
                      className="btn-decline"
                      onClick={() => setAvailableRides((prev) => prev.filter((r) => r.ride_id !== ride.ride_id))}
                      disabled={accepting === ride.ride_id}
                    >
                      Decline
                    </button>
                    <button
                      className="btn-accept"
                      onClick={() => handleAcceptRide(ride)}
                      disabled={accepting === ride.ride_id}
                    >
                      {accepting === ride.ride_id ? 'Accepting…' : 'Accept'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── My Rides ───────────────────────────────────────────────── */}
      {activeTab === 'my-rides' && (
        <div className="history-page">
          <div className="page-header">
            <h1>My Rides</h1>
            <p>Rides assigned to you on the RideFlow platform</p>
          </div>
          <div className="table-wrap">
            {loadingRides ? (
              <div className="table-empty">Loading rides…</div>
            ) : myRides.filter((r) => !driverProfile || r.driver_id === driverProfile.driver_id).length === 0 ? (
              <div className="table-empty">No rides assigned to you yet.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Ride ID</th>
                    <th>Pickup</th>
                    <th>Dropoff</th>
                    <th>Status</th>
                    <th>Fare</th>
                  </tr>
                </thead>
                <tbody>
                  {myRides
                    .filter((r) => !driverProfile || r.driver_id === driverProfile.driver_id)
                    .map((r) => (
                      <tr key={r.ride_id}>
                        <td><span className="ride-id-link">R{r.ride_id}</span></td>
                        <td>{r.pickup_location}</td>
                        <td>{r.dropoff_location}</td>
                        <td>
                          <span className={`status-badge status-${r.status}`}>
                            {capWords(r.status)}
                          </span>
                        </td>
                        <td>{r.fare ? fmt(parseFloat(r.fare)) : '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Earnings ───────────────────────────────────────────────── */}
      {activeTab === 'earnings' && (
        <div className="earnings-page">
          <div className="page-header">
            <h1>Earnings</h1>
            <p>Your complete earnings breakdown</p>
          </div>

          <div className="earnings-totals-row">
            <div className="earnings-total-card">
              <div className="et-label">Today</div>
              <div className="et-value">{fmt(earningsStats.today.amount)}</div>
              <div className="et-sub">{earningsStats.today.count} ride{earningsStats.today.count !== 1 ? 's' : ''}</div>
            </div>
            <div className="earnings-total-card">
              <div className="et-label">This Week</div>
              <div className="et-value">{fmt(earningsStats.week.amount)}</div>
              <div className="et-sub">{earningsStats.week.count} ride{earningsStats.week.count !== 1 ? 's' : ''}</div>
            </div>
            <div className="earnings-total-card">
              <div className="et-label">This Month</div>
              <div className="et-value">{fmt(earningsStats.month.amount)}</div>
              <div className="et-sub">{earningsStats.month.count} ride{earningsStats.month.count !== 1 ? 's' : ''}</div>
            </div>
            <div className="earnings-total-card highlight">
              <div className="et-label">This Year</div>
              <div className="et-value">{fmt(earningsStats.year.amount)}</div>
              <div className="et-sub">{earningsStats.year.count} ride{earningsStats.year.count !== 1 ? 's' : ''} total</div>
            </div>
          </div>

          <div className="p-card earnings-chart-card">
            <div className="earnings-chart-title">Weekly Breakdown</div>
            <div className="earnings-chart earnings-chart-lg">
              {weeklyChart.map((e) => (
                <div className="earnings-row" key={e.label}>
                  <span className="earnings-day">{e.label}</span>
                  <div className="earnings-bar-wrap">
                    <div className="earnings-bar" style={{ width: `${e.pct}%` }} />
                  </div>
                  <span className="earnings-amt">{fmt(e.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="section-label section-label-mb">Payment Records</div>
          <div className="table-wrap">
            {loadingPayments ? (
              <div className="table-empty">Loading payments…</div>
            ) : payments.length === 0 ? (
              <div className="table-empty">No payment records yet.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Payment ID</th>
                    <th>Ride</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const linkedRide = allRides.find((r) => r.ride_id === p.ride_id);
                    const isCancellation = linkedRide?.status === 'cancelled';
                    return (
                      <tr key={p.payment_id}>
                        <td><span className="ride-id-link">PAY-{p.payment_id}</span></td>
                        <td>
                          {isCancellation
                            ? <span className="cancellation-fee-label">Cancellation Fee</span>
                            : <span className="ride-id-link">R{p.ride_id}</span>
                          }
                        </td>
                        <td><strong>{fmtCut(parseFloat(p.amount))}</strong></td>
                        <td>
                          <span className={`status-badge status-${p.status}`}>
                            {capWords(p.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverPortalPage;