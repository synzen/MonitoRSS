import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { GetUserMeOutput, updateUserMe, UpdateUserMeInput, UpdateUserMeOutput } from "../api";

export const useUpdateUserMe = () => {
  const queryClient = useQueryClient();
  const { mutateAsync, status, error } = useMutation<
    UpdateUserMeOutput,
    ApiAdapterError,
    UpdateUserMeInput
  >((details) => updateUserMe(details), {
    onSuccess: (response) => {
      return queryClient.setQueryData<GetUserMeOutput>(["user-me"], response);
    },
  });

  return {
    mutateAsync,
    status,
    error,
  };
};
