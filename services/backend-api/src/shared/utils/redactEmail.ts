// Obfuscates an email to a human-meaningful hint (e.g. "a***@example.com") so
// the invitee can recognize which address to verify without a random prober
// being able to harvest the full address from a guessed invitation id.
export function redactEmail(email: string): string {
  const atIndex = email.lastIndexOf("@");

  if (atIndex <= 0) {
    return "***";
  }

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  return `${local[0]}***@${domain}`;
}
