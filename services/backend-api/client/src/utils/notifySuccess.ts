import { createStandaloneToast, UseToastOptions } from "@chakra-ui/react";
import theme from "./theme";

const { toast } = createStandaloneToast({
  theme,
});

interface Options {
  toastOptions?: UseToastOptions;
}

export const notifySuccess = (
  title: string,
  description?: string | React.ReactNode,
  options?: Options,
) => {
  toast({
    title,
    description,
    status: "success",
    position: "top",
    isClosable: true,
    ...options,
  });
};
