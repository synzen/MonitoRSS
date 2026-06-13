// Paddle mutations are reflected locally by the webhook handler (the single
// writer of subscription state), so mutation endpoints poll the local record
// until the webhook lands. Once a second, ~50 tries.
export async function pollUntil<T>(
  fetchValue: () => Promise<T>,
  check: (value: T) => boolean,
  description: string,
  options?: { intervalMs?: number; maxTries?: number },
): Promise<void> {
  const intervalMs = options?.intervalMs ?? 1000;
  const maxTries = options?.maxTries ?? 50;
  let tries = 0;

  await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));

  while (true) {
    const value = await fetchValue();

    if (check(value)) {
      break;
    }

    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));

    tries++;

    if (tries > maxTries) {
      throw new Error(`Timed out polling for ${description}`);
    }
  }
}
