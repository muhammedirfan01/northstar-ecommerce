// Create login tokens, check them, and manage the login cookie.

import jwt from "jsonwebtoken";
import {
  AUTH_COOKIE_NAME,
  AUTH_LIFETIME_MS,
  getJwtSecret,
  authCookieOptions,
} from "../config/jwt.js";

export function createLoginToken(user) {
  let loginVersion = user.authVersion;
  if (loginVersion === undefined || loginVersion === null) {
    loginVersion = 0;
  }

  // These are the account details recorded inside the login token.
  const tokenData = {
    userId: user.id,
    role: user.role,
    authVersion: loginVersion,
  };
  const tokenSettings = {
    // JWT uses seconds; our configuration stores milliseconds.
    expiresIn: Math.floor(AUTH_LIFETIME_MS / 1000),
  };

  return jwt.sign(tokenData, getJwtSecret(), tokenSettings);
}

export function setLoginCookie(res, user) {
  const token = createLoginToken(user);
  const cookieSettings = authCookieOptions();
  cookieSettings.maxAge = AUTH_LIFETIME_MS;

  res.cookie(AUTH_COOKIE_NAME, token, cookieSettings);
}

export function getLoginData(req) {
  if (!req.cookies) {
    return null;
  }

  const token = req.cookies[AUTH_COOKIE_NAME];
  if (!token) {
    return null;
  }

  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    // Expired, damaged or incorrectly signed tokens cannot log a user in.
    return null;
  }
}

export function clearLoginCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());
}
