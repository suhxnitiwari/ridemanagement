import { useState, useEffect, useCallback, useMemo } from 'react';
import PortalNavbar from '../components/PortalNavbar';
import { useUser } from '@clerk/react';
import { ridesApi, driversApi } from '../services/api';

const STATUS_OPTS = [
  { value: 'all',       label: 'All statuses' },
  { value: 'active',    label: 'Active'        },
  { value: 'completed', label: 'Completed'     },
  { value: 'cancelled', label: 'Cancelled'     },
];
const ACTIVE_STATUSES = ['requested', 'accepted', 'en_route', 'in_progress'];

const capWords = (s) =>
  s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const EMPTY_FORM = { pickup_location: '', dropoff_location: '', status: 'requested', fare: '' };
const EMPTY_DRIVER_FORM = { status: 'available', rating: '', phone_number: '', vehicle_model: '', vehicle_color: '', license_plate: '' };

const DRIVER_SORT_OPTS = [
  { value: 'rating_desc',   label: 'Rating: High → Low'     },
  { value: 'rating_asc',    label: 'Rating: Low → High'     },
  { value: 'revenue_desc',  label: 'Revenue: High → Low'    },
  { value: 'revenue_asc',   label: 'Revenue: Low → High'    },
  { value: 'rides_desc',    label: 'Total Rides: Most First' },
  { value: 'name_asc',      label: 'Name: A → Z'            },
];

const ADMIN_TABS = [
  { id: 'dashboard', label: 'Dashboard'         },
  { id: 'rides',     label: 'Ride Management'   },
  { id: 'drivers',   label: 'Driver Management' },
];

/* ── Chart components ──────────────────────────────────────────────────────── */

const MiniBarChart = ({ data, color = 'var(--magenta)', formatVal = (v) => v }) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="mini-bar-chart">
      {data.map((d, i) => (
        <div key={i} className="mbc-col">
          <span className="mbc-val">{d.value > 0 ? formatVal(d.value) : ''}</span>
          <div className="mbc-bar-wrap">
            <div
              className="mbc-bar"
              style={{ height: `${Math.round((d.value / max) * 100)}%`, background: color }}
            />
          </div>
          <span className="mbc-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
};

const HorizBar = ({ label, count, total, color }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="horiz-bar-row">
      <div className="hbr-label">{label}</div>
      <div className="hbr-track">
        <div className="hbr-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="hbr-count">
        {count} <span className="hbr-pct">({pct}%)</span>
      </div>
    </div>
  );
};

const HealthMetric = ({ label, value, pct, color }) => (
  <div className="health-metric">
    <div className="health-metric-top">
      <span className="health-metric-label">{label}</span>
      <span className="health-metric-val" style={{ color }}>{value}</span>
    </div>
    <div className="health-metric-bar-wrap">
      <div className="health-metric-bar" style={{ width: `${pct}%`, background: color }} />
    </div>
  </div>
);

/* ── Admin Page ─────────────────────────────────────────────────────────────── */
const AdminPage = ({ theme, onThemeToggle }) => {
  const [adminTab, setAdminTab] = useState('dashboard');

  /* Rides tab */
  const [rides,        setRides]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setFilter]       = useState('all');
  const [showCreate,   setShowCreate]   = useState(false);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [mutating,     setMutating]     = useState(false);
  const [editingRide,  setEditingRide]  = useState(null);
  const [deletingId,   setDeletingId]   = useState(null);
  const [error,        setError]        = useState('');

  /* Dashboard — unfiltered full dataset */
  const [allRides, setAllRides] = useState([]);

  /* Drivers tab */
  const [driverStats,      setDriverStats]      = useState([]);
  const [driverSort,       setDriverSort]       = useState('rating_desc');
  const [driverSearch,     setDriverSearch]     = useState('');
  const [showDriverEdit,   setShowDriverEdit]   = useState(false);
  const [editingDriver,    setEditingDriver]    = useState(null);
  const [driverForm,       setDriverForm]       = useState(EMPTY_DRIVER_FORM);
  const [deletingDriverId, setDeletingDriverId] = useState(null);

  /* Fetch all rides for dashboard on mount */
  useEffect(() => {
    ridesApi.getAll({})
      .then((res) => setAllRides(res.data?.data ?? []))
      .catch(() => {});
  }, []);

  /* Fetch driver stats on mount */
  useEffect(() => {
    driversApi.getStats()
      .then((res) => setDriverStats(res.data?.data ?? []))
      .catch(() => {});
  }, []);

  /* Fetch filtered rides for rides tab */
  const fetchRides = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter === 'active') params.statuses = ACTIVE_STATUSES.join(',');
      else if (statusFilter !== 'all') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const res = await ridesApi.getAll(params);
      setRides(res.data?.data ?? []);
    } catch (err) {
      setError('Failed to load rides: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    if (adminTab !== 'rides') return;
    const t = setTimeout(fetchRides, 300);
    return () => clearTimeout(t);
  }, [fetchRides, adminTab]);

  /* Also load on tab switch */
  useEffect(() => {
    if (adminTab === 'rides') fetchRides();
  }, [adminTab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Ride handlers ─────────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!form.pickup_location.trim() || !form.dropoff_location.trim()) {
      setError('Pickup and dropoff locations are required.');
      return;
    }
    setMutating(true);
    setError('');
    try {
      const payload = {
        pickup_location:  form.pickup_location,
        dropoff_location: form.dropoff_location,
        status:           form.status,
        fare:             form.fare ? parseFloat(form.fare) : null,
      };
      if (editingRide) {
        const res = await ridesApi.update(editingRide.ride_id, payload);
        setRides((prev) => prev.map((r) => r.ride_id === editingRide.ride_id ? res.data.data : r));
      }
      setShowCreate(false);
      setEditingRide(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save ride');
    } finally {
      setMutating(false);
    }
  };

  const handleDelete = async (id) => {
    setMutating(true);
    try {
      await ridesApi.delete(id);
      setRides((prev) => prev.filter((r) => r.ride_id !== id));
      setDeletingId(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete ride');
    } finally {
      setMutating(false);
    }
  };

  const openEdit = (ride) => {
    setEditingRide(ride);
    setForm({ pickup_location: ride.pickup_location, dropoff_location: ride.dropoff_location, status: ride.status, fare: ride.fare ?? '' });
    setError('');
    setShowCreate(true);
  };

  const closeModal = () => { setShowCreate(false); setEditingRide(null); setForm(EMPTY_FORM); setError(''); };

  /* ── Driver sort + filter ──────────────────────────────────────────────── */
  const sortedDriverStats = useMemo(() => {
    const arr = [...driverStats];
    switch (driverSort) {
      case 'rating_desc':  return arr.sort((a, b) => b.rating - a.rating);
      case 'rating_asc':   return arr.sort((a, b) => a.rating - b.rating);
      case 'revenue_desc': return arr.sort((a, b) => b.total_revenue - a.total_revenue);
      case 'revenue_asc':  return arr.sort((a, b) => a.total_revenue - b.total_revenue);
      case 'rides_desc':   return arr.sort((a, b) => b.total_rides - a.total_rides);
      case 'name_asc':     return arr.sort((a, b) => a.name.localeCompare(b.name));
      default: return arr;
    }
  }, [driverStats, driverSort]);

  const filteredDriverStats = useMemo(() => {
    const q = driverSearch.trim().toLowerCase();
    if (!q) return sortedDriverStats;
    return sortedDriverStats.filter((d) =>
      d.name?.toLowerCase().includes(q) ||
      d.vehicle?.toLowerCase().includes(q) ||
      d.license_plate?.toLowerCase().includes(q)
    );
  }, [sortedDriverStats, driverSearch]);

  /* ── Driver edit/delete ────────────────────────────────────────────────── */
  const openDriverEdit = (d) => {
    setEditingDriver(d);
    setDriverForm({ status: d.status ?? 'available', rating: d.rating ?? '', phone_number: d.phone_number ?? '', vehicle_model: d.vehicle ?? '', vehicle_color: d.vehicle_color ?? '', license_plate: d.license_plate ?? '' });
    setError('');
    setShowDriverEdit(true);
  };

  const closeDriverModal = () => { setShowDriverEdit(false); setEditingDriver(null); setDriverForm(EMPTY_DRIVER_FORM); setError(''); };

  const handleDriverSubmit = async () => {
    setMutating(true);
    setError('');
    try {
      await driversApi.update(editingDriver.driver_id, {
        status:        driverForm.status,
        rating:        driverForm.rating !== '' ? parseFloat(driverForm.rating) : null,
        phone_number:  driverForm.phone_number  || null,
        vehicle_model: driverForm.vehicle_model || null,
        vehicle_color: driverForm.vehicle_color || null,
        license_plate: driverForm.license_plate || null,
      });
      const res = await driversApi.getStats();
      setDriverStats(res.data?.data ?? []);
      closeDriverModal();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save driver');
    } finally {
      setMutating(false);
    }
  };

  const handleDriverDelete = async (id) => {
    setMutating(true);
    try {
      await driversApi.delete(id);
      setDriverStats((prev) => prev.filter((d) => d.driver_id !== id));
      setDeletingDriverId(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove driver');
    } finally {
      setMutating(false);
    }
  };

  /* ── Dashboard computations ────────────────────────────────────────────── */
  const totalRevenue   = allRides.filter((r) => r.status === 'completed' && r.fare).reduce((s, r) => s + parseFloat(r.fare), 0);
  const openRequests   = allRides.filter((r) => r.status === 'requested').length;
  const inProgress     = allRides.filter((r) => r.status === 'in_progress').length;
  const completed      = allRides.filter((r) => r.status === 'completed').length;
  const cancelled      = allRides.filter((r) => r.status === 'cancelled').length;
  const avgFare        = completed > 0 ? totalRevenue / completed : 0;
  const completionRate = allRides.length > 0 ? Math.round((completed / allRides.length) * 100) : 0;
  const cancelRate     = allRides.length > 0 ? Math.round((cancelled / allRides.length) * 100) : 0;

  const ridesByStatus = useMemo(() => {
    const counts = {};
    allRides.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    return counts;
  }, [allRides]);

  const dailyData = useMemo(() => {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const counts  = new Array(7).fill(0);
    const revenue = new Array(7).fill(0);
    allRides.forEach((r) => {
      const d = new Date(r.createdAt || r.created_at);
      if (isNaN(d.getTime())) return;
      const dow = (d.getDay() + 6) % 7;
      counts[dow]++;
      if (r.fare && r.status === 'completed') revenue[dow] += parseFloat(r.fare);
    });
    return {
      rides:   labels.map((label, i) => ({ label, value: counts[i]  })),
      revenue: labels.map((label, i) => ({ label, value: Math.round(revenue[i]) })),
    };
  }, [allRides]);

  const driverStatusCounts = useMemo(() => {
    const c = { available: 0, on_ride: 0, offline: 0 };
    driverStats.forEach((d) => { c[d.status] = (c[d.status] || 0) + 1; });
    return c;
  }, [driverStats]);

  const driverAvailPct = driverStats.length > 0
    ? Math.round((driverStatusCounts.available / driverStats.length) * 100)
    : 0;

  const topDrivers = useMemo(() =>
    [...driverStats].sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 5),
    [driverStats]
  );
  const maxRevenue = topDrivers[0]?.total_revenue || 1;

  /* ── User info ─────────────────────────────────────────────────────────── */
  const { user } = useUser();
  const userInitials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user?.firstName?.slice(0, 2).toUpperCase() || '';
  const userName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName[0]}.`
    : user?.firstName || '';

  return (
    <div className="portal-shell">
      <PortalNavbar
        role="Admin"
        theme={theme}
        onThemeToggle={onThemeToggle}
        userInitials={userInitials}
        userName={userName}
      />

      {/* ── Tab bar ───────────────────────────────────────────────────── */}
      <div className="admin-tab-bar">
        {ADMIN_TABS.map((t) => (
          <button
            key={t.id}
            className={`admin-tab${adminTab === t.id ? ' admin-tab-active' : ''}`}
            onClick={() => setAdminTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="admin-page">

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ── DASHBOARD ─────────────────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════ */}
        {adminTab === 'dashboard' && (
          <>
            <div className="admin-header">
              <h1 className="admin-title">Dashboard</h1>
              <div className="admin-subtitle">Real-time platform overview</div>
            </div>

            {/* Stats row */}
            <div className="admin-stats-row admin-stats-row-6">
              <div className="admin-stat-card">
                <div className="admin-stat-label">Total Rides</div>
                <div className="admin-stat-value">{allRides.length || '—'}</div>
                <div className="admin-stat-sub">in database</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-label">Open Requests</div>
                <div className="admin-stat-value warning">{openRequests}</div>
                <div className="admin-stat-sub">awaiting driver</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-label">In Progress</div>
                <div className="admin-stat-value">{inProgress}</div>
                <div className="admin-stat-sub">active rides</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-label">Total Revenue</div>
                <div className="admin-stat-value magenta">${totalRevenue.toFixed(2)}</div>
                <div className="admin-stat-sub">{completed} completed rides</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-label">Avg Fare</div>
                <div className="admin-stat-value">${avgFare.toFixed(2)}</div>
                <div className="admin-stat-sub">per completed ride</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-label">Total Drivers</div>
                <div className="admin-stat-value">{driverStats.length}</div>
                <div className="admin-stat-sub">{driverStatusCounts.available} available now</div>
              </div>
            </div>

            {/* Charts row 1 */}
            <div className="admin-chart-row">
              <div className="p-card admin-chart-card">
                <div className="admin-chart-title">Rides by Day of Week</div>
                <div className="admin-chart-subtitle">all-time rides created per day</div>
                <MiniBarChart data={dailyData.rides} color="var(--magenta)" />
              </div>
              <div className="p-card admin-chart-card">
                <div className="admin-chart-title">Revenue by Day of Week</div>
                <div className="admin-chart-subtitle">completed ride revenue each day ($)</div>
                <MiniBarChart
                  data={dailyData.revenue}
                  color="linear-gradient(180deg,#10b981 0%,#059669 100%)"
                  formatVal={(v) => `$${v}`}
                />
              </div>
            </div>

            {/* Charts row 2 */}
            <div className="admin-chart-row">
              <div className="p-card admin-chart-card">
                <div className="admin-chart-title">Rides by Status</div>
                <div className="admin-chart-subtitle">distribution across all statuses</div>
                <div className="horiz-bar-list">
                  {[
                    ['Completed',   ridesByStatus.completed   || 0, '#10b981'],
                    ['Requested',   ridesByStatus.requested   || 0, '#f59e0b'],
                    ['Cancelled',   ridesByStatus.cancelled   || 0, '#ef4444'],
                    ['In Progress', ridesByStatus.in_progress || 0, '#ec4899'],
                    ['Accepted',    ridesByStatus.accepted    || 0, '#3b82f6'],
                    ['En Route',    ridesByStatus.en_route    || 0, '#8b5cf6'],
                  ].map(([label, count, color]) => (
                    <HorizBar key={label} label={label} count={count} total={allRides.length} color={color} />
                  ))}
                </div>
              </div>

              <div className="p-card admin-chart-card">
                <div className="admin-chart-title">Platform Health</div>
                <div className="admin-chart-subtitle">key performance metrics</div>
                <div className="health-metrics-list">
                  <HealthMetric label="Completion Rate"    value={`${completionRate}%`}  pct={completionRate}  color="#10b981" />
                  <HealthMetric label="Cancellation Rate"  value={`${cancelRate}%`}      pct={cancelRate}      color="#ef4444" />
                  <HealthMetric label="Driver Availability" value={`${driverAvailPct}%`} pct={driverAvailPct}  color="#3b82f6" />
                </div>
                <div className="admin-chart-subtitle" style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>
                  Driver status breakdown
                </div>
                <div className="horiz-bar-list">
                  <HorizBar label="Available" count={driverStatusCounts.available || 0} total={driverStats.length} color="#10b981" />
                  <HorizBar label="On Ride"   count={driverStatusCounts.on_ride   || 0} total={driverStats.length} color="#ec4899" />
                  <HorizBar label="Offline"   count={driverStatusCounts.offline   || 0} total={driverStats.length} color="#6b7280" />
                </div>
              </div>
            </div>

            {/* Top drivers leaderboard */}
            <div className="p-card admin-chart-card admin-chart-wide">
              <div className="admin-chart-title">Top Drivers by Revenue</div>
              <div className="admin-chart-subtitle">top 5 earners on the platform</div>
              {topDrivers.length === 0 ? (
                <div className="table-empty">No driver data yet.</div>
              ) : (
                <div className="top-drivers-list">
                  {topDrivers.map((d, i) => (
                    <div key={d.driver_id} className="top-driver-row">
                      <span className="top-driver-rank">#{i + 1}</span>
                      <span className="top-driver-name">{d.name}</span>
                      <span className="top-driver-vehicle">{d.vehicle}</span>
                      <div className="top-driver-bar-wrap">
                        <div
                          className="top-driver-bar"
                          style={{ width: `${Math.round((d.total_revenue / maxRevenue) * 100)}%` }}
                        />
                      </div>
                      <span className="top-driver-revenue">${d.total_revenue.toFixed(2)}</span>
                      <span className="top-driver-rides">{d.completed_rides} rides</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ── RIDE MANAGEMENT ───────────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════ */}
        {adminTab === 'rides' && (
          <>
            <div className="admin-header">
              <h1 className="admin-title">Ride Management</h1>
              <div className="admin-subtitle">Search, filter and edit all rides on the platform</div>
            </div>

            <div className="p-card admin-table-card">
              <div className="admin-toolbar">
                <input
                  className="admin-search"
                  type="search"
                  placeholder="Search by pickup or dropoff location…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select className="admin-select" value={statusFilter} onChange={(e) => setFilter(e.target.value)}>
                  {STATUS_OPTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div className="table-wrap table-wrap-flush">
                {loading ? (
                  <div className="table-empty">Loading rides…</div>
                ) : rides.length === 0 ? (
                  <div className="table-empty">No rides found.</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Ride ID</th><th>Date</th><th>Pickup</th><th>Dropoff</th>
                        <th>Status</th><th>Fare</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rides.map((r) => (
                        <tr key={r.ride_id}>
                          <td><span className="ride-id-link">R{r.ride_id}</span></td>
                          <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                            {r.createdAt ? new Date(r.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                          </td>
                          <td>{r.pickup_location}</td>
                          <td>{r.dropoff_location}</td>
                          <td><span className={`status-badge status-${r.status}`}>{capWords(r.status)}</span></td>
                          <td>{r.fare ? `$${parseFloat(r.fare).toFixed(2)}` : '—'}</td>
                          <td className="tbl-actions">
                            <button className="tbl-view-btn" onClick={() => openEdit(r)}>Edit</button>
                            <button className="tbl-delete-btn" onClick={() => setDeletingId(r.ride_id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ── DRIVER MANAGEMENT ─────────────────────────────────────── */}
        {/* ════════════════════════════════════════════════════════════ */}
        {adminTab === 'drivers' && (
          <>
            <div className="admin-header">
              <h1 className="admin-title">Driver Management</h1>
              <div className="admin-subtitle">Search, sort and manage all drivers on the platform</div>
            </div>

            <div className="p-card admin-table-card">
              <div className="admin-toolbar">
                <input
                  className="admin-search"
                  type="search"
                  placeholder="Search by name, vehicle, or plate…"
                  value={driverSearch}
                  onChange={(e) => setDriverSearch(e.target.value)}
                />
                <select className="admin-select" value={driverSort} onChange={(e) => setDriverSort(e.target.value)}>
                  {DRIVER_SORT_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div className="table-wrap table-wrap-flush">
                {driverStats.length === 0 ? (
                  <div className="table-empty">Loading driver stats…</div>
                ) : filteredDriverStats.length === 0 ? (
                  <div className="table-empty">No drivers match your search.</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Driver</th><th>Vehicle</th><th>Phone</th><th>Status</th>
                        <th>Rating</th><th>Total Rides</th><th>Completed</th><th>Revenue</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDriverStats.map((d) => (
                        <tr key={d.driver_id}>
                          <td><strong>{d.name}</strong></td>
                          <td>
                            <div>{d.vehicle}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {d.vehicle_color && <span>{d.vehicle_color} · </span>}
                              <span>{d.license_plate}</span>
                            </div>
                          </td>
                          <td>
                            {d.phone_number
                              ? <a href={`tel:${d.phone_number.replace(/\D/g, '')}`} style={{ color: 'var(--magenta)', textDecoration: 'none' }}>{d.phone_number}</a>
                              : '—'}
                          </td>
                          <td><span className={`status-badge status-${d.status}`}>{capWords(d.status)}</span></td>
                          <td>★ {parseFloat(d.rating).toFixed(2)}</td>
                          <td>{d.total_rides}</td>
                          <td>{d.completed_rides}</td>
                          <td><strong>${d.total_revenue.toFixed(2)}</strong></td>
                          <td className="tbl-actions">
                            <button className="tbl-view-btn" onClick={() => openDriverEdit(d)}>Edit</button>
                            <button className="tbl-delete-btn" onClick={() => setDeletingDriverId(d.driver_id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}

      </div>

      {/* ── Edit Ride Modal ──────────────────────────────────────────────── */}
      {showCreate && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Ride</h2>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            {error && <div className="form-error">{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="cr-pickup">Pickup Location</label>
                <input id="cr-pickup" placeholder="e.g. UT Austin, Austin TX" value={form.pickup_location}
                  onChange={(e) => setForm((f) => ({ ...f, pickup_location: e.target.value }))} />
              </div>
              <div className="form-group">
                <label htmlFor="cr-dropoff">Dropoff Location</label>
                <input id="cr-dropoff" placeholder="e.g. Austin-Bergstrom Airport" value={form.dropoff_location}
                  onChange={(e) => setForm((f) => ({ ...f, dropoff_location: e.target.value }))} />
              </div>
              <div className="form-group">
                <label htmlFor="cr-status">Status</label>
                <select id="cr-status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  {['requested','accepted','en_route','in_progress','completed','cancelled'].map((s) => (
                    <option key={s} value={s}>{capWords(s)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="cr-fare">Fare ($)</label>
                <input id="cr-fare" type="number" min="0" step="0.01" placeholder="e.g. 12.50" value={form.fare}
                  onChange={(e) => setForm((f) => ({ ...f, fare: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeModal} disabled={mutating}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={mutating}>
                {mutating ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Driver Edit Modal ────────────────────────────────────────────── */}
      {showDriverEdit && (
        <div className="modal-overlay" onClick={closeDriverModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Driver — {editingDriver?.name}</h2>
              <button className="modal-close" onClick={closeDriverModal}>×</button>
            </div>
            {error && <div className="form-error">{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label>Status</label>
                <select value={driverForm.status} onChange={(e) => setDriverForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="available">Available</option>
                  <option value="on_ride">On Ride</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
              <div className="form-group">
                <label>Rating (1–5)</label>
                <input type="number" min="1" max="5" step="0.01" value={driverForm.rating}
                  onChange={(e) => setDriverForm((f) => ({ ...f, rating: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input value={driverForm.phone_number} placeholder="(512) 555-0000"
                  onChange={(e) => setDriverForm((f) => ({ ...f, phone_number: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Vehicle Model</label>
                <input value={driverForm.vehicle_model} placeholder="Toyota Camry 2023"
                  onChange={(e) => setDriverForm((f) => ({ ...f, vehicle_model: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Vehicle Color</label>
                <input value={driverForm.vehicle_color} placeholder="Pearl White"
                  onChange={(e) => setDriverForm((f) => ({ ...f, vehicle_color: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>License Plate</label>
                <input value={driverForm.license_plate} placeholder="TXS-1234"
                  onChange={(e) => setDriverForm((f) => ({ ...f, license_plate: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeDriverModal} disabled={mutating}>Cancel</button>
              <button className="btn btn-primary" onClick={handleDriverSubmit} disabled={mutating}>
                {mutating ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Driver Delete Confirm ────────────────────────────────────────── */}
      {deletingDriverId && (
        <div className="modal-overlay" onClick={() => setDeletingDriverId(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Remove Driver</h2>
              <button className="modal-close" onClick={() => setDeletingDriverId(null)}>×</button>
            </div>
            <p className="modal-body-text">
              Are you sure you want to remove{' '}
              <strong>{driverStats.find((d) => d.driver_id === deletingDriverId)?.name}</strong>?
              This cannot be undone.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeletingDriverId(null)} disabled={mutating}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDriverDelete(deletingDriverId)} disabled={mutating}>
                {mutating ? 'Removing…' : 'Remove Driver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Ride Confirm ──────────────────────────────────────────── */}
      {deletingId && (
        <div className="modal-overlay" onClick={() => setDeletingId(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Ride</h2>
              <button className="modal-close" onClick={() => setDeletingId(null)}>×</button>
            </div>
            <p className="modal-body-text">
              Are you sure you want to delete ride <strong>R{deletingId}</strong>? This cannot be undone.
            </p>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeletingId(null)} disabled={mutating}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deletingId)} disabled={mutating}>
                {mutating ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
