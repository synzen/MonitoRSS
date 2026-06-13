import { useMutation } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { sendInviteVerification, SendInviteVerificationInput } from "../api";

export const useSendInviteVerification = () => {
  const { mutateAsync, status, error, reset } = useMutation<
    void,
    ApiAdapterError,
    SendInviteVerificationInput
  >((input) => sendInviteVerification(input));

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
