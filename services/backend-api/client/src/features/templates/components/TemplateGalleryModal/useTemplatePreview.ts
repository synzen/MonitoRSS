import { useQuery } from "@tanstack/react-query";
import {
  CreateDiscordChannelConnectionPreviewInput,
  createDiscordChannelConnectionPreview,
  createTemplatePreview,
  CreateTemplatePreviewInput,
} from "../../../feedConnections/api";
import convertMessageBuilderStateToConnectionPreviewInput from "../../../../pages/MessageBuilder/utils/convertMessageBuilderStateToConnectionPreviewInput";
import { UserFeed } from "../../../feed";
import { FeedDiscordChannelConnection } from "../../../../types";
import { DetectedFields, Template } from "../../types";
import { convertTemplateMessageComponentToPreviewInput } from "./templatePreviewUtils";

export interface UseTemplatePreviewParams {
  template: Template | undefined;
  articleId: string | undefined;
  feedId: string;
  connectionId?: string;
  userFeed?: UserFeed;
  connection?: FeedDiscordChannelConnection;
  detectedFields: DetectedFields;
  enabled: boolean;
}

export const useTemplatePreview = ({
  template,
  articleId,
  feedId,
  connectionId,
  userFeed,
  connection,
  detectedFields,
  enabled,
}: UseTemplatePreviewParams) => {
  return useQuery({
    queryKey: ["template-preview", template?.id, articleId, feedId, connectionId],
    queryFn: async () => {
      if (!template || !articleId) {
        return null;
      }

      const messageComponent = template.createMessageComponent(detectedFields);

      if (connectionId && userFeed && connection) {
        const previewInputData = convertMessageBuilderStateToConnectionPreviewInput(
          userFeed,
          connection,
          messageComponent
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
      }

      const previewInputData = convertTemplateMessageComponentToPreviewInput(messageComponent);

      const input: CreateTemplatePreviewInput = {
        feedId,
        data: {
          article: { id: articleId },
          ...previewInputData,
        },
      };

      return createTemplatePreview(input);
    },
    enabled: enabled && !!template && !!articleId && !!feedId,
    staleTime: 30000,
  });
};
