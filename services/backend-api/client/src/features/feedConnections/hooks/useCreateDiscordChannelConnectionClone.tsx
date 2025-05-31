import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  createDiscordChannelConnectionClone,
  CreateDiscordChannelConnectionCloneInput,
  CreateDiscordChannelConnectionCloneOutput,
} from "../api";

export const useCreateDiscordChannelConnectionClone = () => {
  const queryClient = useQueryClient();
  const { mutateAsync, status, error, reset } = useMutation<
    CreateDiscordChannelConnectionCloneOutput,
    ApiAdapterError,
    CreateDiscordChannelConnectionCloneInput
  >((details) => createDiscordChannelConnectionClone(details), {
    onSuccess: () =>
      queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          typeof queryKey[0] === "string" && queryKey[0].includes("user-feed"),
      }),
  });

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
