import { InferType, number, object } from "yup";
import fetchRest from "../../../utils/fetchRest";

export interface GetArticleDailyLimitInput {
  feedId: string;
}

const GetArticleDailyLimitSchema = object({
  result: object({
    current: number().required(),
    max: number().required(),
  }).required(),
}).required();

export type GetArticleDailyLimitOutput = InferType<typeof GetArticleDailyLimitSchema>;

export const getArticleDailyLimit = async (
  options: GetArticleDailyLimitInput,
): Promise<GetArticleDailyLimitOutput> => {
  const res = await fetchRest(`/api/v1/user-feeds/${options.feedId}/daily-limit`, {
    validateSchema: GetArticleDailyLimitSchema,
  });

  return res as GetArticleDailyLimitOutput;
};
