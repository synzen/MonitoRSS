import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { DiscordServerMemberSchema } from "../types/DiscordServerMember";

export interface GetServerMemberInput {
  serverId: string;
  memberId: string;
}

const GetServerMemberOutputSchema = object({
  result: DiscordServerMemberSchema.required(),
});

export type GetServerMemberOutput = InferType<typeof GetServerMemberOutputSchema>;

export const getServerMember = async (
  options: GetServerMemberInput,
): Promise<GetServerMemberOutput | null> => {
  const res = await fetchRest(
    `/api/v1/discord-servers/${options.serverId}/members/${options.memberId}`,
    {
      validateSchema: GetServerMemberOutputSchema,
    },
  );

  if (!res) {
    return null;
  }

  return res as GetServerMemberOutput;
};
