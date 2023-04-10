import { useQuery } from "@tanstack/react-query";
import { CreatePreviewResult, FeedConnectionType } from "../../../types";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import {
  CreateDiscordChannelConnectionPreviewInput,
  createDiscordChannelConnectionPreview,
  createDiscordWebhookConnectionPreview,
} from "../api";

interface CreateConnectionPreviewInput {
  enabled?: boolean;
  data: CreateDiscordChannelConnectionPreviewInput;
}

interface CreateConnectionPreviewOutput {
  result: CreatePreviewResult;
}

const methodsByType: Record<
  FeedConnectionType,
  (input: CreateDiscordChannelConnectionPreviewInput) => Promise<CreateConnectionPreviewOutput>
> = {
  [FeedConnectionType.DiscordChannel]: createDiscordChannelConnectionPreview,
  [FeedConnectionType.DiscordWebhook]: createDiscordWebhookConnectionPreview,
};

export const useCreateConnectionPreview = (
  type: FeedConnectionType,
  inputData: CreateConnectionPreviewInput
) => {
  const { status, data, fetchStatus } = useQuery<CreateConnectionPreviewOutput, ApiAdapterError>(
    ["connection-preview", { type, inputData }],
    () => {
      const method = methodsByType[type];

      return method(inputData.data);
    },
    {
      enabled: inputData.enabled,
      keepPreviousData: true,
    }
  );

  return {
    data,
    status,
    fetchStatus,
  };
};
