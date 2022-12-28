import { IsObject } from "class-validator";

export class CreateFeedFilterValidationInputDto {
  @IsObject()
  expression: Record<string, unknown>;
}
