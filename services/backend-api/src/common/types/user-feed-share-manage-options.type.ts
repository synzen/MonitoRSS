import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsString, ValidateNested } from "class-validator";

class UserSchema {
  @IsString()
  @IsNotEmpty()
  discordUserId: string;
}

export class UserFeedShareManageOptions {
  @IsArray()
  @Type(() => UserSchema)
  @ValidateNested({ each: true })
  users: UserSchema[];
}
