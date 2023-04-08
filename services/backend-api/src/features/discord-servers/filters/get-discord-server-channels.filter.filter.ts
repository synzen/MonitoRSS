import { Catch, HttpStatus } from "@nestjs/common";
import { ApiErrorCode } from "../../../common/constants/api-errors";
import { StandardException } from "../../../common/exceptions/standard-exception.exception";
import { StandardBaseExceptionFilter } from "../../../common/filters/standard-exception-filter";
import { DiscordServerNotFoundException } from "../exceptions/discord-server-not-found.exception";

const ERROR_CODES: Record<string, { status: HttpStatus; code: ApiErrorCode }> =
  {
    [DiscordServerNotFoundException.name]: {
      status: HttpStatus.NOT_FOUND,
      code: ApiErrorCode.DISCORD_SERVER_NOT_FOUND,
    },
  };

@Catch(StandardException)
export class GetDiscordServerChannelsFilter extends StandardBaseExceptionFilter {
  exceptions = ERROR_CODES;
}
