import { useMutation } from "@tanstack/react-query";
import { FeedConnectionType, SendTestArticleDeliveryStatus } from "../../../types";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import {
  CreateDiscordChannelConnectionPreviewInput,
  createDiscordChannelConnectionTestArticle,
} from "../api";

interface CreateConnectionTestArticleInput {
  connectionType: FeedConnectionType;
  previewInput: CreateDiscordChannelConnectionPreviewInput;
}

interface CreateConnectionTestArticleOutput {
  result: {
    status: SendTestArticleDeliveryStatus;
    apiResponse?: Record<string, unknown>;
    apiPayload?: Record<string, unknown>;
  };
}

const methodsByType: Record<
  FeedConnectionType,
  (
    input: CreateConnectionTestArticleInput["previewInput"]
  ) => Promise<CreateConnectionTestArticleOutput>
> = {
  [FeedConnectionType.DiscordChannel]: createDiscordChannelConnectionTestArticle,
};

export const useCreateConnectionTestArticle = () => {
  const { mutateAsync, status } = useMutation<
    CreateConnectionTestArticleOutput,
    ApiAdapterError,
    CreateConnectionTestArticleInput
  >((details) => {
    const method = methodsByType[details.connectionType];

    return method(details.previewInput);
  });

  return {
    mutateAsync,
    status,
  };
};
