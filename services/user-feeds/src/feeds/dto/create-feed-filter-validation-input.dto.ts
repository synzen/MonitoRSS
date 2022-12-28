import { IsObject } from "class-validator";

export class CreateFeedFilterValidationInputDto {
  @IsObject()
  filters: Record<string, unknown>;
}
