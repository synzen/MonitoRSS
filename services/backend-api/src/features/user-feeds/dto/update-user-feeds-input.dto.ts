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
  BulkDisable = "bulk-disable",
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

class DisableUserFeedsInputData {
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
  @Type((data) => {
    if (data?.object.op === UpdateUserFeedsOp.BulkDelete) {
      return DeleteUserFeedsInputData;
    }

    if (data?.object.op === UpdateUserFeedsOp.BulkDisable) {
      return DisableUserFeedsInputData;
    }

    throw new Error("Invalid type");
  })
  data: DeleteUserFeedsInputData | DisableUserFeedsInputData;
}
