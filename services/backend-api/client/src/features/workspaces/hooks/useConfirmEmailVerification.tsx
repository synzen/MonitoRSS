import { useMutation, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { confirmEmailVerification, ConfirmEmailVerificationInput } from "../api";

export const useConfirmEmailVerification = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, status, error, reset } = useMutation<
    void,
    ApiAdapterError,
    ConfirmEmailVerificationInput
  >((input) => confirmEmailVerification(input), {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-me"] });
    },
  });

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
