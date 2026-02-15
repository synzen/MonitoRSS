import fetchRest from "../../../utils/fetchRest";
import { CopyableConnectionDiscordChannelSettings } from "../constants";

export interface CreateDiscordChannelConnectionCopySettingsInput {
  feedId: string;
  connectionId: string;
  details: {
    properties: CopyableConnectionDiscordChannelSettings[];
    targetDiscordChannelConnectionIds: string[];
  };
}

export const createDiscordChannelConnectionCopySettings = async (
  options: CreateDiscordChannelConnectionCopySettingsInput,
): Promise<void> => {
  await fetchRest(
    `/api/v1/user-feeds/${options.feedId}/connections/discord-channels/${options.connectionId}/copy-connection-settings`,
    {
      requestOptions: {
        method: "POST",
        body: JSON.stringify(options.details),
      },
    },
  );
};
