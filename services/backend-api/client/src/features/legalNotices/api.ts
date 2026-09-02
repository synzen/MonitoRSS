import fetchRest from "@/utils/fetchRest";
import { GetApplicableLegalNoticeOutput, LegalNoticeSchema } from "./types";

export const getApplicableLegalNotice = async ({
  localPreview,
}: {
  localPreview: boolean;
}): Promise<GetApplicableLegalNoticeOutput> => {
  const response = await fetchRest("/api/v1/legal-notices/applicable", {
    requestOptions: localPreview
      ? { headers: { "x-monitorss-legal-notice-preview": "true" } }
      : undefined,
    validateSchema: LegalNoticeSchema,
  });

  return response as GetApplicableLegalNoticeOutput;
};
