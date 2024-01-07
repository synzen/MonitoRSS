import { Type } from "class-transformer";
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from "class-validator";

class UpdateUserFeedManagementInviteConnectionInputDto {
  @IsString()
  @IsNotEmpty()
  connectionId: string;
}

export class UpdateUserFeedManagementInviteInputDto {
  @IsArray()
  @Type(() => UpdateUserFeedManagementInviteConnectionInputDto)
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @ValidateIf((data) => data?.connections !== null)
  @IsOptional()
  connections?: Array<UpdateUserFeedManagementInviteConnectionInputDto> | null;
}
