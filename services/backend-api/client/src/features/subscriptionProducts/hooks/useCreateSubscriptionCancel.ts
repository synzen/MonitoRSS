import { useMutation } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { createSubscriptionCancel } from "../api";

export const useCreateSubscriptionCancel = () => {
  const { status, mutateAsync } = useMutation<void, ApiAdapterError>(() =>
    createSubscriptionCancel()
  );

  return {
    status,
    mutateAsync,
  };
};
