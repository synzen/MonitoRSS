import { useMutation } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  getCuratedFeedPreview,
  GetCuratedFeedPreviewInput,
  GetCuratedFeedPreviewOutput,
} from "../api/getCuratedFeedPreview";

export const useCuratedFeedPreview = () => {
  const { mutateAsync, status, error, reset, data } = useMutation<
    GetCuratedFeedPreviewOutput,
    ApiAdapterError,
    GetCuratedFeedPreviewInput
  >((details) => getCuratedFeedPreview(details));

  return {
    mutateAsync,
    status,
    error,
    reset,
    data,
  };
};
