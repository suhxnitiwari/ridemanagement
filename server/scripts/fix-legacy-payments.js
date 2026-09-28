// One-time cleanup for payments created before "bill on completion".
// The old app charged at booking (a 'pending' payment) and added $2 fees from the browser.
//
//   node scripts/fix-legacy-payments.js           → shows what would change (changes nothing)
//   node scripts/fix-legacy-payments.js --apply   → makes the changes
//
// What it does:
//   1. pending payment + ride completed  → mark completed (the fare was earned)
//   2. pending payment + ride cancelled  → mark failed (the ride never happened, so it was never collected)
//   3. $2.00 charge on a cancelled ride  → label it a cancellation fee
// Pending payments for rides still in progress are left alone; they settle when the ride completes.
require('dotenv').config();
const sequelize = require('../config/database');
const { Payment, Ride } = require('../models');

const apply = process.argv.includes('--apply');

(async () => {
  await sequelize.sync({ alter: true }); // adds the new `kind` column if the server hasn't yet
  const payments = await Payment.findAll({ include: [{ model: Ride, attributes: ['ride_id', 'status', 'fare'] }] });

  const plan = [];
  for (const p of payments) {
    const rideStatus = p.Ride?.status;
    if (p.status === 'pending' && rideStatus === 'completed') plan.push([p, { status: 'completed' }, 'settle fare for a completed ride']);
    else if (p.status === 'pending' && rideStatus === 'cancelled') plan.push([p, { status: 'failed' }, 'void booking charge on a cancelled ride']);
    else if (p.kind !== 'cancellation_fee' && rideStatus === 'cancelled' && parseFloat(p.amount) === 2) {
      plan.push([p, { kind: 'cancellation_fee' }, 'label $2 cancellation fee']);
    }
  }

  if (!plan.length) {
    console.log('Nothing to fix.');
  } else {
    for (const [p, change, why] of plan) {
      console.log(`${apply ? 'Updating' : 'Would update'} PAY-${p.payment_id} (ride R${p.ride_id}): ${why} →`, change);
      if (apply) await p.update(change);
    }
    console.log(`\n${plan.length} payment(s) ${apply ? 'updated' : 'would be updated. Run again with --apply to make these changes.'}`);
  }
  await sequelize.close();
})().catch((err) => { console.error(err); process.exit(1); });
