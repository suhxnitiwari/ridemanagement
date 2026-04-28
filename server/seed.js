/**
 * seed.js — Full reset with realistic, interleaved ride data.
 * Run: node seed.js
 *
 * Produces ~60 rides spread over 90 days where:
 *  - ~74% are completed (most rides succeed)
 *  - ~14% are cancelled (blended throughout, never more than 2 in a row)
 *  - A handful are active: requested / accepted / en_route / in_progress
 *  - Every ride has a fare estimate
 *  - Every completed ride has a matching payment record
 *  - Dates are realistic (6 am – 11 pm, spread across 90 days)
 */

require('dotenv').config();
const sequelize = require('./config/database');
const Rider   = require('./models/Rider');
const Driver  = require('./models/Driver');
const Ride    = require('./models/Ride');
const Payment = require('./models/Payment');

// ── Static data ───────────────────────────────────────────────────────────────

const riderData = [
  // ── Clerk test accounts (login with these) ────────────────────────────────
  { first_name: 'Rider',   last_name: 'Test',      email: 'rider+clerk_test@example.com',    phone_number: '(555) 100-2000', default_payment_method: 'credit_card', rating: 4.70, preferred_temp: 'cool', preferred_music: 'low',          preferred_conversation: 'quiet'  },
  { first_name: 'Clint',   last_name: 'Tuttle',    email: 'clint.tuttle@gmail.com',          phone_number: '(512) 471-3434', default_payment_method: 'credit_card', rating: 5.00, preferred_temp: 'any',  preferred_music: 'riders_choice', preferred_conversation: 'any'    },
  { first_name: 'Suhani',  last_name: 'Tiwari',    email: 'suhanitiwari@utexas.edu',         phone_number: '(512) 555-0100', default_payment_method: 'apple_pay',   rating: 4.90, preferred_temp: 'cool', preferred_music: 'low',          preferred_conversation: 'quiet'  },
  { first_name: 'Suhani',  last_name: 'Tiwari',    email: 'suhxnitiwari@gmail.com',          phone_number: '(512) 555-0199', default_payment_method: 'apple_pay',   rating: 4.90, preferred_temp: 'cool', preferred_music: 'low',          preferred_conversation: 'quiet'  },
  { first_name: 'Manager', last_name: 'Test',      email: 'testuser+clerk_test@example.com', phone_number: '(555) 300-4000', default_payment_method: 'credit_card', rating: 4.80, preferred_temp: 'warm', preferred_music: 'riders_choice', preferred_conversation: 'chatty' },
  // ── Sample riders for realistic volume ────────────────────────────────────
  { first_name: 'Ava',    last_name: 'Patel',     email: 'ava.patel@utexas.edu',       phone_number: '(512) 555-0101', default_payment_method: 'apple_pay',   rating: 4.90, preferred_temp: 'cool', preferred_music: 'low',          preferred_conversation: 'quiet'  },
  { first_name: 'Noah',   last_name: 'Kim',        email: 'noah.kim@gmail.com',          phone_number: '(512) 555-0102', default_payment_method: 'credit_card', rating: 4.75, preferred_temp: 'any',  preferred_music: 'riders_choice', preferred_conversation: 'any'    },
  { first_name: 'Emma',   last_name: 'Diaz',       email: 'emma.diaz@yahoo.com',         phone_number: '(512) 555-0103', default_payment_method: 'debit_card',  rating: 4.60, preferred_temp: 'warm', preferred_music: 'off',          preferred_conversation: 'quiet'  },
  { first_name: 'James',  last_name: 'Wu',         email: 'james.wu@outlook.com',        phone_number: '(512) 555-0104', default_payment_method: 'google_pay',  rating: 4.85, preferred_temp: 'cool', preferred_music: 'riders_choice', preferred_conversation: 'chatty' },
  { first_name: 'Sofia',  last_name: 'Rodriguez',  email: 'sofia.r@utexas.edu',          phone_number: '(512) 555-0105', default_payment_method: 'paypal',      rating: 4.70, preferred_temp: 'any',  preferred_music: 'low',          preferred_conversation: 'any'    },
  { first_name: 'Lena',   last_name: 'Park',       email: 'lena.park@gmail.com',         phone_number: '(512) 555-0106', default_payment_method: 'credit_card', rating: 4.95, preferred_temp: 'cool', preferred_music: 'off',          preferred_conversation: 'quiet'  },
  { first_name: 'Marcus', last_name: 'Johnson',    email: 'marcus.j@hotmail.com',        phone_number: '(512) 555-0107', default_payment_method: 'apple_pay',   rating: 4.50, preferred_temp: 'warm', preferred_music: 'riders_choice', preferred_conversation: 'chatty' },
  { first_name: 'Priya',  last_name: 'Shah',       email: 'priya.shah@gmail.com',        phone_number: '(512) 555-0108', default_payment_method: 'credit_card', rating: 4.80, preferred_temp: 'any',  preferred_music: 'low',          preferred_conversation: 'any'    },
  { first_name: 'Tyler',  last_name: 'Brooks',     email: 'tyler.brooks@utexas.edu',     phone_number: '(512) 555-0109', default_payment_method: 'debit_card',  rating: 4.65, preferred_temp: 'cool', preferred_music: 'riders_choice', preferred_conversation: 'quiet'  },
  { first_name: 'Zoe',    last_name: 'Martinez',   email: 'zoe.martinez@gmail.com',      phone_number: '(512) 555-0110', default_payment_method: 'google_pay',  rating: 4.88, preferred_temp: 'warm', preferred_music: 'off',          preferred_conversation: 'chatty' },
];

const driverData = [
  // ── Clerk test account ────────────────────────────────────────────────────
  { first_name: 'Driver',  last_name: 'Test',     email: 'driver+clerk_test@example.com', phone_number: '(555) 200-3000', license_plate: 'TXB-9922', vehicle_model: 'Toyota Camry 2023', status: 'available', rating: 4.80 },
  { first_name: 'Marcus',  last_name: 'Lee',      email: 'marcus.lee@rideflow.app',    phone_number: '(512) 555-0201', license_plate: 'TXA-4821', vehicle_model: 'Toyota Camry',   status: 'on_ride',   rating: 4.90 },
  { first_name: 'Priya',   last_name: 'Nair',     email: 'priya.nair@rideflow.app',    phone_number: '(512) 555-0202', license_plate: 'TXB-2234', vehicle_model: 'Honda Accord',   status: 'available', rating: 4.80 },
  { first_name: 'Jordan',  last_name: 'Hall',     email: 'jordan.hall@rideflow.app',   phone_number: '(512) 555-0203', license_plate: 'TXC-9910', vehicle_model: 'Ford Fusion',    status: 'available', rating: 4.70 },
  { first_name: 'Chris',   last_name: 'Obi',      email: 'chris.obi@rideflow.app',     phone_number: '(512) 555-0204', license_plate: 'TXD-6678', vehicle_model: 'Chevy Malibu',   status: 'offline',   rating: 4.60 },
  { first_name: 'Yara',    last_name: 'Gonzalez', email: 'yara.g@rideflow.app',        phone_number: '(512) 555-0205', license_plate: 'TXE-3312', vehicle_model: 'Nissan Altima',  status: 'available', rating: 4.85 },
  { first_name: 'Damon',   last_name: 'Rivers',   email: 'damon.rivers@rideflow.app',  phone_number: '(512) 555-0206', license_plate: 'TXF-7743', vehicle_model: 'Hyundai Sonata', status: 'available', rating: 4.75 },
  { first_name: 'Aisha',   last_name: 'Monroe',   email: 'aisha.monroe@rideflow.app',  phone_number: '(512) 555-0207', license_plate: 'TXG-1195', vehicle_model: 'Kia Optima',     status: 'on_ride',   rating: 4.95 },
  { first_name: 'Ben',     last_name: 'Carter',   email: 'ben.carter@rideflow.app',    phone_number: '(512) 555-0208', license_plate: 'TXH-8856', vehicle_model: 'Toyota Corolla', status: 'offline',   rating: 4.55 },
  { first_name: 'Layla',   last_name: 'Hassan',   email: 'layla.hassan@rideflow.app',  phone_number: '(512) 555-0209', license_plate: 'TXI-3370', vehicle_model: 'Honda Civic',    status: 'available', rating: 4.78 },
  { first_name: 'Derek',   last_name: 'Nguyen',   email: 'derek.nguyen@rideflow.app',  phone_number: '(512) 555-0210', license_plate: 'TXJ-6612', vehicle_model: 'Mazda CX-5',     status: 'available', rating: 4.83 },
];

const pickups = [
  'UT Austin — Jester Hall',     'Downtown Austin — 6th St',     'Zilker Park',
  'Austin-Bergstrom Airport',    'East 6th St',                  'Barton Springs Rd',
  'The Domain — Whole Foods',    'Rainey Street',                'South Lamar Blvd',
  'West 6th St',                 'Congress Ave Bridge',          'Hyde Park',
  'Barton Creek Square Mall',    'North Lamar Blvd',             'Mueller Neighborhood',
  'Cedar Park — 183A Tollway',   'Round Rock — IKEA',            'South Congress Ave',
  'UT Austin — PCL Library',     'Pflugerville — Wells Branch',
];

const dropoffs = [
  'Austin-Bergstrom Airport',    'South Congress Ave',           'West Campus — UT Austin',
  'Downtown Austin Hotel',       'South Austin — Manchaca Rd',   'Mueller Neighborhood',
  'North Loop Blvd',             'UT Austin — PCL Library',      'Downtown Austin',
  'Pflugerville — Wells Branch', 'East Cesar Chavez St',         'Austin Community College',
  'Round Rock — IKEA',           'East Austin',                  'South Lamar Blvd',
  'The Domain',                  'Buda — Main St',               'Kyle — Marketplace Dr',
  'Georgetown — Wolf Ranch',     'Q2 Stadium',
];

const PAYMENT_METHODS = ['credit_card', 'debit_card', 'apple_pay', 'google_pay', 'paypal'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Random date `daysAgo` days in the past between 6 am and 11 pm. */
const makeDate = (daysAgo, hourSeed = null) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hourSeed ?? (6 + Math.floor(Math.random() * 17)));
  d.setMinutes(Math.floor(Math.random() * 60));
  d.setSeconds(Math.floor(Math.random() * 60));
  d.setMilliseconds(0);
  return d;
};

/** Fare between $6 and $44 — realistic Austin short-to-medium trips. */
const makeFare = () => parseFloat((6 + Math.random() * 38).toFixed(2));

/**
 * Generates a flat list of statuses (length = count) with guaranteed
 * distribution: ~86% completed, ~14% cancelled for historical rides,
 * plus a realistic active tail.  No more than 2 consecutive same status.
 */
const buildStatusList = (count, activeTail = 8) => {
  const histCount    = count - activeTail;
  const cancelCount  = Math.round(histCount * 0.14);   // guaranteed ~14%
  const completeCount = histCount - cancelCount;

  // Build exact counts, then shuffle
  const pool = [
    ...Array(completeCount).fill('completed'),
    ...Array(cancelCount).fill('cancelled'),
  ];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Break up any 3-in-a-row clusters by swapping with a non-matching neighbour
  for (let i = 2; i < pool.length; i++) {
    if (pool[i] === pool[i - 1] && pool[i] === pool[i - 2]) {
      // Find the next different element and swap
      for (let j = i + 1; j < pool.length; j++) {
        if (pool[j] !== pool[i]) {
          [pool[i], pool[j]] = [pool[j], pool[i]];
          break;
        }
      }
    }
  }

  // Active tail: realistic live-queue snapshot (oldest → newest)
  const activeTail_ = [
    'completed', 'in_progress', 'en_route', 'accepted',
    'requested', 'completed', 'in_progress', 'completed',
  ].slice(0, activeTail);

  return [...pool, ...activeTail_];
};

// ── Seed ─────────────────────────────────────────────────────────────────────

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');
    await sequelize.sync({ alter: true });
    console.log('✅ Tables synced\n');

    // ── Riders ────────────────────────────────────────────────────────────────
    console.log('Seeding riders…');
    const riders = [];
    for (const r of riderData) {
      const [rec, created] = await Rider.findOrCreate({ where: { email: r.email }, defaults: r });
      if (!created) {
        await rec.update({
          phone_number:           r.phone_number,
          default_payment_method: r.default_payment_method,
          rating:                 r.rating,
          preferred_temp:         r.preferred_temp        ?? null,
          preferred_music:        r.preferred_music       ?? null,
          preferred_conversation: r.preferred_conversation ?? null,
        });
      }
      riders.push(rec);
      console.log(`  ↳ ${rec.first_name} ${rec.last_name} (${created ? 'created' : 'updated'})`);
    }

    // ── Drivers ───────────────────────────────────────────────────────────────
    console.log('\nSeeding drivers…');
    const drivers = [];
    for (const d of driverData) {
      const [rec] = await Driver.findOrCreate({ where: { email: d.email }, defaults: d });
      drivers.push(rec);
      console.log(`  ↳ ${rec.first_name} ${rec.last_name}`);
    }

    // ── Wipe existing rides + payments ────────────────────────────────────────
    console.log('\nClearing rides and payments…');
    await Payment.destroy({ where: {} });
    await Ride.destroy({ where: {} });

    // ── Build ride rows: 60 rides spread over 90 days ─────────────────────────
    const TOTAL = 60;
    const ACTIVE_TAIL = 8;
    const statuses = buildStatusList(TOTAL, ACTIVE_TAIL);

    // Dates: oldest first (so ride_id order = chronological order)
    // Rides 0..51 → 89 days ago .. 3 days ago (spaced ~1.7 days apart)
    // Rides 52..59 → today (active)
    const rideRows = statuses.map((status, i) => {
      const isActive = i >= TOTAL - ACTIVE_TAIL;
      let daysAgo;
      if (isActive) {
        daysAgo = Math.max(0, ACTIVE_TAIL - 1 - (i - (TOTAL - ACTIVE_TAIL)));
      } else {
        // Spread 0..TOTAL-ACTIVE_TAIL-1 across 89..3 days
        const span = 86; // days from oldest to 3 days ago
        daysAgo = Math.round(89 - (span * i / (TOTAL - ACTIVE_TAIL - 1)));
      }

      const riderIdx  = i % riders.length;
      const driverIdx = i % drivers.length;
      const pickupIdx  = i % pickups.length;
      const dropoffIdx = (i + 7) % dropoffs.length;

      return {
        rider_id:         riders[riderIdx].rider_id,
        driver_id:        status === 'requested' || status === 'cancelled'
                            ? null
                            : drivers[driverIdx].driver_id,
        pickup_location:  pickups[pickupIdx],
        dropoff_location: dropoffs[dropoffIdx],
        status,
        fare:             makeFare(),  // always set — even cancelled had an estimate
        createdAt:        makeDate(daysAgo),
      };
    });

    // ── Insert rides ──────────────────────────────────────────────────────────
    console.log(`\nInserting ${TOTAL} rides…`);
    const createdRides = [];
    for (const row of rideRows) {
      const ride = await Ride.create(row);
      createdRides.push(ride);
    }

    // ── Status breakdown ──────────────────────────────────────────────────────
    const breakdown = {};
    createdRides.forEach(({ status }) => { breakdown[status] = (breakdown[status] || 0) + 1; });
    console.log('  Status mix:');
    Object.entries(breakdown)
      .sort(([, a], [, b]) => b - a)
      .forEach(([s, n]) => console.log(`    ${s.padEnd(12)} ${n}`));

    // ── Payments for completed rides ──────────────────────────────────────────
    console.log('\nInserting payments for completed rides…');
    const completed = createdRides.filter((r) => r.status === 'completed');
    for (let i = 0; i < completed.length; i++) {
      const ride = completed[i];
      // Payment arrives ~15–40 min after ride creation
      const payDate = new Date(new Date(ride.createdAt).getTime() + (15 + Math.floor(Math.random() * 25)) * 60 * 1000);
      await Payment.create({
        ride_id:        ride.ride_id,
        rider_id:       ride.rider_id,
        amount:         parseFloat(ride.fare),
        payment_method: PAYMENT_METHODS[i % PAYMENT_METHODS.length],
        status:         'completed',
        createdAt:      payDate,
      });
    }
    console.log(`  ↳ ${completed.length} payment records`);

    console.log('\n✅ Seed complete — 60 rides, realistic mix, proper dates.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    console.error(err);
    process.exit(1);
  }
};

seed();
