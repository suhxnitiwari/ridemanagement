// RideFlow ride + payment rules, run against an in-memory Postgres (pg-mem) — no real database or Clerk needed.
// Logins are simulated by setting req.identity, which is what utils/identity.js would resolve from Clerk.
// Run with: npm test
const path = require('path');
const { newDb } = require('pg-mem');
const { Sequelize, DataTypes } = require('sequelize');

// pg-mem can't do DECIMAL(p,s), so money columns are plain numbers in this test only
DataTypes.DECIMAL = () => DataTypes.FLOAT;
const db = newDb();
const sequelize = new Sequelize({ dialect: 'postgres', dialectModule: db.adapters.createPg(), logging: false });
const SERVER = path.join(__dirname, '..');
require.cache[require.resolve(path.join(SERVER, 'config/database.js'))] = { exports: sequelize, loaded: true, id: 'db' };

const { Rider, Driver, Ride, Payment } = require(path.join(SERVER, 'models'));
const rides = require(path.join(SERVER, 'controllers/ridesController'));
const payments = require(path.join(SERVER, 'controllers/paymentsController'));

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log('  ✓', label); } else { fail++; console.log('  ✗', label); } };

const call = (fn, { identity, params = {}, body = {}, query = {} }) => new Promise((resolve) => {
  const req = { identity, params, body, query, auth: { userId: 'x' } };
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(p) { resolve({ status: this.statusCode, body: p }); } };
  fn(req, res);
});

(async () => {
  await sequelize.sync();
  const alice = await Rider.create({ first_name: 'Alice', last_name: 'Ng', email: 'a@x.com', phone_number: '1', default_payment_method: 'debit_card' });
  const bob   = await Rider.create({ first_name: 'Bob',   last_name: 'Li', email: 'b@x.com', phone_number: '2' });
  const dan   = await Driver.create({ first_name: 'Dan', last_name: 'Ro', email: 'd@x.com', phone_number: '3', license_plate: 'AAA1', vehicle_model: 'Civic', status: 'available' });
  const eve   = await Driver.create({ first_name: 'Eve', last_name: 'Su', email: 'e@x.com', phone_number: '4', license_plate: 'BBB2', vehicle_model: 'Prius', status: 'offline' });
  const asAlice = { role: 'rider', rider: alice, driver: null };
  const asBob   = { role: 'rider', rider: bob, driver: null };
  const asDan   = () => ({ role: 'driver', rider: null, driver: dan });
  const asEve   = () => ({ role: 'driver', rider: null, driver: eve });
  const asAdmin = { role: 'admin', rider: null, driver: null };

  console.log('Booking');
  let r = await call(rides.createRide, { identity: asAlice, body: { pickup_location: 'UT Tower', dropoff_location: 'Airport', fare: 24.5, driver_id: 99 } });
  ok(r.status === 201, 'rider can request a ride');
  const rideId = r.body.data.ride_id;
  ok(r.body.data.driver_id === null, 'a rider cannot pick their own driver');
  ok((await Payment.findAll()).length === 0, 'no charge when the ride is requested');
  r = await call(rides.createRide, { identity: asAlice, body: { pickup_location: 'A', dropoff_location: 'B' } });
  ok(r.status === 409, 'cannot request a second ride while one is open');
  r = await call(rides.createRide, { identity: asDan(), body: { pickup_location: 'A', dropoff_location: 'B' } });
  ok(r.status === 403, 'drivers cannot request rides');

  console.log('Visibility');
  r = await call(rides.getAllRides, { identity: asBob });
  ok(r.body.data.length === 0, "a rider can't see someone else's ride");
  r = await call(rides.getAllRides, { identity: asEve(), query: { status: 'requested' } });
  ok(r.body.data.length === 0, 'an offline driver sees no open requests');
  r = await call(rides.getAllRides, { identity: asDan(), query: { status: 'requested' } });
  ok(r.body.data.length === 1, 'an available driver sees the open request');
  ok(r.body.data[0].Rider?.first_name === 'Alice' && r.body.data[0].Rider.rating !== undefined, "requests include the rider's name and rating");

  console.log('Accepting');
  r = await call(rides.updateRide, { identity: asEve(), params: { id: rideId }, body: { status: 'accepted' } });
  ok(r.status === 409, 'an offline driver cannot accept');
  r = await call(rides.updateRide, { identity: asDan(), params: { id: rideId }, body: { status: 'accepted' } });
  ok(r.status === 200 && r.body.data.driver_id === dan.driver_id, 'accepting records which driver took the ride');
  ok(r.body.data.Driver?.vehicle_model === 'Civic', 'the ride now carries driver + vehicle for the rider');
  await dan.reload();
  ok(dan.status === 'on_ride', 'the driver is marked on a ride');
  await eve.update({ status: 'available' });
  r = await call(rides.updateRide, { identity: asEve(), params: { id: rideId }, body: { status: 'completed' } });
  ok(r.status === 403, "another driver can't complete someone else's ride");
  r = await call(rides.updateRide, { identity: asAlice, params: { id: rideId }, body: { status: 'completed' } });
  ok(r.status === 403, 'a rider can only cancel, not complete');

  console.log('Completing');
  r = await call(rides.updateRide, { identity: asDan(), params: { id: rideId }, body: { status: 'in_progress' } });
  ok(r.status === 200 && r.body.data.status === 'in_progress', 'driver marks the rider picked up');
  r = await call(rides.updateRide, { identity: asDan(), params: { id: rideId }, body: { status: 'completed' } });
  ok(r.status === 200, 'driver completes the ride');
  const pays = await Payment.findAll();
  ok(pays.length === 1 && parseFloat(pays[0].amount) === 24.5 && pays[0].kind === 'fare', 'the fare is charged exactly once, on completion');
  ok(pays[0].payment_method === 'debit_card' && /^\d{4}$/.test(pays[0].card_last_four || ''), "it uses the rider's saved payment method");
  await dan.reload();
  ok(dan.status === 'available', 'the driver is available again');
  r = await call(rides.updateRide, { identity: asDan(), params: { id: rideId }, body: { status: 'cancelled' } });
  ok(r.status === 409, 'a completed ride cannot be changed');

  console.log('Cancelling');
  r = await call(rides.createRide, { identity: asAlice, body: { pickup_location: 'C', dropoff_location: 'D', fare: 10 } });
  const r2 = r.body.data.ride_id;
  r = await call(rides.updateRide, { identity: asAlice, params: { id: r2 }, body: { status: 'cancelled' } });
  ok(r.status === 200 && (await Payment.findAll()).length === 1, 'cancelling before a driver accepts is free');
  r = await call(rides.createRide, { identity: asAlice, body: { pickup_location: 'E', dropoff_location: 'F', fare: 12 } });
  const r3 = r.body.data.ride_id;
  await call(rides.updateRide, { identity: asDan(), params: { id: r3 }, body: { status: 'accepted' } });
  r = await call(rides.updateRide, { identity: asAlice, params: { id: r3 }, body: { status: 'cancelled' } });
  const fee = await Payment.findOne({ where: { ride_id: r3 } });
  ok(fee && fee.kind === 'cancellation_fee' && parseFloat(fee.amount) === 2, 'cancelling after acceptance charges the $2 fee');
  r = await call(rides.createRide, { identity: asAlice, body: { pickup_location: 'G', dropoff_location: 'H', fare: 9 } });
  const r4 = r.body.data.ride_id;
  await dan.reload();
  await call(rides.updateRide, { identity: asDan(), params: { id: r4 }, body: { status: 'accepted' } });
  await call(rides.updateRide, { identity: asAlice, params: { id: r4 }, body: { status: 'cancelled', reason: 'safety' } });
  ok(!(await Payment.findOne({ where: { ride_id: r4 } })), 'safety cancellations are always free');

  console.log('Admin');
  r = await call(rides.createRide, { identity: asBob, body: { pickup_location: 'I', dropoff_location: 'J', fare: 15 } });
  const r5 = r.body.data.ride_id;
  r = await call(rides.updateRide, { identity: asAdmin, params: { id: r5 }, body: { driver_id: eve.driver_id, status: 'accepted' } });
  ok(r.status === 200 && r.body.data.driver_id === eve.driver_id, 'admin can assign a driver from Edit Ride');
  r = await call(rides.updateRide, { identity: asAdmin, params: { id: r5 }, body: { status: 'completed' } });
  ok(r.status === 200 && (await Payment.findOne({ where: { ride_id: r5 } })), 'admin completing a ride also bills it');

  console.log('Payments visibility');
  r = await call(payments.getAllPayments, { identity: asAlice });
  ok(r.body.data.length === 2 && r.body.data.every((p) => p.rider_id === alice.rider_id), 'riders only see their own payments');
  ok(r.body.data[0].Ride?.pickup_location && r.body.data[0].Rider?.first_name, 'payments include what a receipt needs');
  await dan.reload(); await eve.reload();
  r = await call(payments.getAllPayments, { identity: asEve() });
  ok(r.body.data.length === 1 && r.body.data[0].ride_id === r5, 'drivers only see payments for rides they drove');
  r = await call(payments.getAllPayments, { identity: asAdmin, query: { status: 'completed' } });
  ok(r.body.data.length === 3, 'admin sees every payment, filterable by status');
  const pid = r.body.data[0].payment_id;
  r = await call(payments.updatePayment, { identity: asAdmin, params: { id: pid }, body: { status: 'refunded' } });
  ok(r.status === 200 && r.body.data.status === 'refunded', 'admin can refund a payment');
  r = await call(payments.getPaymentById, { identity: asBob, params: { id: fee.payment_id } });
  ok(r.status === 404, "a rider can't open someone else's receipt");

  console.log('Rides booked before this update');
  r = await call(rides.createRide, { identity: asBob, body: { pickup_location: 'K', dropoff_location: 'L', fare: 18 } });
  const r6 = r.body.data.ride_id;
  await Payment.create({ ride_id: r6, rider_id: bob.rider_id, amount: 18, status: 'pending' });
  await eve.reload();
  await call(rides.updateRide, { identity: asEve(), params: { id: r6 }, body: { status: 'accepted' } });
  await call(rides.updateRide, { identity: asEve(), params: { id: r6 }, body: { status: 'completed' } });
  const legacy = await Payment.findAll({ where: { ride_id: r6 } });
  ok(legacy.length === 1 && legacy[0].status === 'completed', 'an old booking-time charge is settled, not doubled');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
