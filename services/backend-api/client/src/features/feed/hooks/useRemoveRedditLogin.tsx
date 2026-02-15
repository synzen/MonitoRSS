import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getRemoveRedditLogin } from "../api/getRemoveRedditLogin";

export const useRemoveRedditLogin = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error } = useMutation<void, ApiAdapterError, void>(
    () => getRemoveRedditLogin(),
    {
      onSuccess: () =>
        queryClient.invalidateQueries(
          {
            queryKey: ["user-me"],
            exact: false,
          },
          {
            throwOnError: true,
          },
        ),
    },
  );

  return {
    mutateAsync,
    status,
    error,
  };
};
