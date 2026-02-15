import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { CreateSubscriptionChangeInput, createSubscriptionChange } from "../api";

export const useCreateSubscriptionChange = () => {
  const queryClient = useQueryClient();
  const { status, mutateAsync } = useMutation<void, ApiAdapterError, CreateSubscriptionChangeInput>(
    (details) => createSubscriptionChange(details),
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
