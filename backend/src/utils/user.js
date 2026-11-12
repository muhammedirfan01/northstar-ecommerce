// user details that sent to the frontend
export function formatUser(user, apiBaseUrl = "") {
  let profileImage = user.profileImage || "";

  // Older photos use a backend path. Add the API address when provided.
  if (apiBaseUrl && profileImage.startsWith("/profile/photo/")) {
    profileImage = apiBaseUrl + profileImage;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || "",
    profileImage: profileImage,
    isEmailVerified: user.isEmailVerified,
    isGoogleAccount: Boolean(user.googleId),
    hasPassword: Boolean(user.passwordHash),
  };
}
