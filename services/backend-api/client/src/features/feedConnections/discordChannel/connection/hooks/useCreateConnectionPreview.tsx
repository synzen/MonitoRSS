import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CreatePreviewResult, FeedConnectionType } from "@/types";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  CreateDiscordChannelConnectionPreviewInput,
  createDiscordChannelConnectionPreview,
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
};

export const useCreateConnectionPreview = (
  type: FeedConnectionType,
  inputData: CreateConnectionPreviewInput,
) => {
  const { status, data, fetchStatus, error } = useQuery<
    CreateConnectionPreviewOutput,
    ApiAdapterError
  >({
    queryKey: ["connection-preview", { type, inputData }],
    queryFn: () => {
      const method = methodsByType[type];

      return method(inputData.data);
    },
    enabled: inputData.enabled,
    placeholderData: keepPreviousData,
  });

  return {
    data,
    status,
    fetchStatus,
    error,
  };
};
