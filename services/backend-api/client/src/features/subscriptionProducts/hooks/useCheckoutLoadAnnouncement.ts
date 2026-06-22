import { useEffect, useState } from "react";
import {
  CHECKOUT_ANNOUNCEMENTS,
  CHECKOUT_LOAD_FAILED_MESSAGE,
  CHECKOUT_LOAD_TIMEOUT_MS,
  CheckoutLoadAnnouncements,
} from "../constants";

// Delay before filling the live region after open. A polite live region only
// speaks content that changes AFTER it is in the DOM, so the region mounts empty
// and is filled a tick later as a real update the screen reader announces.
const LIVE_REGION_FILL_DELAY_MS = 50;

interface Params {
  /** Whether the host is actively showing this checkout. */
  isOpen: boolean;
  /** Whether Paddle has reported the checkout loaded. */
  isLoaded: boolean;
  /**
   * The loading/ready wording to announce. Defaults to the purchase-checkout
   * vocabulary; pass the payment-update set so an update-card flow does not
   * announce itself as a checkout.
   */
  announcements?: CheckoutLoadAnnouncements;
}

interface Result {
  /** The message to render inside a polite live region (empty until announced). */
  liveMessage: string;
  /** True once the load has exceeded the stall timeout without loading. */
  loadTimedOut: boolean;
}

// Owns the loading affordances Paddle does not provide: a polite-live-region
// message that announces loading/ready/stall, and a stall flag that surfaces
// recovery guidance if the load never finishes. Shared by the workspace checkout
// dialog and the full-page personal checkout so both announce identically.
export const useCheckoutLoadAnnouncement = ({
  isOpen,
  isLoaded,
  announcements = CHECKOUT_ANNOUNCEMENTS,
}: Params): Result => {
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  // The screen-reader announcement, kept separate from the visible spinner. A
  // polite live region only speaks content that changes after it is in the DOM,
  // so this starts empty on open and is filled a tick later as a real update.
  const [liveMessage, setLiveMessage] = useState("");

  // Arm a stall timer while open and not yet loaded; if it fires first, surface
  // recovery guidance instead of an endless spinner.
  useEffect(() => {
    if (!isOpen || isLoaded) {
      setLoadTimedOut(false);

      return undefined;
    }

    const timer = setTimeout(() => setLoadTimedOut(true), CHECKOUT_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [isOpen, isLoaded]);

  // Fill the live region after open (and after load/stall changes) so each state
  // is announced as a delta the screen reader actually speaks. The region must
  // NOT carry aria-busy: a busy live region tells the screen reader to suppress
  // its updates, which would silence the very messages set here.
  useEffect(() => {
    if (!isOpen) {
      setLiveMessage("");

      return undefined;
    }

    if (isLoaded) {
      // Announce completion, not silence: clearing the region would say nothing,
      // leaving a user who heard "Loading..." without a cue the form is ready.
      setLiveMessage(announcements.ready);

      return undefined;
    }

    const message = loadTimedOut ? CHECKOUT_LOAD_FAILED_MESSAGE : announcements.loading;
    const timer = setTimeout(() => setLiveMessage(message), LIVE_REGION_FILL_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isOpen, isLoaded, loadTimedOut, announcements.loading, announcements.ready]);

  return { liveMessage, loadTimedOut };
};
