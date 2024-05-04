/* eslint-disable no-console */
/* eslint-disable react/state-in-constructor */
import { Box } from "@chakra-ui/react";
import React, { ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { ErrorAlert } from "../ErrorAlert";

interface Props {
  children: ReactNode;
}

const FallbackComponent = () => {
  return (
    <Box height="100vh" alignItems="center">
      <ErrorAlert />
    </Box>
  );
};

const fallback = <FallbackComponent />;

export const GenericErrorBoundary = ({ children }: Props) => {
  return <Sentry.ErrorBoundary fallback={fallback}>{children}</Sentry.ErrorBoundary>;
};
