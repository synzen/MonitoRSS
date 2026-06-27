// The pixel height Paddle's inline checkout frame is initialized to. Shared so
// the frame container, its loading overlay, and Paddle's own frameInitialHeight
// stay in lockstep; a mismatch leaves a layout-shift gap or an overlay that no
// longer covers the frame.
export const CHECKOUT_FRAME_MIN_HEIGHT_PX = 634;

// How long to wait for Paddle to report the checkout loaded before swapping the
// loading state for recovery guidance, so a stalled load never strands the user
// on an endless spinner.
export const CHECKOUT_LOAD_TIMEOUT_MS = 10_000;

// Shown (and announced) if the checkout never loads. Shared by every checkout
// surface so they give users the same recovery instructions.
export const CHECKOUT_LOAD_FAILED_MESSAGE =
  "If the checkout form does not fully load, please try refreshing the page or using a different browser.";

// The loading/ready announcements vary by what the Paddle frame is hosting, so a
// screen-reader user who only hears the audio knows whether they are checking out
// or just updating a card. The recovery/stall guidance and timing are shared.
export interface CheckoutLoadAnnouncements {
  // Spoken while Paddle paints its own (unannounced) loading spinner.
  loading: string;
  // Spoken once Paddle reports the frame loaded, cueing the user it is their turn.
  ready: string;
}

// For a purchase/subscription checkout.
export const CHECKOUT_ANNOUNCEMENTS: CheckoutLoadAnnouncements = {
  loading: "Loading secure checkout, please wait.",
  ready: "Checkout ready. Enter your payment details below.",
};

// For updating the payment method on an existing subscription. Deliberately
// avoids "checkout" so the user does not think they are buying something again.
export const PAYMENT_UPDATE_ANNOUNCEMENTS: CheckoutLoadAnnouncements = {
  loading: "Loading secure payment form, please wait.",
  ready: "Payment form ready. Enter your new payment details below.",
};
