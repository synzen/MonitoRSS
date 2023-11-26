import { Type } from "class-transformer";
import {
  IsArray,
  IsObject,
  IsOptional,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { CustomPlaceholderDto } from "../../../common";

export class GetUserFeedArticlePropertiesInputDto {
  @IsObject({ each: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomPlaceholderDto)
  @ValidateIf((v) => v.customPlaceholders !== null)
  customPlaceholders?: CustomPlaceholderDto[] | null;
}
