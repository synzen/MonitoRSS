import fetchRest from "../../../utils/fetchRest";

export interface DeleteDiscordChannelConnectionInput {
  feedId: string;
  connectionId: string;
}

export const deleteDiscordChannelConnection = async (
  options: DeleteDiscordChannelConnectionInput,
): Promise<void> => {
  await fetchRest(
    `/api/v1/user-feeds/${options.feedId}/connections/discord-channels/${options.connectionId}`,
    {
      requestOptions: {
        method: "DELETE",
      },
    },
  );
};
