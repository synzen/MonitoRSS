import { TestDeliveryStatus } from "../constants";

export class CreateTestArticleOutputDto {
  status: TestDeliveryStatus;
  apiResponse?: unknown;
}
