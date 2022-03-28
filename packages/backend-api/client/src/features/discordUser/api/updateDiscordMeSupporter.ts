import fetchRest from '../../../utils/fetchRest';

export interface UpdateDiscordMeSupporterInput {
  details: {
    guildIds: string[]
  }
}

export const updateDiscordMeSupporter = async (
  { details }: UpdateDiscordMeSupporterInput,
): Promise<void> => {
  await fetchRest(
    '/api/v1/discord-users/@me/supporter',
    {
      requestOptions: {
        method: 'PATCH',
        body: JSON.stringify(details),
      },
      skipJsonParse: true,
    },
  );
};
