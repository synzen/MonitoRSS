import "./utils/i18n";
import React from "react";
import { ChakraProvider, ColorModeScript } from "@chakra-ui/react";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import * as Sentry from "@sentry/react";
import theme from "./utils/theme";
import setupMockBrowserWorker from "./mocks/browser";
import { ForceDarkMode } from "./components/ForceDarkMode";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import App from "./App";
import { PricingDialogProvider } from "./contexts";
import { PaddleContextProvider } from "./contexts/PaddleContext";

class GoogleTranslateError extends Error {
  message = "Google Translate crash was prevented";
}

function stringifyNode(node: Node): string {
  let text = "";

  if (node instanceof Text) {
    text = node.wholeText;
  } else if (node instanceof Element) {
    text = node.outerHTML;
  } else {
    text = node.textContent || "";
  }

  return JSON.stringify(
    {
      nodeType: node.nodeType,
      text,
    },
    null,
    2,
  );
}

/**
 * From https://github.com/facebook/react/issues/11538#issuecomment-417504600
 */
function catchGoogleTranslateErrors() {
  if (typeof Node === "function" && Node.prototype) {
    const originalRemoveChild = Node.prototype.removeChild;

    // @ts-ignore
    // eslint-disable-next-line func-names
    Node.prototype.removeChild = function (child) {
      if (child.parentNode !== this) {
        if (console) {
          // eslint-disable-next-line no-console
          console.error(
            "Google Translate Error: Cannot remove a child from a different parent",
            child,
            this,
          );
        }

        return child;
      }

      // @ts-ignore
      // eslint-disable-next-line prefer-rest-params
      return originalRemoveChild.apply(this, arguments);
    };

    const originalInsertBefore = Node.prototype.insertBefore;

    // @ts-ignore
    // eslint-disable-next-line func-names
    Node.prototype.insertBefore = function (newNode, referenceNode) {
      if (referenceNode && referenceNode.parentNode !== this) {
        if (console) {
          // eslint-disable-next-line no-console
          console.error(
            "Google Translate Error: Cannot insert before a reference node from a different parent",
            referenceNode,
            this,
          );
        }

        return newNode;
      }

      // @ts-ignore
      // eslint-disable-next-line prefer-rest-params
      return originalInsertBefore.apply(this, arguments);
    };
  }
}

async function prepare() {
  if (["development-mockapi"].includes(import.meta.env.MODE)) {
    await setupMockBrowserWorker().then((worker) => worker.start());
  } else {
    const DSN = import.meta.env.VITE_SENTRY_DSN;

    if (DSN) {
      Sentry.init({
        dsn: DSN,
        tunnel: "/api/v1/sentry-tunnel",
        environment: import.meta.env.MODE,
        integrations: [
          Sentry.reactRouterV6BrowserTracingIntegration({
            useEffect: React.useEffect,
            useLocation,
            useNavigationType,
            createRoutesFromChildren,
            matchRoutes,
          }),
          Sentry.replayIntegration({
            maskAllText: false,
            blockAllMedia: false,
            maskAllInputs: false,
            networkDetailAllowUrls: ["/api/v1/*"],
          }),
        ],
        tracesSampleRate: 0.2,
        // Session Replay
        replaysSessionSampleRate: 0.5, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
        replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
      });
    }
  }

  catchGoogleTranslateErrors();

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
      {/** Disable support widget since the iframe sometimes blocks forms */}
      {/* <SupportWidget /> */}
      <ChakraProvider theme={theme}>
        <ColorModeScript initialColorMode={theme.config.initialColorMode} />
        <QueryClientProvider client={queryClient}>
          <ForceDarkMode>
            <GlobalErrorBoundary>
              <PaddleContextProvider>
                <PricingDialogProvider>
                  <App />
                </PricingDialogProvider>
              </PaddleContextProvider>
            </GlobalErrorBoundary>
          </ForceDarkMode>
        </QueryClientProvider>
      </ChakraProvider>
    </BrowserRouter>,
    // </React.StrictMode>,
  );
});
