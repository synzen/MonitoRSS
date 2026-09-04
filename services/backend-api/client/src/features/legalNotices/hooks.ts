import { captureException } from "@sentry/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getApplicableLegalNotice } from "./api";
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
