import { Center, Spinner } from "@chakra-ui/react";

/**
 * Centered spinner for route-level Suspense fallbacks and loading gates.
 * A bare <Spinner /> pins to the left edge of its container, so this wraps
 * it in a full-width Center.
 */
export const LoadingFallback = () => (
  <Center width="100%" mt={24}>
    <Spinner />
  </Center>
);
