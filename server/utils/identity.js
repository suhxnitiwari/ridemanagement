const { clerkClient } = require('@clerk/express');
const { Rider, Driver } = require('../models');

// Who is making this request? Returns { role, rider, driver }.
// role comes from Clerk (never from the request body); rider/driver are the matching
// database rows, linked by clerk_user_id with a one-time email fallback.
const getIdentity = async (req) => {
  if (req.identity) return req.identity;
  const userId = req.auth?.userId;
  let role = null;
  let email = null;
  try {
    const user = await clerkClient.users.getUser(userId);
    role = user.publicMetadata?.role ?? null;
    email = user.emailAddresses?.[0]?.emailAddress ?? null;
  } catch {}

  if (role === 'manager') role = 'admin';

  const link = async (Model) => {
    let row = await Model.findOne({ where: { clerk_user_id: userId } });
    if (!row && email) {
      row = await Model.findOne({ where: { email } });
      if (row && !row.clerk_user_id) await row.update({ clerk_user_id: userId });
    }
    return row;
  };

  const identity = {
    userId,
    role,
    // anyone who isn't staff is treated as a rider (older accounts may not have a role saved yet)
    rider: role !== 'admin' && role !== 'driver' ? await link(Rider) : null,
    driver: role === 'driver' ? await link(Driver) : null,
  };
  req.identity = identity;
  return identity;
};

module.exports = { getIdentity };
