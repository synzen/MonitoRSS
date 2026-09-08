import { array, InferType, object, string } from "yup";

export const LegalNoticeSchema = object({
  result: object({
    version: string().required(),
    phase: string().oneOf(["upcoming", "updated"]).required(),
    summary: string().required(),
    documents: array(
      object({
        type: string().oneOf(["terms", "privacy-policy"]).required(),
        url: string().url().required(),
      }).required(),
    ).required(),
  })
    .nullable()
    .defined(),
  serverTime: string().required(),
  nextTransitionAt: string().nullable().defined(),
});

export type GetApplicableLegalNoticeOutput = InferType<typeof LegalNoticeSchema>;
