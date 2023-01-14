/* eslint-disable react/state-in-constructor */
import { Box } from "@chakra-ui/react";
import React, { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { ErrorAlert } from "../ErrorAlert";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class GenericErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Uncaught error:", error, errorInfo);
    Sentry.captureException(error);
  }

  public render() {
    const { hasError } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <Box height="100vh" alignItems="center">
          <ErrorAlert />
        </Box>
      );
    }

    return children;
  }
}
