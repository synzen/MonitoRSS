import { useMutation } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { sendEmailVerification, SendEmailVerificationInput } from "../api";

export const useSendEmailVerification = () => {
  const { mutateAsync, status, error, reset } = useMutation<
    void,
    ApiAdapterError,
    SendEmailVerificationInput
  >((input) => sendEmailVerification(input));

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
