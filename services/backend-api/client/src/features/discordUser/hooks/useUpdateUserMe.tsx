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
      // queryClient.invalidateQueries<UpdateUserMeOutput>({
      //   predicate: (query) => {
      //     return query.queryKey[0] === "user-me";
      //   },
      // });

      return queryClient.setQueryData<GetUserMeOutput>(["user-me"], response);
    },
  });

  return {
    mutateAsync,
    status,
    error,
  };
};
