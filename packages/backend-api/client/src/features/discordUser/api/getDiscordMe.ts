import { InferType } from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { DiscordUserSchema } from '../types';

const GetDiscordMeOutputSchema = DiscordUserSchema;

export type GetDiscordMeOutput = InferType<typeof GetDiscordMeOutputSchema>;

export const getDiscordMe = async (): Promise<GetDiscordMeOutput> => fetchRest(
  '/api/v1/discord-users/@me',
  {
    validateSchema: GetDiscordMeOutputSchema,
  },
);
