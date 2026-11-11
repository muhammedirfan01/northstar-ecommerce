// Return user details without sensitive information
export function publicUser(user, apiBaseUrl = "") {
  const profileImage = user.profileImage || "";
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || "",
    profileImage:
      apiBaseUrl && profileImage.startsWith("/profile/photo/")
        ? apiBaseUrl + profileImage
        : profileImage,
    isEmailVerified: user.isEmailVerified,
    isGoogleAccount: Boolean(user.googleId),
    hasPassword: Boolean(user.passwordHash),
  };
}