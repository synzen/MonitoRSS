/* eslint-disable no-await-in-loop */
import React from "react";

const RECOGNIZED_ERROR_MESSAGE = "Failed to fetch dynamically imported module: ";

// https://medium.com/@alonmiz1234/retry-dynamic-imports-with-react-lazy-c7755a7d557a
export const lazyWithRetries: typeof React.lazy = (importer) => {
  const retryImport = async () => {
    try {
      return await importer();
    } catch (error: any) {
      if (!error.message.startsWith(RECOGNIZED_ERROR_MESSAGE)) {
        throw error;
      }

      // retry 5 times with 2 second delay and backoff factor of 2 (2, 4, 8, 16, 32 seconds)
      for (let i = 0; i < 5; i += 1) {
        await new Promise<void>((resolve) => {
          setTimeout(
            () => {
              resolve();
            },
            1000 * 2 ** i,
          );
        });
        // this assumes that the exception will contain this specific text with the url of the module
        // if not, the url will not be able to parse and we'll get an error on that
        // eg. "Failed to fetch dynamically imported module: https://example.com/assets/Home.tsx"
        const url = new URL(error.message.replace(RECOGNIZED_ERROR_MESSAGE, "").trim());
        // add a timestamp to the url to force a reload the module (and not use the cached version - cache busting)
        url.searchParams.set("t", `${+new Date()}`);

        try {
          return await import(url.href);
        } catch (e) {
          console.log("retrying import");
        }
      }

      throw error;
    }
  };

  return React.lazy(retryImport);
};
