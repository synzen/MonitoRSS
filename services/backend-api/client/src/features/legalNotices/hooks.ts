import { captureException } from "@sentry/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { notifyError } from "@/utils/notifyError";
import { dismissLegalNotice, getApplicableLegalNotice } from "./api";
import type { GetApplicableLegalNoticeOutput } from "./types";

export const useApplicableLegalNotice = ({ enabled }: { enabled: boolean }) => {
  const query = useQuery<GetApplicableLegalNoticeOutput, ApiAdapterError>(
    ["applicable-legal-notice"],
    () => getApplicableLegalNotice(),
    { enabled, retry: false, refetchOnWindowFocus: false },
  );

  useEffect(() => {
    const nextTransitionAt = query.data?.nextTransitionAt;
    const serverTime = query.data?.serverTime;

    if (!nextTransitionAt || !serverTime) {
      return undefined;
    }

    const delay = Date.parse(nextTransitionAt) - Date.parse(serverTime);

    if (delay <= 0) {
      return undefined;
    }

    const timeout = window.setTimeout(() => query.refetch(), delay);

    return () => window.clearTimeout(timeout);
  }, [query.data?.nextTransitionAt, query.data?.serverTime, query.refetch]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const refresh = () => query.refetch();

    window.addEventListener("focus", refresh);

    return () => window.removeEventListener("focus", refresh);
  }, [enabled, query.refetch]);

  useEffect(() => {
    if (query.error) {
      captureException(query.error);
    }
  }, [query.error]);

  return query;
};

export const useDismissLegalNotice = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation<void, ApiAdapterError, string>(
    (version) => dismissLegalNotice(version),
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
      notifyError("Couldn't save dismissal. Try again.", mutation.error);
    }
  }, [mutation.error]);

  return mutation;
};
