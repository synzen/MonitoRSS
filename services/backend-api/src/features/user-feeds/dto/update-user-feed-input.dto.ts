import { IsIn, IsNotEmpty, IsOptional, IsString, IsUrl } from "class-validator";
import { UserFeedDisabledCode } from "../types";

export class UpdateUserFeedInputDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  title?: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  @IsOptional()
  url?: string;

  @IsIn([UserFeedDisabledCode.Manual, null])
  @IsOptional()
  disabledCode?: UserFeedDisabledCode | null;

  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @IsOptional()
  passingComparisons?: string[];

  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @IsOptional()
  blockingComparisons?: string[];
}
