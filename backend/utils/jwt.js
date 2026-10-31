import jwt from "jsonwebtoken";
import {
  AUTH_COOKIE_NAME,
  AUTH_LIFETIME_MS,
  getJwtSecret,
  authCookieOptions,
} from "../config/jwt.js";
export function createToken(user) {
  return jwt.sign(
    {
      //payload
      userId: user.id,
      role: user.role,
      authVersion: user.authVersion ?? 0,
    },
    getJwtSecret(), //secretkey
    {
      expiresIn: Math.floor(AUTH_LIFETIME_MS / 1000), // token lifetime in seconds
    },
  );
}
// Store JWT in cookie
export function issueAuthCookie(res, user) {
  const token = createToken(user);

  res.cookie(AUTH_COOKIE_NAME, token, {
    //res.cookie(name, value, options);
    ...authCookieOptions(),
    maxAge: AUTH_LIFETIME_MS,
  });
}
// Read and verify JWT
export function readToken(req) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
}
// Clear JWT cookie
export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());
}
