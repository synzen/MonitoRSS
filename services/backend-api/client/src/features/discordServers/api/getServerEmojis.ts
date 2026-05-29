import { array, boolean, InferType, number, object, string } from "yup";
import fetchRest from "../../../utils/fetchRest";

export interface GetServerEmojisInput {
  serverId: string;
}

const DiscordEmojiSchema = object({
  id: string().required(),
  name: string().required(),
  animated: boolean().required(),
  imageUrl: string().required(),
});

const GetServerEmojisOutputSchema = object({
  results: array(DiscordEmojiSchema).required(),
  total: number().required(),
});

export type GetServerEmojisOutput = InferType<typeof GetServerEmojisOutputSchema>;
export type DiscordEmoji = InferType<typeof DiscordEmojiSchema>;

export const getServerEmojis = async (
  options: GetServerEmojisInput,
): Promise<GetServerEmojisOutput> => {
  const res = await fetchRest(`/api/v1/discord-servers/${options.serverId}/emojis`, {
    validateSchema: GetServerEmojisOutputSchema,
  });

  return res as GetServerEmojisOutput;
};
