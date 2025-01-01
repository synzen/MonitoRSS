import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  createUserFeedCopySettings,
  CreateUserFeedCopySettingsInput,
} from "../api/createUserFeedCopySettings";

export const useCreateUserFeedCopySettings = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<
    void,
    ApiAdapterError,
    CreateUserFeedCopySettingsInput
  >(
    async (details) => {
      if (!details.data.targetFeedIds.length) {
        throw new Error("Must select at least 1 target feed");
      }

      await createUserFeedCopySettings(details);
    },
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          predicate: ({ queryKey }) => {
            return typeof queryKey[0] === "string" && queryKey[0].includes("user-feed");
          },
        });
      },
    }
  );

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
