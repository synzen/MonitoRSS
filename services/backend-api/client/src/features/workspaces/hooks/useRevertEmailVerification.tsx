import { useMutation } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { revertEmailVerification, RevertEmailVerificationInput } from "../api";

export const useRevertEmailVerification = () => {
  const { mutateAsync, status, error, reset } = useMutation<
    void,
    ApiAdapterError,
    RevertEmailVerificationInput
  >((input) => revertEmailVerification(input));

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
