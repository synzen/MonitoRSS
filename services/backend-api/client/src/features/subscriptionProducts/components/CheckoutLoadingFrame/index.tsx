import { Box, Stack, Text, VisuallyHidden } from "@chakra-ui/react";
import {
  CHECKOUT_FRAME_MIN_HEIGHT_PX,
  CHECKOUT_LOAD_FAILED_MESSAGE,
  CheckoutLoadAnnouncements,
} from "../../constants";
import { useCheckoutLoadAnnouncement } from "../../hooks/useCheckoutLoadAnnouncement";

interface Props {
  /**
   * The class Paddle paints its inline checkout frame into. Stable string (not a
   * generated id) because Paddle selects the target by class name.
   */
  frameClassName: string;
  /** Ref callback for the frame element Paddle renders into. */
  frameRef: (el: HTMLDivElement | null) => void;
  /**
   * Whether the checkout has loaded. Drives the loading -> ready transition: the
   * recovery overlay, the bg, the busy flag, and the announcement all key off it.
   */
  isLoaded: boolean;
  /**
   * Whether the host is actively showing this checkout. Arms the stall timer and
   * the announcement only while open; clears them when the checkout is dismissed
   * so a later reopen starts clean.
   */
  isOpen: boolean;
  /** Test ids for the busy frame region and the live region. */
  frameRegionTestId?: string;
  liveMessageTestId?: string;
  /**
   * The loading/ready wording to announce. Defaults to the purchase-checkout
   * vocabulary; pass the payment-update set for an update-card flow.
   */
  announcements?: CheckoutLoadAnnouncements;
}

// Hosts a Paddle inline checkout frame with the loading affordances Paddle does
// not provide: a polite live region that announces loading/ready/stall to screen
// readers, and a recovery overlay if the load stalls. Shared by the workspace
// checkout dialog and the full-page personal checkout so the two surfaces behave
// and announce identically.
export const CheckoutLoadingFrame = ({
  frameClassName,
  frameRef,
  isLoaded,
  isOpen,
  frameRegionTestId = "workspace-checkout-frame-region",
  liveMessageTestId = "workspace-checkout-live-message",
  announcements,
}: Props) => {
  const { liveMessage, loadTimedOut } = useCheckoutLoadAnnouncement({
    isOpen,
    isLoaded,
    announcements,
  });

  return (
    <>
      {/* Announcement channel for screen readers. Always mounted and empty on
          open so each later fill is spoken as a live update. It carries NO
          aria-busy: a busy live region is told to suppress its updates, which
          would silence these very messages. */}
      <VisuallyHidden aria-live="polite" data-testid={liveMessageTestId}>
        {liveMessage}
      </VisuallyHidden>
      <Box
        data-testid={frameRegionTestId}
        aria-busy={!isLoaded}
        position="relative"
        minH={`${CHECKOUT_FRAME_MIN_HEIGHT_PX}px`}
      >
        {/* Paddle paints its own loading spinner here before checkout.loaded
            fires, so we render NO competing visible spinner of our own during the
            normal wait (two stacked rings otherwise). The live region above
            carries the screen-reader announcement that Paddle lacks. */}
        {loadTimedOut && !isLoaded && (
          <Stack
            position="absolute"
            inset={0}
            align="center"
            justify="center"
            gap={3}
            zIndex={1}
            px={6}
            textAlign="center"
            bg="bg.panel"
            aria-hidden="true"
          >
            {/* Only shown once Paddle has demonstrably failed to load, so by now
                there is no Paddle spinner left to overlap. */}
            <Text color="fg.muted">{CHECKOUT_LOAD_FAILED_MESSAGE}</Text>
          </Stack>
        )}
        {/* Paddle paints its checkout onto this container. Transparent while
            loading so Paddle's own loader shows; opaque white once loaded to
            match the third-party checkout surface. */}
        <Box
          className={frameClassName}
          ref={frameRef}
          bg={isLoaded ? "white" : "transparent"}
          minH={`${CHECKOUT_FRAME_MIN_HEIGHT_PX}px`}
          w="100%"
        />
      </Box>
    </>
  );
};
