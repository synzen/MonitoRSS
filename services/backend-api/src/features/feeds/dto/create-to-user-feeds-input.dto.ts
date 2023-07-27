import { IsArray, IsString } from "class-validator";

export class ConvertToUserFeedsInputDto {
  @IsArray()
  @IsString({ each: true })
  feedIds: string[];
}
