import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { FeedConnectionMentionType } from "../../features/feeds/constants";
import { FiltersDto } from "./filters.type";

class MentionTargetDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsIn(Object.values(FeedConnectionMentionType))
  type: FeedConnectionMentionType;

  @IsObject()
  @IsOptional()
  @Type(() => FiltersDto)
  @ValidateNested({ each: true })
  filters?: FiltersDto;
}

export class MentionsOptionsDto {
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MentionTargetDto)
  targets?: MentionTargetDto[] | null;
}
