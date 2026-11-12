export function getActiveUserFilter(userId, email, expectedLoginVersion = 0) {
  const filter = {
    _id: userId,
    isBlocked: false,
    deletedAt: null,
    isEmailVerified: true,
  };

  if (email) {
    filter.email = email;
  }

  if (expectedLoginVersion > 0) {
    filter.authVersion = expectedLoginVersion;
  } else {
    filter.$or = [
      { authVersion: 0 },
      { authVersion: { $exists: false } },
    ];
  }

  return filter;
}
