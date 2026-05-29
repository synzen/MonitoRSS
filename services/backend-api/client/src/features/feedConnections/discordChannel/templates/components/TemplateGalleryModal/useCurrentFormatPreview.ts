import { useQuery } from "@tanstack/react-query";
import {
  CreateDiscordChannelConnectionPreviewInput,
  createDiscordChannelConnectionPreview,
} from "../../../connection/api";
import convertMessageBuilderStateToConnectionPreviewInput from "../../../messageBuilder/utils/convertMessageBuilderStateToConnectionPreviewInput";
import { UserFeed } from "@/features/feed";
import { FeedDiscordChannelConnection } from "@/types";
import { MessageComponentRoot } from "../../../messageBuilder/types";

export interface UseCurrentFormatPreviewParams {
  currentMessageComponent?: MessageComponentRoot;
  articleId?: string;
  feedId: string;
  connectionId?: string;
  userFeed?: UserFeed;
  connection?: FeedDiscordChannelConnection;
  enabled: boolean;
}

export const useCurrentFormatPreview = ({
  currentMessageComponent,
  articleId,
  feedId,
  connectionId,
  userFeed,
  connection,
  enabled,
}: UseCurrentFormatPreviewParams) => {
  return useQuery({
    queryKey: ["current-format-preview", articleId, feedId, connectionId],
    queryFn: async () => {
      if (!currentMessageComponent || !articleId || !connectionId || !userFeed || !connection) {
        return null;
      }

      const previewInputData = convertMessageBuilderStateToConnectionPreviewInput(
        userFeed,
        connection,
        currentMessageComponent,
      );

      const input: CreateDiscordChannelConnectionPreviewInput = {
        feedId,
        connectionId,
        data: {
          article: { id: articleId },
          ...previewInputData,
        },
      };

      return createDiscordChannelConnectionPreview(input);
    },
    enabled: enabled && !!currentMessageComponent && !!articleId && !!connectionId,
    staleTime: 30000,
  });
};
