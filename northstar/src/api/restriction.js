import { RestrictionCode } from '../status/statuses.js';
export function restrictionMessage(failure) {
  return Object.values(RestrictionCode).includes(failure.response?.data?.code)
    ? failure.response.data.message || 'Your account is restricted. Please contact support.' : '';
}

export function restrictionDetails(failure) {
  if (!restrictionMessage(failure)) return null;
  const deleted = failure.response.data.code === RestrictionCode.DELETED;
  return {
    code: failure.response.data.code,
    title: deleted ? 'Your account has been deleted' : 'Your account is restricted',
    message: deleted
      ? 'This account is no longer available. You can continue browsing or sign in with another account.'
      : 'Access to this account has been restricted. Please contact support for help. You can still browse the store.',
  };
}
