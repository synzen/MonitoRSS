import { captureException } from "@sentry/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getApplicableLegalNotice } from "./api";
import type { GetApplicableLegalNoticeOutput } from "./types";

export const PRODUCTION_DASHBOARD_HOSTNAME = "my.monitorss.xyz";

export const isProductionDashboardHostname = (hostname: string) =>
  hostname.toLowerCase() === PRODUCTION_DASHBOARD_HOSTNAME;

export const isLocalLegalNoticePreviewRequested = () =>
  window.location.hostname === "localhost" &&
  new URLSearchParams(window.location.search).has("legalNoticePreview");

export const useApplicableLegalNotice = ({
  enabled,
  localPreview,
}: {
  enabled: boolean;
  localPreview: boolean;
}) => {
  const query = useQuery<GetApplicableLegalNoticeOutput, ApiAdapterError>(
    ["applicable-legal-notice", localPreview],
    () => getApplicableLegalNotice({ localPreview }),
    { enabled, retry: false },
  );

  useEffect(() => {
    if (query.error) {
      captureException(query.error);
    }
  }, [query.error]);

  return query;
};
