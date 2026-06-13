// Paddle mutations are reflected locally by the webhook handler (the single
// writer of subscription state), so mutation endpoints poll the local record
// until the webhook lands. Once a second, ~50 tries.
export async function pollUntil<T>(
  fetchValue: () => Promise<T>,
  check: (value: T) => boolean,
  description: string,
): Promise<void> {
  let tries = 0;

  await new Promise<void>((resolve) => setTimeout(resolve, 1000));

  while (true) {
    const value = await fetchValue();

    if (check(value)) {
      break;
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 1000));

    tries++;

    if (tries > 50) {
      throw new Error(`Timed out polling for ${description}`);
    }
  }
}
