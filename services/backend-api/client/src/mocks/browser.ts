/* eslint-disable import/no-extraneous-dependencies */
// This configures a Service Worker with the given request handlers.

export default async function setupMockBrowserWorker() {
  const msw = await import("msw/browser");
  const handlers = (await import("./handlers")).default;

  return msw.setupWorker(...handlers);
}
