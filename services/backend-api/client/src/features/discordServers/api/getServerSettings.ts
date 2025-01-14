import { bool, InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { DiscordServerSettingsSchema } from "../types";

export interface GetServerSettingsInput {
  serverId: string;
}

const GetServerSettingsOutputSchema = object({
  result: object({
    profile: DiscordServerSettingsSchema.required(),
    includesBot: bool().required(),
  }),
});

export type GetServerSettingsOutput = InferType<typeof GetServerSettingsOutputSchema>;

export const getServerSettings = async (
  options: GetServerSettingsInput
): Promise<GetServerSettingsOutput> => {
  const res = await fetchRest(`/api/v1/discord-servers/${options.serverId}`, {
    validateSchema: GetServerSettingsOutputSchema,
  });

  return res as GetServerSettingsOutput;
};
