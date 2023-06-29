import { IsOptional, IsString } from "class-validator";

export class GetServerActiveThreadsInputDto {
  @IsString()
  @IsOptional()
  parentChannelId?: string;
}
