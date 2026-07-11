import {
  ApiErrorCode,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../infra/error-handler";
import logger from "../../infra/logger";
import type { Config } from "../../config";
import { isBillingEnabled } from "../../shared/utils/billing";
import { SubscriptionStatus } from "../../repositories/shared/enums";
import type { IUserRepository } from "../../repositories/interfaces/user.types";
import type { ISupporterRepository } from "../../repositories/interfaces/supporter.types";
import type { IPatronRepository } from "../../repositories/interfaces/patron.types";
import type { IUserFeedLimitOverrideRepository } from "../../repositories/interfaces/user-feed-limit-override.types";
import type { EmailVerificationService } from "../users/email-verification.service";
import type { WorkspacesService } from "../workspaces/workspaces.service";
import type { UsersService } from "../../services/users/users.service";
import type { UserFeedsService } from "../../services/user-feeds/user-feeds.service";
import type { SupportersService } from "../../services/supporters/supporters.service";

export interface AccountServiceDeps {
  config: Config;
  userRepository: IUserRepository;
  emailVerificationService: EmailVerificationService;
  usersService: UsersService;
  userFeedsService: UserFeedsService;
  workspacesService: WorkspacesService;
  supportersService: SupportersService;
  userFeedLimitOverrideRepository: IUserFeedLimitOverrideRepository;
  supporterRepository: ISupporterRepository;
  patronRepository: IPatronRepository;
}

// Orchestrates GDPR right-to-erasure for a user. It knows the cascade order and
// rules and delegates each category of deletion to the feature that owns that
// data; it never reaches into another feature's repository directly. The
// external Reddit revoke has no distributed transaction with the local deletes,
// so the whole sequence is idempotent: re-running completes whatever remains.
export class AccountService {
  constructor(private readonly deps: AccountServiceDeps) {}

  // Sends a fresh verification code to the user's verified email to confirm the
  // irreversible deletion. Refuses if the user has no verified email (there is
  // no mailbox to prove control of). The deletion blockers run here too, so a
  // blocked user is told at the first step instead of receiving a deletion code
  // for an attempt that cannot succeed.
  async sendDeletionCode(discordUserId: string): Promise<void> {
    const user = await this.deps.userRepository.findByDiscordId(discordUserId);

    if (!user) {
      throw new NotFoundError(ApiErrorCode.USER_NOT_FOUND);
    }

    if (!user.verifiedEmail) {
      throw new ForbiddenError(ApiErrorCode.EMAIL_NOT_VERIFIED);
    }

    await this.deps.workspacesService.assertNotSoleWorkspaceOwner(user.id);
    await this.assertNoActiveSubscription(user.discordUserId);

    await this.deps.emailVerificationService.sendCode(
      user.id,
      user.verifiedEmail,
      "account-deletion",
    );
  }

  // Confirms identity with the OTP, then runs the full erasure cascade.
  async deleteAccountWithVerification(
    discordUserId: string,
    code: string,
  ): Promise<void> {
    const user = await this.deps.userRepository.findByDiscordId(discordUserId);

    if (!user) {
      throw new NotFoundError(ApiErrorCode.USER_NOT_FOUND);
    }

    if (!user.verifiedEmail) {
      throw new ForbiddenError(ApiErrorCode.EMAIL_NOT_VERIFIED);
    }

    // Blockers run before the OTP is consumed so a blocked user can resolve
    // them and retry without re-requesting a code. They also ran at send time,
    // but state can change in between and API callers can skip the send step.
    await this.deps.workspacesService.assertNotSoleWorkspaceOwner(user.id);
    await this.assertNoActiveSubscription(user.discordUserId);

    await this.deps.emailVerificationService.verifyCodeOnly(
      user.id,
      user.verifiedEmail,
      code,
      "account-deletion",
    );

    await this.deleteAccount(discordUserId);
  }

  // The erasure cascade, callable directly (idempotent). Resolves the user
  // fresh so a re-run after the user doc is already gone is a clean no-op.
  // Order: sole-owner pre-check, Reddit revoke (external, before local
  // deletes), then the local cascade, then the user document last.
  async deleteAccount(discordUserId: string): Promise<void> {
    const user = await this.deps.userRepository.findByDiscordId(discordUserId);

    if (!user) {
      // Already erased (or never existed): nothing left to do.
      return;
    }

    await this.deps.workspacesService.assertNotSoleWorkspaceOwner(user.id);
    await this.assertNoActiveSubscription(user.discordUserId);

    logger.info("Starting account erasure", { userId: user.id });

    const redditDisconnected = await this.deps.usersService.disconnectReddit(
      user.id,
    );

    logger.info("Account erasure: reddit grant handled", {
      userId: user.id,
      redditDisconnected,
    });

    const feedsDeleted =
      await this.deps.userFeedsService.deletePersonalFeedsForUser(
        user.discordUserId,
      );

    await this.deps.userFeedsService.removeCoManageInvitesForUser(
      user.discordUserId,
    );

    logger.info("Account erasure: personal feeds deleted", {
      userId: user.id,
      feedsDeleted,
    });

    await this.deps.workspacesService.removeUserFromAllWorkspaces(
      user.id,
      user.verifiedEmail,
    );

    logger.info("Account erasure: workspace records removed", {
      userId: user.id,
    });

    await this.deps.supportersService.stripBillingEmailForUser(
      user.discordUserId,
    );

    await this.deps.userFeedLimitOverrideRepository.deleteById(
      user.discordUserId,
    );

    await this.deps.emailVerificationService.deleteAllForUser(user.id);

    logger.info("Account erasure: billing email, override and codes cleared", {
      userId: user.id,
    });

    // The user document last: removes email, verifiedEmail, discordUserId,
    // preferences, and the embedded Reddit tokens in one operation.
    await this.deps.usersService.deleteUser(user.id);

    logger.info("Account erasure complete: user document deleted", {
      userId: user.id,
    });
  }

  // A live personal Paddle subscription blocks deletion: erasure would destroy
  // the only place that surfaces the subscription while Paddle keeps billing.
  // Mirrors the workspace-deletion guard: a subscription already scheduled to
  // cancel (cancellationDate set) no longer blocks, and a fully cancelled one
  // is nullified off the supporter by the webhook. Patreon pledges never block;
  // they are managed entirely on Patreon and our pledge data may be stale.
  private async assertNoActiveSubscription(discordUserId: string): Promise<void> {
    if (!isBillingEnabled(this.deps.config)) {
      return;
    }

    const supporter = await this.deps.supporterRepository.findById(
      discordUserId,
    );
    const subscription = supporter?.paddleCustomer?.subscription;

    if (
      subscription &&
      subscription.status !== SubscriptionStatus.Cancelled &&
      !subscription.cancellationDate
    ) {
      throw new ConflictError(ApiErrorCode.ACCOUNT_DELETE_ACTIVE_SUBSCRIPTION);
    }
  }
}
