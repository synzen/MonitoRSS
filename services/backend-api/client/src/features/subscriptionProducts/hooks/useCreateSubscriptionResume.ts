import { useMutation } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { createSubscriptionResume } from "../api";

export const useCreateSubscriptionResume = () => {
  const { status, mutateAsync } = useMutation<void, ApiAdapterError>(() =>
    createSubscriptionResume()
  );

  return {
    status,
    mutateAsync,
  };
};
