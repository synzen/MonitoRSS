import { IsIn, IsObject, IsOptional } from "class-validator";
import { TestDeliveryStatus } from "../constants";

export class SendTestArticleResult {
  @IsIn(Object.values(TestDeliveryStatus))
  status: TestDeliveryStatus;

  @IsObject()
  @IsOptional()
  apiResponse?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  apiPayload?: Record<string, unknown>;
}
