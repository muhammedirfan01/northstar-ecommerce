export function otpTiming(result) {
  const now = Date.now();
  return {
    expiresAt: result.expiresAt ? Date.parse(result.expiresAt) : now + result.expiresIn * 1000,
    resendAt: now + result.resendAfter * 1000,
  };
}
