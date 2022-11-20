import fetchRest from '../../../utils/fetchRest';

export interface DeleteDiscordWebhookConnectionInput {
  feedId: string;
  connectionId: string
}

export const deleteDiscordWebhookConnection = async (
  options: DeleteDiscordWebhookConnectionInput,
): Promise<void> => {
  await fetchRest(
    `/api/v1/user-feeds/${options.feedId}/connections/discord-webhooks/${options.connectionId}`,
    {
      requestOptions: {
        method: 'DELETE',
      },
    },
  );
};
