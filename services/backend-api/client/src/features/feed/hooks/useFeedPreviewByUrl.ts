import { useMutation } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  getFeedPreviewByUrl,
  GetFeedPreviewByUrlInput,
  GetFeedPreviewByUrlOutput,
} from "../api/getFeedPreviewByUrl";

export const useFeedPreviewByUrl = () => {
  const { mutateAsync, status, error, reset, data } = useMutation<
    GetFeedPreviewByUrlOutput,
    ApiAdapterError,
    GetFeedPreviewByUrlInput
  >((details) => getFeedPreviewByUrl(details));

  return {
    mutateAsync,
    status,
    error,
    reset,
    data,
  };
};
