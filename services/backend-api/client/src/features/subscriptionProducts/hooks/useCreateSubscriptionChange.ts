import { useMutation } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { CreateSubscriptionChangeInput, createSubscriptionChange } from "../api";

export const useCreateSubscriptionChange = () => {
  const { status, mutateAsync } = useMutation<void, ApiAdapterError, CreateSubscriptionChangeInput>(
    (details) => createSubscriptionChange(details)
  );

  return {
    status,
    mutateAsync,
  };
};
