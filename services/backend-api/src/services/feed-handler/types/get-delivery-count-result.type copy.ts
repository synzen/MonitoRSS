import { Type } from "class-transformer";
import { IsInt, IsObject, ValidateNested } from "class-validator";

class Result {
  @IsInt()
  count: number;
}

export class GetDeliveryCountResult {
  @IsObject()
  @Type(() => Result)
  @ValidateNested()
  result: Result;
}
