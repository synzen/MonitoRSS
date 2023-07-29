import { InferType, number, object } from "yup";
import fetchRest from "../../../utils/fetchRest";

export interface GetLegacyFeedCountInput {
  serverId: string;
}

const GetLegacyFeedCountOutputSchema = object({
  result: object({
    total: number().required(),
  }).required(),
}).required();

export type GetLegacyFeedCountOutput = InferType<typeof GetLegacyFeedCountOutputSchema>;

export const GetLegacyFeedCount = async (
  options: GetLegacyFeedCountInput
): Promise<GetLegacyFeedCountOutput> => {
  const res = await fetchRest(`/api/v1/discord-servers/${options.serverId}/legacy-feed-count`, {
    validateSchema: GetLegacyFeedCountOutputSchema,
  });

  return res as GetLegacyFeedCountOutput;
};
