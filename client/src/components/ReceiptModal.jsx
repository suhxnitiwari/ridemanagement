const METHOD_LABELS = {
  credit_card: 'Credit card',
  debit_card: 'Debit card',
  paypal: 'PayPal',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
};

const money = (n) => `$${parseFloat(n || 0).toFixed(2)}`;
const when = (d) => (d ? new Date(d).toLocaleString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
}) : '—');

// One payment as a printable receipt. `payment` comes from /api/payments with its Ride, Rider and Driver attached.
const ReceiptModal = ({ payment, onClose, actions = null }) => {
  if (!payment) return null;
  const ride = payment.Ride;
  const driver = ride?.Driver;
  const rider = payment.Rider;
  const method = METHOD_LABELS[payment.payment_method] || payment.payment_method;
  const isFee = payment.kind === 'cancellation_fee';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal receipt" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="receipt-title">
        <div className="modal-header">
          <h2 id="receipt-title">Receipt</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="receipt-body">
          <div className="receipt-brand">
            <span className="receipt-logo">RideFlow</span>
            <span className={`receipt-status receipt-status-${payment.status}`}>{payment.status}</span>
          </div>
          <div className="receipt-total">{money(payment.amount)}</div>
          <div className="receipt-sub">{isFee ? 'Cancellation fee' : 'Ride fare'} · PAY-{payment.payment_id} · {when(payment.created_at || payment.createdAt)}</div>

          {ride && (
            <div className="receipt-route">
              <div><span className="receipt-dot receipt-dot-pickup" />{ride.pickup_location}</div>
              <div><span className="receipt-dot receipt-dot-dropoff" />{ride.dropoff_location}</div>
            </div>
          )}

          <dl className="receipt-lines">
            <div><dt>Ride</dt><dd>R{payment.ride_id}</dd></div>
            {rider && <div><dt>Rider</dt><dd>{rider.first_name} {rider.last_name}</dd></div>}
            {driver && (
              <div>
                <dt>Driver</dt>
                <dd>{driver.first_name} {driver.last_name?.[0]}. · {[driver.vehicle_color, driver.vehicle_model].filter(Boolean).join(' ')} · {driver.license_plate}</dd>
              </div>
            )}
            <div><dt>Paid with</dt><dd>{method}{payment.card_last_four ? ` •••• ${payment.card_last_four}` : ''}</dd></div>
            <div className="receipt-line-total"><dt>Total</dt><dd>{money(payment.amount)}</dd></div>
          </dl>
        </div>

        <div className="modal-footer receipt-footer">
          {actions}
          <button className="btn btn-ghost" onClick={() => window.print()}>Print</button>
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
