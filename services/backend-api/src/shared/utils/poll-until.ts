// Thrown when the local record never reflected the change within the poll
// budget. The remote mutation that preceded the poll has already succeeded, so
// callers that only used the poll as a read-back confirmation can treat this as
// eventual consistency rather than a failed operation.
export class PollTimeoutException extends Error {
  constructor(description: string) {
    super(`Timed out polling for ${description}`);
    this.name = "PollTimeoutException";
  }
}

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
      throw new PollTimeoutException(description);
    }
  }
}
