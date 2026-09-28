const { Driver, Payment, Rider, Ride } = require('../models');

// The ride status machine. Each role can only make the moves listed here.
const NEXT = {
  requested:   ['accepted', 'cancelled'],
  accepted:    ['en_route', 'in_progress', 'completed', 'cancelled'],
  en_route:    ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed:   [],
  cancelled:   [],
};

const CANCELLATION_FEE = 2.0;

class RideError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const randomLastFour = () => String(Math.floor(1000 + Math.random() * 9000));
const isCard = (method) => method === 'credit_card' || method === 'debit_card';

// Charge the rider once: the fare when a ride completes, or a cancellation fee
// when a rider cancels after a driver has already accepted.
const charge = async (ride, amount, kind) => {
  if (!ride.rider_id || amount == null) return null;
  const existing = await Payment.findOne({ where: { ride_id: ride.ride_id, kind } });
  if (existing) return existing;
  const rider = await Rider.findByPk(ride.rider_id);
  const method = rider?.default_payment_method || 'credit_card';
  return Payment.create({
    ride_id: ride.ride_id,
    rider_id: ride.rider_id,
    amount,
    payment_method: method,
    card_last_four: isCard(method) ? randomLastFour() : null,
    status: 'completed',
    kind,
  });
};

// Move a ride to a new status on behalf of `identity` ({ role, rider, driver }).
// Checks who is allowed to make the move, then keeps drivers and payments in sync.
const transition = async (ride, next, identity, { waiveFee = false } = {}) => {
  const { role, rider, driver } = identity;
  const from = ride.status;
  if (from === next) return ride;
  if (!NEXT[from]?.includes(next)) {
    throw new RideError(409, `A ${from.replace('_', ' ')} ride can't be moved to ${next.replace('_', ' ')}.`);
  }

  if (role === 'driver') {
    if (!driver) throw new RideError(403, 'No driver profile is linked to this account.');
    if (next === 'accepted') {
      if (ride.driver_id) throw new RideError(409, 'Another driver already accepted this ride.');
      if (driver.status !== 'available') throw new RideError(409, 'Go Available before accepting rides.');
      const busy = await Ride.findOne({
        where: { driver_id: driver.driver_id, status: ['accepted', 'en_route', 'in_progress'] },
      });
      if (busy) throw new RideError(409, 'Finish your current ride before accepting another.');
      ride.driver_id = driver.driver_id;
    } else if (ride.driver_id !== driver.driver_id) {
      throw new RideError(403, 'You can only update rides assigned to you.');
    }
  } else if (role === 'admin') {
    // admins can move any ride; accepting still needs a driver
    if (next === 'accepted' && !ride.driver_id) throw new RideError(400, 'Assign a driver before accepting this ride.');
  } else {
    // riders may only cancel their own ride
    if (!rider || ride.rider_id !== rider.rider_id) throw new RideError(403, 'Access denied');
    if (next !== 'cancelled') throw new RideError(403, 'Riders can only cancel a ride.');
  }

  const hadDriver = !!ride.driver_id;
  ride.status = next;
  await ride.save();

  const assigned = ride.driver_id ? await Driver.findByPk(ride.driver_id) : null;
  if (next === 'accepted' && assigned) await assigned.update({ status: 'on_ride' });
  if ((next === 'completed' || next === 'cancelled') && assigned && assigned.status === 'on_ride') {
    await assigned.update({ status: 'available' });
  }

  if (next === 'completed') await charge(ride, ride.fare, 'fare');
  // a rider cancelling after a driver accepted pays a small fee, except for safety cancellations
  if (next === 'cancelled' && role !== 'driver' && role !== 'admin' && hadDriver && !waiveFee) {
    await charge(ride, CANCELLATION_FEE, 'cancellation_fee');
  }
  return ride;
};

module.exports = { transition, RideError, CANCELLATION_FEE };
