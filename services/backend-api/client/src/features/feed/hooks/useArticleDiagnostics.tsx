import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import {
  GetArticleDiagnosticsInput,
  GetArticleDiagnosticsOutput,
  getArticleDiagnostics,
} from "../api/getArticleDiagnostics";

interface Props {
  feedId?: string;
  data: GetArticleDiagnosticsInput["data"];
  disabled?: boolean;
}

export const useArticleDiagnostics = ({ feedId, data: inputData, disabled }: Props) => {
  const queryKey = [
    "article-diagnostics",
    {
      feedId,
      data: inputData,
    },
  ];

  const { data, status, error, fetchStatus, refetch } = useQuery<
    GetArticleDiagnosticsOutput,
    ApiAdapterError | Error
  >(
    queryKey,
    async () => {
      if (!feedId) {
        throw new Error("Feed ID is required to fetch article diagnostics");
      }

      return getArticleDiagnostics({
        feedId,
        data: inputData,
      });
    },
    {
      enabled: !!feedId && !disabled,
      keepPreviousData: true,
      refetchOnWindowFocus: false,
    }
  );

  return {
    data,
    status,
    error,
    fetchStatus,
    refetch,
  };
};
