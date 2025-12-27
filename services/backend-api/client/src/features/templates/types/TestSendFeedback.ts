import { SendTestArticleDeliveryStatus } from "@/types";

export interface TestSendFeedback {
  status: "success" | "error";
  message: string;
  deliveryStatus?: SendTestArticleDeliveryStatus;
  apiPayload?: Record<string, unknown>;
  apiResponse?: Record<string, unknown>;
}
