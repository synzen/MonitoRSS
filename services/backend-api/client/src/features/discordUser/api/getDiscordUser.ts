import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { DiscordUserSchema } from "../types";

export interface GetDiscordUserInput {
  userId: string;
}

const GetDiscordUserOutputSchema = object({
  result: DiscordUserSchema,
});

export type GetDiscordUserOutput = InferType<typeof GetDiscordUserOutputSchema>;

export const getDiscordUser = async ({
  userId,
}: GetDiscordUserInput): Promise<GetDiscordUserOutput> => {
  const res = await fetchRest(`/api/v1/discord-users/${userId}`, {
    validateSchema: GetDiscordUserOutputSchema,
  });

  return res as GetDiscordUserOutput;
};
