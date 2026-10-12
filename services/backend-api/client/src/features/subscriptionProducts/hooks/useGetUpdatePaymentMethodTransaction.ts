import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { GetUpdatePaymentMethodTransactionOutput, getUpdatePaymentMethodTransaction } from "../api";

interface Props {
  enabled?: boolean;
}

export const useGetUpdatePaymentMethodTransaction = ({ enabled }: Props) => {
  const { data, status, error, fetchStatus, refetch } = useQuery<
    GetUpdatePaymentMethodTransactionOutput,
    ApiAdapterError
  >({
    queryKey: ["update-payment-method-transaction"],
    queryFn: async () => getUpdatePaymentMethodTransaction(),
    gcTime: 0,
    enabled,
  });

  return {
    data,
    status,
    error,
    fetchStatus,
    refetch,
  };
};
