import { IsIn } from "class-validator";
import { TestDeliveryStatus } from "../constants";

export class SendTestArticleResult {
  @IsIn(Object.values(TestDeliveryStatus))
  status: TestDeliveryStatus;

  apiResponse?: unknown;
}
