/**
 * A function to retry a promise with exponential backoff
 */
export const retryPromise = async <T>(
  promise: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> => {
  try {
    return await promise();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, delay);
    });

    return retryPromise(promise, retries - 1, delay * 2);
  }
};
