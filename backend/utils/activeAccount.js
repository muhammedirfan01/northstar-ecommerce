export function activeAccountFilter(id, email, version = 0) {
  const filter = {
    _id: id,
    isBlocked: false,
    deletedAt: null,
    isEmailVerified: true,
  };
  if (email) {
    filter.email = email;
  }
  if (version > 0) {
    filter.authVersion = version;
  } else {
    filter.$or = [
      {
        authVersion: 0,
      },
      {
        authVersion: {
          $exists: false,
        },
      },
    ];
  }
  return filter;
}
