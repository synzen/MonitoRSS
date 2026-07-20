import { useMutation } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { deleteMyAccount, DeleteMyAccountInput } from "../api";

export const useDeleteMyAccount = () => {
  const { mutateAsync, status, error, reset } = useMutation<
    void,
    ApiAdapterError,
    DeleteMyAccountInput
  >((input) => deleteMyAccount(input));

  return {
    mutateAsync,
    status,
    error,
    reset,
  };
};
