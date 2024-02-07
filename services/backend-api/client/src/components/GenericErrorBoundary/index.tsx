/* eslint-disable no-console */
/* eslint-disable react/state-in-constructor */
import { Box } from "@chakra-ui/react";
import React, { Component, ErrorInfo, ReactNode } from "react";
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
    console.error("Uncaught error:", error, errorInfo);

    fetch("/api/v1/error-reports", {
      method: "POST",
      body: JSON.stringify({
        message: `Generic error boundary caught an error`,
        url: window.location.href,
        error: {
          message: error.message,
          stack: error.stack,
        },
        errorInfo: {
          componentStack: errorInfo.componentStack,
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
    }).catch((err) => {
      console.error(`Failed to make error report`, err);
    });
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
