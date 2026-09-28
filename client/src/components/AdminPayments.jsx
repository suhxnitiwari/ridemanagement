import { useState, useEffect, useMemo, useCallback } from 'react';
import { paymentsApi } from '../services/api';
import ReceiptModal from './ReceiptModal';

const STATUS_OPTS = ['all', 'completed', 'pending', 'failed', 'refunded'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const money = (n) => `$${n.toFixed(2)}`;

// Admin → Payments: every charge on the platform, filterable, each opening its receipt,
// where an admin can mark it refunded or failed.
const AdminPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await paymentsApi.getAll(status === 'all' ? {} : { status });
      setPayments(res.data?.data ?? []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((p) =>
      `pay-${p.payment_id}`.includes(q) ||
      `r${p.ride_id}` === q ||
      `${p.Rider?.first_name ?? ''} ${p.Rider?.last_name ?? ''}`.toLowerCase().includes(q));
  }, [payments, search]);

  const totals = useMemo(() => {
    const sum = (st) => payments.filter((p) => p.status === st).reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    return { collected: sum('completed'), refunded: sum('refunded'), failed: payments.filter((p) => p.status === 'failed').length };
  }, [payments]);

  const setPaymentStatus = async (next) => {
    if (!open) return;
    setSaving(true);
    setError('');
    try {
      const res = await paymentsApi.update(open.payment_id, { status: next });
      const updated = res.data.data;
      setPayments((prev) => prev.map((p) => (p.payment_id === updated.payment_id ? updated : p)));
      setOpen(updated);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update this payment.');
    } finally {
      setSaving(false);
    }
  };

  const actions = open && (
    <>
      {open.status !== 'refunded' && (
        <button className="btn btn-ghost" disabled={saving} onClick={() => setPaymentStatus('refunded')}>
          {saving ? 'Saving…' : 'Mark refunded'}
        </button>
      )}
      {open.status === 'completed' && (
        <button className="btn btn-ghost" disabled={saving} onClick={() => setPaymentStatus('failed')}>Mark failed</button>
      )}
      {open.status !== 'completed' && (
        <button className="btn btn-ghost" disabled={saving} onClick={() => setPaymentStatus('completed')}>Mark paid</button>
      )}
    </>
  );

  return (
    <>
      <div className="admin-header">
        <h1 className="admin-title">Payments</h1>
        <div className="admin-subtitle">Every charge on the platform. Fares are billed automatically when a ride completes.</div>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">Collected</div><div className="stat-value">{loading ? '…' : money(totals.collected)}</div></div>
        <div className="stat-card"><div className="stat-label">Refunded</div><div className="stat-value">{loading ? '…' : money(totals.refunded)}</div></div>
        <div className="stat-card"><div className="stat-label">Failed payments</div><div className="stat-value">{loading ? '…' : totals.failed}</div></div>
      </div>

      {error && <div className="inline-alert" role="alert">{error}</div>}

      <div className="toolbar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input className="search-input" type="search" placeholder="Search PAY-12, R40 or a rider’s name…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          {STATUS_OPTS.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : cap(s)}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="table-empty">Loading payments…</div>
        ) : shown.length === 0 ? (
          <div className="table-empty">No payments match.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Payment</th><th>Date</th><th>Rider</th><th>Ride</th><th>For</th><th>Amount</th><th>Status</th></tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.payment_id} className="row-clickable" tabIndex={0}
                  onClick={() => setOpen(p)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(p); } }}
                  aria-label={`Open receipt PAY-${p.payment_id}`}>
                  <td><span className="ride-id-link">PAY-{p.payment_id}</span></td>
                  <td className="td-date">{new Date(p.created_at || p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td>{p.Rider ? `${p.Rider.first_name} ${p.Rider.last_name}` : '—'}</td>
                  <td>R{p.ride_id}</td>
                  <td>{p.kind === 'cancellation_fee' ? 'Cancellation fee' : 'Ride fare'}</td>
                  <td><strong>${parseFloat(p.amount).toFixed(2)}</strong></td>
                  <td><span className={`status-badge status-${p.status}`}>{cap(p.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ReceiptModal payment={open} onClose={() => setOpen(null)} actions={actions} />
    </>
  );
};

export default AdminPayments;
