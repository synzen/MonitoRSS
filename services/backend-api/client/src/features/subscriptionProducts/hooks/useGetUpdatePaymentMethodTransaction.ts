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
  >(["update-payment-method-transaction"], async () => getUpdatePaymentMethodTransaction(), {
    cacheTime: 0,
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
