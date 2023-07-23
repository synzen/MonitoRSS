import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsNotEmpty,
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
  @IsArray({ each: true })
  @ValidateNested()
  @Type(() => DeleteUserFeedInputDataFeed)
  feeds: DeleteUserFeedInputDataFeed[];
}

export class UpdateUserFeedsInput {
  @IsNotEmpty()
  @IsString()
  @IsIn(Object.values(UpdateUserFeedsOp))
  op: UpdateUserFeedsOp;

  @ValidateNested()
  @Type(() => DeleteUserFeedsInputData)
  data: DeleteUserFeedsInputData;
}
