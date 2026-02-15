import { array, InferType, number, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { DiscordServerMemberSchema } from "../types/DiscordServerMember";

export interface GetServerMembersInput {
  serverId: string;
  data: {
    limit: number;
    search?: string;
  };
}

const GetServerMembersOutputSchema = object({
  results: array(DiscordServerMemberSchema).required(),
  total: number().required(),
});

export type GetServerMembersOutput = InferType<typeof GetServerMembersOutputSchema>;

export const getServerMembers = async (
  options: GetServerMembersInput,
): Promise<GetServerMembersOutput> => {
  const params = new URLSearchParams({
    limit: options.data.limit.toString(),
    search: options.data.search || "",
  });

  const res = await fetchRest(
    `/api/v1/discord-servers/${options.serverId}/members?${params.toString()}`,
    {
      validateSchema: GetServerMembersOutputSchema,
    },
  );

  return res as GetServerMembersOutput;
};
