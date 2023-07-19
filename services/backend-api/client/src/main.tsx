import "./utils/setupSentry";
import "./utils/i18n";
import React from "react";
import { ChakraProvider, ColorModeScript } from "@chakra-ui/react";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRoot } from "react-dom/client";
import { datadogLogs } from "@datadog/browser-logs";
import App from "./App";
import theme from "./utils/theme";
import setupMockBrowserWorker from "./mocks/browser";
import { ForceDarkMode } from "./components/ForceDarkMode";
import { GenericErrorBoundary } from "./components/GenericErrorBoundary";

const DD_CLIENT_KEY = process.env.REACT_APP_DD_CLIENT_KEY;

if (DD_CLIENT_KEY) {
  datadogLogs.init({
    clientToken: DD_CLIENT_KEY,
    forwardErrorsToLogs: true,
    sessionSampleRate: 100,
    forwardConsoleLogs: ["error"],
  });
}

async function prepare() {
  if (import.meta.env.MODE === "development-mockapi") {
    return setupMockBrowserWorker().then((worker) => worker.start());
  }

  return Promise.resolve();
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      refetchOnWindowFocus: false,
      // Invalidate cache after 30 minutes
      staleTime: 1000 * 60 * 30,
    },
  },
});

prepare().then(() => {
  const container = document.getElementById("root");

  if (!container) {
    throw new Error("Could not find root container");
  }

  const root = createRoot(container);

  // Do not use strict
  /**
   * Do not use strict mode since this breaks Chakra UI's modal, where the overlay does not
   * not get removed after closing the modal (making clicks on the page impossible).
   */
  root.render(
    // <React.StrictMode>
    <BrowserRouter>
      <ChakraProvider theme={theme}>
        <ColorModeScript initialColorMode={theme.config.initialColorMode} />
        <QueryClientProvider client={queryClient}>
          <ReactQueryDevtools />
          <ForceDarkMode>
            <GenericErrorBoundary>
              <App />
            </GenericErrorBoundary>
          </ForceDarkMode>
        </QueryClientProvider>
      </ChakraProvider>
    </BrowserRouter>
    // </React.StrictMode>,
  );
});
