import { array, InferType, number, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { DiscordRoleSchema } from "../types/DiscordRole";

export interface GetServerRolesInput {
  serverId: string;
}

const GetServersRolesOutputSchema = object({
  results: array(DiscordRoleSchema).required(),
  total: number().required(),
});

export type GetServerRolesOutput = InferType<typeof GetServersRolesOutputSchema>;

export const getServerRoles = async (
  options: GetServerRolesInput,
): Promise<GetServerRolesOutput> => {
  const res = await fetchRest(`/api/v1/discord-servers/${options.serverId}/roles`, {
    validateSchema: GetServersRolesOutputSchema,
  });

  return res as GetServerRolesOutput;
};
