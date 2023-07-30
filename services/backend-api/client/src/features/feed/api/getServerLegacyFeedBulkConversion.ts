import { InferType, array, number, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";

export interface GetServerLegacyFeedBulkConversionInput {
  serverId: string;
}

const GetServerLegacyFeedBulkConversionOutputSchema = object({
  counts: object({
    notStarted: number().required(),
    inProgress: number().required(),
    completed: number().required(),
    failed: number().required(),
  }).required(),
  failedFeeds: array(
    object({
      _id: string().required(),
      title: string().required(),
      url: string().required(),
      failReasonPublic: string().optional(),
    }).required()
  ).required(),
  status: string().oneOf(["NOT_STARTED", "COMPLETED", "IN_PROGRESS"]).required(),
}).required();

export type GetServerLegacyFeedBulkConversionOutput = InferType<
  typeof GetServerLegacyFeedBulkConversionOutputSchema
>;

export const getServerLegacyFeedBulkConversion = async (
  options: GetServerLegacyFeedBulkConversionInput
): Promise<GetServerLegacyFeedBulkConversionOutput> => {
  const res = await fetchRest(`/api/v1/discord-servers/${options.serverId}/legacy-conversion`, {
    validateSchema: GetServerLegacyFeedBulkConversionOutputSchema,
  });

  return res as GetServerLegacyFeedBulkConversionOutput;
};
