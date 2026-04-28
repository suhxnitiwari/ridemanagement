import { useState, useEffect, useCallback } from 'react';
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

const EMPTY_FORM = {
  pickup_location: '',
  dropoff_location: '',
  status: 'requested',
  fare: '',
};

const AdminPage = ({ theme, onThemeToggle }) => {
  const [rides,        setRides]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setFilter]       = useState('all');
  const [showCreate,   setShowCreate]   = useState(false); // edit only
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [mutating,     setMutating]     = useState(false);
  const [editingRide,  setEditingRide]  = useState(null);
  const [deletingId,   setDeletingId]   = useState(null);
  const [error,        setError]        = useState('');
  const [driverStats,  setDriverStats]  = useState([]);

  useEffect(() => {
    driversApi.getStats().then((res) => setDriverStats(res.data.data)).catch(() => {});
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchRides = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter === 'active') params.statuses = ACTIVE_STATUSES.join(',');
      else if (statusFilter !== 'all') params.status = statusFilter;
      if (search.trim())          params.search = search.trim();
      const res = await ridesApi.getAll(params);
      setRides(res.data.data);
    } catch (err) {
      setError('Failed to load rides: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    const t = setTimeout(fetchRides, 300);
    return () => clearTimeout(t);
  }, [fetchRides]);

  // ── Create / Edit submit ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.pickup_location.trim() || !form.dropoff_location.trim()) {
      setError('Pickup and dropoff locations are required.');
      return;
    }
    if (form.fare !== '' && parseFloat(form.fare) < 0) {
      setError('Fare cannot be negative.');
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

  // ── Delete ─────────────────────────────────────────────────────────────────
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
    setForm({
      pickup_location:  ride.pickup_location,
      dropoff_location: ride.dropoff_location,
      status:           ride.status,
      fare:             ride.fare ?? '',
    });
    setError('');
    setShowCreate(true);
  };

  const closeModal = () => {
    setShowCreate(false);
    setEditingRide(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalRevenue = rides
    .filter((r) => r.status === 'completed' && r.fare)
    .reduce((sum, r) => sum + parseFloat(r.fare), 0)
    .toFixed(2);

  const openRequests  = rides.filter((r) => r.status === 'requested').length;
  const inProgress    = rides.filter((r) => r.status === 'in_progress').length;
  const completed     = rides.filter((r) => r.status === 'completed').length;

  const extraPill = (
    <div className="live-pill">
      <span className="live-pill-dot" />
      Live
    </div>
  );

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
    <div className="portal-shell">
      <PortalNavbar
        role="Admin"
        theme={theme}
        onThemeToggle={onThemeToggle}
        userInitials={userInitials}
        userName={userName}
        extraPill={extraPill}
      />

      <div className="admin-page">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="admin-header">
          <h1 className="admin-title">Dashboard</h1>
          <div className="admin-subtitle">Real-time platform overview</div>
        </div>

        {/* ── Stats row ───────────────────────────────────────────── */}
        <div className="admin-stats-row">
          <div className="admin-stat-card">
            <div className="admin-stat-label">Total Rides</div>
            <div className="admin-stat-value">{loading ? '…' : rides.length}</div>
            <div className="admin-stat-sub">in database</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">Open Requests</div>
            <div className="admin-stat-value warning">{loading ? '…' : openRequests}</div>
            <div className="admin-stat-sub">awaiting driver</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">In Progress</div>
            <div className="admin-stat-value">{loading ? '…' : inProgress}</div>
            <div className="admin-stat-sub">active rides</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">Total Revenue</div>
            <div className="admin-stat-value magenta">{loading ? '…' : `$${totalRevenue}`}</div>
            <div className="admin-stat-sub">{completed} completed rides</div>
          </div>
        </div>

        {/* ── Ride Management ─────────────────────────────────────── */}
        <div className="ride-mgmt-header">
          <h2 className="ride-mgmt-title">Ride Management</h2>
        </div>

        {/* Toolbar */}
        <div className="admin-toolbar">
          <input
            id="admin-search"
            className="admin-search"
            type="search"
            placeholder="Search by pickup or dropoff location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="admin-select"
            value={statusFilter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {STATUS_OPTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Rides table */}
        <div className="table-wrap">
          {loading ? (
            <div className="table-empty">Loading rides…</div>
          ) : rides.length === 0 ? (
            <div className="table-empty">No rides found.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Ride ID</th>
                  <th>Date</th>
                  <th>Pickup</th>
                  <th>Dropoff</th>
                  <th>Status</th>
                  <th>Fare</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rides.map((r) => (
                  <tr key={r.ride_id}>
                    <td><span className="ride-id-link">R{r.ride_id}</span></td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {r.createdAt
                        ? new Date(r.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td>{r.pickup_location}</td>
                    <td>{r.dropoff_location}</td>
                    <td>
                      <span className={`status-badge status-${r.status}`}>
                        {capWords(r.status)}
                      </span>
                    </td>
                    <td>{r.fare ? `$${parseFloat(r.fare).toFixed(2)}` : '—'}</td>
                    <td className="tbl-actions">
                      <button className="tbl-view-btn" onClick={() => openEdit(r)}>Edit</button>
                      <button
                        className="tbl-delete-btn"
                        onClick={() => setDeletingId(r.ride_id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Driver Performance ─────────────────────────────────────── */}
        <div className="admin-section-gap">
          <div className="ride-mgmt-header">
            <h2 className="ride-mgmt-title">Driver Performance</h2>
          </div>
          <div className="table-wrap">
            {driverStats.length === 0 ? (
              <div className="table-empty">Loading driver stats…</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Vehicle</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Rating</th>
                    <th>Total Rides</th>
                    <th>Completed</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {driverStats.map((d) => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────── */}
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
                <input
                  id="cr-pickup"
                  placeholder="e.g. UT Austin, Austin TX"
                  value={form.pickup_location}
                  onChange={(e) => setForm((f) => ({ ...f, pickup_location: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="cr-dropoff">Dropoff Location</label>
                <input
                  id="cr-dropoff"
                  placeholder="e.g. Austin-Bergstrom Airport"
                  value={form.dropoff_location}
                  onChange={(e) => setForm((f) => ({ ...f, dropoff_location: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="cr-status">Status</label>
                <select
                  id="cr-status"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {['requested','accepted','en_route','in_progress','completed','cancelled'].map((s) => (
                    <option key={s} value={s}>{capWords(s)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="cr-fare">Fare ($)</label>
                <input
                  id="cr-fare"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 12.50"
                  value={form.fare}
                  onChange={(e) => setForm((f) => ({ ...f, fare: e.target.value }))}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeModal} disabled={mutating}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={mutating}>
                {mutating ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ────────────────────────────────────── */}
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
              <button className="btn btn-ghost" onClick={() => setDeletingId(null)} disabled={mutating}>
                Cancel
              </button>
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
