import { TestDeliveryStatus } from "../constants";

export class CreateTestArticleOutputDto {
  status: TestDeliveryStatus;
  apiPayload?: Record<string, unknown>;
  apiResponse?: unknown;
}
