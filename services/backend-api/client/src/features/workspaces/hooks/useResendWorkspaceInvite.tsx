import { useMutation } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { resendWorkspaceInvite, ResendWorkspaceInviteInput } from "../api";

export const useResendWorkspaceInvite = () => {
  const { mutateAsync, status, error, reset } = useMutation<
    void,
    ApiAdapterError,
    ResendWorkspaceInviteInput
  >((input) => resendWorkspaceInvite(input));

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
