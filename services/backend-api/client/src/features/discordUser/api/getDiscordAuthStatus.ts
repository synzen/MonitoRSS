import { bool, InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";

const GetDiscordAuthStatusOutputSchema = object({
  authenticated: bool().required(),
}).required();

export type GetDiscordAuthStatusOutput = InferType<typeof GetDiscordAuthStatusOutputSchema>;

export const getDiscordAuthStatus = async (): Promise<GetDiscordAuthStatusOutput> => {
  const res = await fetchRest("/api/v1/discord-users/@me/auth-status", {
    validateSchema: GetDiscordAuthStatusOutputSchema,
  });

  return res as GetDiscordAuthStatusOutput;
};
