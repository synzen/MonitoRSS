import { IsObject } from "class-validator";

export class FiltersDto {
  @IsObject()
  expression: Record<string, unknown>;
}
