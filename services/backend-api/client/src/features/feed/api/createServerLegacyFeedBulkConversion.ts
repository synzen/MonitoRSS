import { InferType, number, object } from "yup";
import fetchRest from "../../../utils/fetchRest";

export interface CreateServerLegacyFeedBulkConversionInput {
  serverId: string;
}

const CreateServerLegacyFeedBulkConversionOutputSchema = object({
  total: number().required(),
}).required();

export type CreateServerLegacyFeedBulkConversionOutput = InferType<
  typeof CreateServerLegacyFeedBulkConversionOutputSchema
>;

export const createServerLegacyFeedBulkConversion = async (
  options: CreateServerLegacyFeedBulkConversionInput
): Promise<CreateServerLegacyFeedBulkConversionOutput> => {
  const res = await fetchRest(`/api/v1/discord-servers/${options.serverId}/legacy-conversion`, {
    validateSchema: CreateServerLegacyFeedBulkConversionOutputSchema,
    requestOptions: {
      method: "POST",
    },
  });

  return res as CreateServerLegacyFeedBulkConversionOutput;
};
