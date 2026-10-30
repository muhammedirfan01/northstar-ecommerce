// Match the same verified account while saving a change.
export function activeAccountFilter(id, email, version = 0) {
  const filter = { _id: id, isBlocked: false, deletedAt: null, isEmailVerified: true };
  if (email) filter.email = email;
  if (version === 0) {
    // Older accounts may not have this field yet.
    filter.$or = [{ authVersion: 0 }, { authVersion: { $exists: false } }];
  } else {
    filter.authVersion = version;
  }
  return filter;
}
