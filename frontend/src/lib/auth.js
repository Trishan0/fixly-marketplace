export function isEmailVerified(user) {
  return Boolean(user?.is_email_verified || user?.force_verified)
}
