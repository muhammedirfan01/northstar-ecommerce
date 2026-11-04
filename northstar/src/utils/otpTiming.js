export function otpTiming(result) {   //In result we would have that expiresIn,resendAfter
  const now = Date.now();
  let expiresAt;
  if (result.expiresAt) {
    expiresAt = Date.parse(result.expiresAt);
  } else {
    expiresAt = now + result.expiresIn * 1000;
  }
  const resendAt = now + result.resendAfter * 1000;
  return { expiresAt, resendAt };
}