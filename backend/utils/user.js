// Return user details without sensitive information
export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || "",
    profileImage: user.profileImage || "",
    isEmailVerified: user.isEmailVerified,
    isGoogleAccount: Boolean(user.googleId),
    hasPassword: Boolean(user.passwordHash),
  };
}