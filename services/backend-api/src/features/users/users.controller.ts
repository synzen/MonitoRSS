import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  ValidationPipe,
} from "@nestjs/common";
import { NestedQuery } from "../../common/decorators/NestedQuery";
import { TransformValidationPipe } from "../../common/pipes/TransformValidationPipe";
import { CreditBalanceDetails } from "../../common/types/credit-balance-details.type";
import { SubscriptionDetails } from "../../common/types/subscription-details.type";
import { DiscordAccessToken } from "../discord-auth/decorators/DiscordAccessToken";
import { SessionAccessToken } from "../discord-auth/types/SessionAccessToken.type";
import { GetUserMeInputDto } from "./dto/get-user-me-input.dto ";
import { UpdateMeDto } from "./dto/update-me-input.dto";
import { User } from "./entities/user.entity";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("@me")
  async getMe(
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken,
    @NestedQuery(TransformValidationPipe)
    { includeManageSubUrls }: GetUserMeInputDto
  ) {
    const user = await this.usersService.getByDiscordId(discordUserId, {
      includeSubscriptionManagementUrls: includeManageSubUrls,
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.formatUserMe(user);
  }

  @Patch("@me")
  async updateMe(
    @DiscordAccessToken()
    { discord: { id: discordUserId } }: SessionAccessToken,
    @Body(ValidationPipe) updateMeInput: UpdateMeDto
  ) {
    const user = await this.usersService.updateUserByDiscordId(
      discordUserId,
      updateMeInput
    );

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.formatUserMe(user);
  }

  private formatUserMe({
    user,
    subscription,
    creditBalance,
  }: {
    user: User;
    creditBalance: CreditBalanceDetails;
    subscription: SubscriptionDetails;
  }) {
    return {
      result: {
        id: user._id,
        discordUserId: user.discordUserId,
        email: user.email,
        preferences: user.preferences,
        subscription,
        creditBalance,
      },
    };
  }
}
