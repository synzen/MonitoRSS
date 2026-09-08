import { captureException } from "@sentry/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { acknowledgeLegalNotice, getApplicableLegalNotice } from "./api";
import type { GetApplicableLegalNoticeOutput } from "./types";

export const useApplicableLegalNotice = ({ enabled }: { enabled: boolean }) => {
  const query = useQuery<GetApplicableLegalNoticeOutput, ApiAdapterError>(
    ["applicable-legal-notice"],
    () => getApplicableLegalNotice(),
    { enabled, retry: false },
  );

  useEffect(() => {
    if (query.error) {
      captureException(query.error);
    }
  }, [query.error]);

  return query;
};

export const useAcknowledgeLegalNotice = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation<void, ApiAdapterError, string>(
    (version) => acknowledgeLegalNotice(version),
    {
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: ["applicable-legal-notice"],
        }),
    },
  );

  useEffect(() => {
    if (mutation.error) {
      captureException(mutation.error);
    }
  }, [mutation.error]);

  return mutation;
};
