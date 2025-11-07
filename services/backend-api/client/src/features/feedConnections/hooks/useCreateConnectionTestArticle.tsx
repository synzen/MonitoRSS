import { useMutation } from "@tanstack/react-query";
import { FeedConnectionType } from "../../../types";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import {
  CreateDiscordChannelConnectionPreviewInput,
  createDiscordChannelConnectionTestArticle,
  CreateDiscordChannelConnectionTestArticleOutput,
} from "../api";

interface CreateConnectionTestArticleInput {
  connectionType: FeedConnectionType;
  previewInput: CreateDiscordChannelConnectionPreviewInput;
}

export type CreateConnectionTestArticleOutput = CreateDiscordChannelConnectionTestArticleOutput;

const methodsByType: Record<
  FeedConnectionType,
  (
    input: CreateConnectionTestArticleInput["previewInput"]
  ) => Promise<CreateConnectionTestArticleOutput>
> = {
  [FeedConnectionType.DiscordChannel]: createDiscordChannelConnectionTestArticle,
};

export const useCreateConnectionTestArticle = () => {
  return useMutation<
    CreateConnectionTestArticleOutput,
    ApiAdapterError,
    CreateConnectionTestArticleInput
  >((details) => {
    const method = methodsByType[details.connectionType];

    return method(details.previewInput);
  });
};
