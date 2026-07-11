import { useMutation } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { sendAccountDeletionCode } from "../api";

export const useSendAccountDeletionCode = () => {
  const { mutateAsync, status, error, reset } = useMutation<void, ApiAdapterError, void>(() =>
    sendAccountDeletionCode(),
  );

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
