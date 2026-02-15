import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { createSubscriptionCancel } from "../api";

export const useCreateSubscriptionCancel = () => {
  const queryClient = useQueryClient();
  const { status, mutateAsync } = useMutation<void, ApiAdapterError>(
    () => createSubscriptionCancel(),
    {
      onSuccess: () =>
        queryClient.invalidateQueries({
          predicate(query) {
            return query.queryKey[0] === "user-me" || query.queryKey[0] === "discord-user-me";
          },
          refetchType: "all",
          type: "all",
        }),
    },
  );

  return {
    status,
    mutateAsync,
  };
};
