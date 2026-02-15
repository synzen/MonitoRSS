import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { createSubscriptionResume } from "../api";

export const useCreateSubscriptionResume = () => {
  const queryClient = useQueryClient();

  const { status, mutateAsync } = useMutation<void, ApiAdapterError>(
    () => createSubscriptionResume(),
    {
      onSuccess: async () =>
        queryClient.invalidateQueries({
          predicate: (query) => {
            return query.queryKey[0] === "user-me";
          },
        }),
    },
  );

  return {
    status,
    mutateAsync,
  };
};
