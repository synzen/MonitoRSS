import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsString,
  ValidateNested,
} from "class-validator";

export enum UpdateUserFeedsOp {
  BulkDelete = "bulk-delete",
}

class DeleteUserFeedInputDataFeed {
  @IsString()
  @IsNotEmpty()
  id: string;
}

class DeleteUserFeedsInputData {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeleteUserFeedInputDataFeed)
  @IsObject({ each: true })
  feeds: DeleteUserFeedInputDataFeed[];
}

export class UpdateUserFeedsInput {
  @IsNotEmpty()
  @IsString()
  @IsIn(Object.values(UpdateUserFeedsOp))
  op: UpdateUserFeedsOp;

  @ValidateNested()
  @IsObject()
  @Type(() => DeleteUserFeedsInputData)
  data: DeleteUserFeedsInputData;
}
