import fetchRest from "@/utils/fetchRest";
import { GetApplicableLegalNoticeOutput, LegalNoticeSchema } from "./types";

export const getApplicableLegalNotice = async (): Promise<GetApplicableLegalNoticeOutput> => {
  const response = await fetchRest("/api/v1/legal-notices/applicable", {
    validateSchema: LegalNoticeSchema,
  });

  return response as GetApplicableLegalNoticeOutput;
};
