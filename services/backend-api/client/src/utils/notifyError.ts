import { toaster } from "@/components/ui/toaster";

interface Options {
  // Position is now controlled globally by the Toaster placement (see components/ui/toaster).
  position?: "top" | "top-right";
}

export const notifyError = (
  title: string,
  error: Error | string | React.ReactNode,
  _options?: Options,
) => {
  let description: string | undefined;

  if (typeof error === "string") {
    description = error;
  } else if (error instanceof Error) {
    description = error.message;
  }

  toaster.create({
    title,
    description,
    type: "error",
    duration: 10000,
  });
};

export default notifyError;
