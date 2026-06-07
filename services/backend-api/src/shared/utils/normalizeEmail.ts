// Canonical email normalization used wherever an email is compared or stored:
// an invitation's email and a user's verified email must compare equal
// byte-for-byte. The mongoose `lowercase: true` index option backstops storage.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
