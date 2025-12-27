import { useMutation } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import {
  SendTestArticleDirectInput,
  SendTestArticleDirectOutput,
  sendTestArticleDirect,
} from "../api";

export const useSendTestArticleDirect = () => {
  return useMutation<SendTestArticleDirectOutput, ApiAdapterError, SendTestArticleDirectInput>(
    (input) => sendTestArticleDirect(input)
  );
};
