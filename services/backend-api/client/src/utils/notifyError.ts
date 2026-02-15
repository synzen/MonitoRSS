import { createStandaloneToast, UseToastOptions } from "@chakra-ui/react";
import theme from "./theme";

const { toast } = createStandaloneToast({
  theme,
});

interface Options {
  toastOptions?: UseToastOptions;
}

export const notifyError = (
  title: string,
  error: Error | string | React.ReactNode,
  options?: Options,
) => {
  let description: string | React.ReactNode = "";

  if (typeof error === "string") {
    description = error;
  } else if (error instanceof Error) {
    description = error.message;
  } else {
    description = error;
  }

  toast({
    title,
    description,
    status: "error",
    position: "top",
    ...options,
  });
};
