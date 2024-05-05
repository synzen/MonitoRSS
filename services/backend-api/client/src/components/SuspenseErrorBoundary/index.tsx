import { Box } from "@chakra-ui/react";
import React, { ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { InlineErrorAlert } from "../InlineErrorAlert";

interface Props {
  children: ReactNode;
}

const FallbackComponent = () => {
  return (
    <Box alignItems="center">
      <InlineErrorAlert
        title="Failed to load component"
        description="Try refreshing the page, or try again later."
      />
    </Box>
  );
};

const fallback = <FallbackComponent />;

export const SuspenseErrorBoundary = ({ children }: Props) => {
  return <Sentry.ErrorBoundary fallback={fallback}>{children}</Sentry.ErrorBoundary>;
};
