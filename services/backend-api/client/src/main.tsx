import "./utils/i18n";
import React from "react";
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
import setupMockBrowserWorker from "./mocks/browser";
import { Provider } from "./components/ui/provider";
import { Toaster } from "./components/ui/toaster";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import App from "./App";
import { PricingDialogProvider, PaddleContextProvider } from "@/features/subscriptionProducts";

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

declare global {
  interface Window {
    Termly?: {
      getConsentState?: () => Record<string, boolean> | undefined;
      on?: (event: string, callback: () => void) => void;
    };
  }
}

// Maximum time to wait for the Termly banner script before initializing
// Sentry without replay. Short on purpose: the app must not hang on a
// blocked or slow CMP.
const REPLAY_CONSENT_TIMEOUT_MS = 3000;

function readReplayConsent(): boolean {
  try {
    return window.Termly?.getConsentState?.()?.performance === true;
  } catch {
    return false;
  }
}

function waitForReplayConsent(): Promise<boolean> {
  if (readReplayConsent()) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const start = Date.now();

    const tick = () => {
      if (readReplayConsent()) {
        resolve(true);

        return;
      }

      if (
        typeof window.Termly?.getConsentState === "function" ||
        Date.now() - start >= REPLAY_CONSENT_TIMEOUT_MS
      ) {
        resolve(readReplayConsent());

        return;
      }

      window.setTimeout(tick, 100);
    };

    tick();
  });
}

// Re-init cleanly when the user flips Performance consent after load: drop
// any pre-change replay session id, then reload so Sentry starts from the
// matching configuration. No-op when the decision is unchanged, so the
// initial banner accept/decline cannot loop.
function watchReplayConsent(initializedWithReplay: boolean): void {
  try {
    window.Termly?.on?.("consent", () => {
      if (readReplayConsent() !== initializedWithReplay) {
        try {
          window.sessionStorage.removeItem("sentryReplaySession");
        } catch {
          // Storage may be unavailable; reload still resets the SDK state.
        }

        window.location.reload();
      }
    });
  } catch {
    // Consent watching is best-effort; recording already gated at init.
  }
}

async function prepare() {
  if (["development-mockapi"].includes(import.meta.env.MODE)) {
    await setupMockBrowserWorker().then((worker) => worker.start());
  } else {
    const DSN = import.meta.env.VITE_SENTRY_DSN;

    if (DSN) {
      // Session Replay runs only with Performance consent (Termly category
      // holding sentryReplaySession). Fail closed: no banner decision, no
      // Termly script, or timeout all mean no replay. Error/tracing stays on,
      // minimized with sendDefaultPii: false and no user association.
      const replayAllowed = await waitForReplayConsent();
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
          ...(replayAllowed
            ? [
                Sentry.replayIntegration({
                  maskAllText: true,
                  blockAllMedia: true,
                  maskAllInputs: true,
                }),
              ]
            : []),
        ],
        sendDefaultPii: false,
        tracesSampleRate: 0.2,
        // Session Replay
        replaysSessionSampleRate: 0.5, // 50% of ordinary sessions, only when Performance consent is granted.
        replaysOnErrorSampleRate: 1.0, // 100% of error sessions, only when Performance consent is granted.
      });
      watchReplayConsent(replayAllowed);
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
      {/* Dark-only for now: forcedTheme replaces the v2 ForceDarkMode + ColorModeScript. */}
      <Provider forcedTheme="dark" defaultTheme="dark">
        <QueryClientProvider client={queryClient}>
          <GlobalErrorBoundary>
            <PaddleContextProvider>
              <PricingDialogProvider>
                <App />
              </PricingDialogProvider>
            </PaddleContextProvider>
          </GlobalErrorBoundary>
        </QueryClientProvider>
        <Toaster />
      </Provider>
    </BrowserRouter>,
    // </React.StrictMode>,
  );
});
