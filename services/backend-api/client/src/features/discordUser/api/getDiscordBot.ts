import { InferType, object } from 'yup';
import fetchRest from '../../../utils/fetchRest';
import { DiscordBotSchema } from '../types';

const GetBotOutputSchema = object({
  result: DiscordBotSchema,
});

export type GetDiscordBotOutput = InferType<typeof GetBotOutputSchema>;

export const getDiscordBot = async (): Promise<GetDiscordBotOutput> => {
  const res = await fetchRest(
    '/api/v1/discord-users/bot',
    {
      validateSchema: GetBotOutputSchema,
    },
  );

  return res as GetDiscordBotOutput;
};
