export class RetryException extends Error {}

const delay = (timeout: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, timeout));

/**
 * Repeatedly calls the provided function until it returns true or the maximum timeout is reached.
 *
 * @param {() => Promise<boolean>} fn - The function to be called repeatedly.
 * @param {number} startTimeout - The initial timeout in milliseconds.
 * @param {number} maxTimeout - The maximum timeout in milliseconds.
 * Uses exponential backoff for retries.
 * @returns {Promise<void>} A promise that resolves when the function returns true or rejects if
 * the maximum timeout is reached.
 */
const retryUntilTrue = (
  fn: () => Promise<boolean>,
  startTimeout: number,
  maxTimeout: number,
) => {
  return new Promise<void>(async (resolve, reject) => {
    try {
      let currentTimeout = startTimeout;

      while (true) {
        if (await fn()) {
          resolve();

          return;
        }

        await delay(currentTimeout);
        currentTimeout = Math.min(currentTimeout * 1.5, maxTimeout);

        if (currentTimeout >= maxTimeout) {
          break;
        }
      }

      reject(
        new RetryException(
          `Timeout reached (next timeout of ${currentTimeout} is greater than max timeout of` +
            ` ${maxTimeout})`,
        ),
      );
    } catch (err) {
      const toThrow = new RetryException((err as Error).message);

      if (err instanceof Error) {
        toThrow.stack = err.stack;
      }

      reject(toThrow);
    }
  });
};

export default retryUntilTrue;
