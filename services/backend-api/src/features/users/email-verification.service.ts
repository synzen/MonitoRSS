import { createHmac, hkdfSync, randomInt, timingSafeEqual } from "node:crypto";
import Handlebars from "handlebars";
import type { Config } from "../../config";
import type { SmtpTransport } from "../../infra/smtp";
import { createFromFormatter } from "../../infra/email-from";
import { createEmailRenderer, type RenderEmail } from "../../infra/email-render";
import type { IUserRepository } from "../../repositories/interfaces/user.types";
import type { EmailVerificationMongooseRepository } from "../../repositories/mongoose/email-verification.mongoose.repository";
import type { WorkspaceMongooseRepository } from "../../repositories/mongoose/workspace.mongoose.repository";
import type { PaddleService } from "../../services/paddle/paddle.service";
import { isBillingEnabled } from "../../shared/utils/billing";
import {
  ApiErrorCode,
  BadRequestError,
  ConflictError,
  ServiceUnavailableError,
  TooManyRequestsError,
} from "../../infra/error-handler";
import logger from "../../infra/logger";
import EMAIL_VERIFICATION_TEMPLATE from "./email-verification.template";
import VERIFIED_EMAIL_CHANGED_TEMPLATE from "./verified-email-changed.template";

const verificationTemplate = Handlebars.compile(EMAIL_VERIFICATION_TEMPLATE);
const verifiedEmailChangedTemplate = Handlebars.compile(
  VERIFIED_EMAIL_CHANGED_TEMPLATE,
);

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
// Cap on how many DISTINCT addresses a single user can have codes sent to within
// the window. Independent of the per-(user,email) cooldown and the IP-based
// route limit: bounds the "make MonitoRSS email arbitrary addresses" primitive
// regardless of IP. Re-sending to an already-targeted address is not counted.
const DISTINCT_TARGET_WINDOW_MS = 60 * 60 * 1000;
const MAX_DISTINCT_TARGETS = 5;

export interface EmailVerificationServiceDeps {
  config: Config;
  smtpTransport: SmtpTransport;
  emailVerificationRepository: EmailVerificationMongooseRepository;
  userRepository: IUserRepository;
  workspaceRepository: WorkspaceMongooseRepository;
  paddleService: PaddleService;
}

export class EmailVerificationService {
  private readonly otpKey: Buffer;

  private readonly renderEmail: RenderEmail;

  constructor(private readonly deps: EmailVerificationServiceDeps) {
    this.renderEmail = createEmailRenderer(deps.config);

    // Domain-separated subkey derived from the session secret: keeps OTP
    // hashing cryptographically independent of session signing (key separation)
    // without requiring a dedicated secret env var.
    this.otpKey = Buffer.from(
      hkdfSync(
        "sha256",
        deps.config.BACKEND_API_SESSION_SECRET,
        Buffer.alloc(0),
        "monitorss:email-verification-otp",
        32,
      ),
    );
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashCode(code: string): string {
    return createHmac("sha256", this.otpKey).update(code).digest("hex");
  }

  async sendCode(userId: string, rawEmail: string): Promise<void> {
    if (!this.deps.smtpTransport) {
      throw new ServiceUnavailableError(
        ApiErrorCode.EMAIL_VERIFICATION_UNAVAILABLE,
      );
    }

    const email = this.normalizeEmail(rawEmail);

    // Identity-based resend cooldown: bounds per-(user,email) send frequency
    // regardless of IP/proxy (which the IP rate-limit cannot under trustProxy).
    // The window is evaluated in-query against the DB clock $$NOW (see repo).
    if (
      await this.deps.emailVerificationRepository.hasRecentCode(
        userId,
        email,
        RESEND_COOLDOWN_MS,
      )
    ) {
      throw new TooManyRequestsError(
        ApiErrorCode.EMAIL_VERIFICATION_RESEND_TOO_SOON,
      );
    }

    // Distinct-target cap: re-sending to an address already targeted in the
    // window is always allowed (only the cooldown gates it); a NEW address is
    // blocked once the distinct count is at the cap.
    const alreadyTargeted =
      await this.deps.emailVerificationRepository.hasRecentTarget(
        userId,
        email,
        DISTINCT_TARGET_WINDOW_MS,
      );

    if (!alreadyTargeted) {
      const distinctTargets =
        await this.deps.emailVerificationRepository.countDistinctRecentTargets(
          userId,
          DISTINCT_TARGET_WINDOW_MS,
        );

      if (distinctTargets >= MAX_DISTINCT_TARGETS) {
        throw new TooManyRequestsError(
          ApiErrorCode.EMAIL_VERIFICATION_TOO_MANY_TARGETS,
        );
      }
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");

    await this.deps.emailVerificationRepository.createCode({
      userId,
      email,
      codeHash: this.hashCode(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });

    await this.deps.emailVerificationRepository.recordSend(userId, email);

    await this.deps.smtpTransport.sendMail({
      from: createFromFormatter(this.deps.config)("MonitoRSS", "noreply"),
      to: email,
      subject: "Verify your email for MonitoRSS",
      html: this.renderEmail(verificationTemplate, { code }),
    });
  }

  async confirm(userId: string, rawEmail: string, code: string): Promise<void> {
    const email = this.normalizeEmail(rawEmail);
    const record = await this.deps.emailVerificationRepository.findByUserEmail(
      userId,
      email,
    );

    if (!record) {
      throw new BadRequestError(ApiErrorCode.EMAIL_VERIFICATION_INVALID_CODE);
    }

    if (record.expiresAt.getTime() < Date.now()) {
      await this.deps.emailVerificationRepository.deleteForUserEmail(
        userId,
        email,
      );
      throw new BadRequestError(ApiErrorCode.EMAIL_VERIFICATION_EXPIRED);
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await this.deps.emailVerificationRepository.deleteForUserEmail(
        userId,
        email,
      );
      throw new TooManyRequestsError(
        ApiErrorCode.EMAIL_VERIFICATION_TOO_MANY_ATTEMPTS,
      );
    }

    if (!this.codesMatch(this.hashCode(code), record.codeHash)) {
      await this.deps.emailVerificationRepository.incrementAttempts(
        userId,
        email,
      );
      throw new BadRequestError(ApiErrorCode.EMAIL_VERIFICATION_INVALID_CODE);
    }

    let previousVerifiedEmail: string | null;
    try {
      ({ previousVerifiedEmail } = await this.deps.userRepository.setVerifiedEmail(
        userId,
        email,
      ));
    } catch (err) {
      if (this.isDuplicateKeyError(err)) {
        throw new ConflictError(ApiErrorCode.EMAIL_ALREADY_IN_USE);
      }
      throw err;
    }

    await this.deps.emailVerificationRepository.deleteForUserEmail(
      userId,
      email,
    );

    // The verified email is the billing identity of every workspace this user
    // owns, so move their Paddle customers to the new address. Best-effort: a
    // failure here must not roll back the verified-email change that committed.
    await this.syncOwnedWorkspaceBillingEmail(userId, email);

    // Notify the previous address that the verified email moved. Suppressed on
    // first-time verification (no previous address) and on idempotent
    // same-address re-verify (nothing changed). Best-effort: a send failure must
    // never fail or roll back the email change that already committed.
    if (previousVerifiedEmail && previousVerifiedEmail !== email) {
      await this.notifyVerifiedEmailChanged(previousVerifiedEmail, email);
    }
  }

  private async syncOwnedWorkspaceBillingEmail(
    userId: string,
    newEmail: string,
  ): Promise<void> {
    if (!isBillingEnabled(this.deps.config)) {
      return;
    }

    try {
      const customerIds =
        await this.deps.workspaceRepository.listOwnedActivePaddleCustomerIds(
          userId,
        );

      await Promise.all(
        customerIds.map((id) =>
          this.deps.paddleService.updateCustomer(id, { email: newEmail }),
        ),
      );
    } catch (err) {
      logger.error(
        "Failed to sync verified-email change to owned workspace Paddle customers",
        { stack: (err as Error).stack, userId },
      );
    }
  }

  private async notifyVerifiedEmailChanged(
    oldEmail: string,
    newEmail: string,
  ): Promise<void> {
    // Reaching confirm() implies a code was successfully sent, which requires a
    // configured transport (sendCode throws otherwise), so no extra
    // is-SMTP-configured guard is needed at this call site.
    try {
      await this.deps.smtpTransport!.sendMail({
        from: createFromFormatter(this.deps.config)("MonitoRSS", "noreply"),
        to: oldEmail,
        subject: "Your MonitoRSS verified email was changed",
        html: this.renderEmail(verifiedEmailChangedTemplate, {
          oldEmail,
          newEmail,
        }),
      });
    } catch (err) {
      logger.error(
        "Failed to send verified-email-changed notice to the previous address",
        { stack: (err as Error).stack },
      );
    }
  }

  private codesMatch(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }

  private isDuplicateKeyError(err: unknown): boolean {
    return (
      typeof err === "object" &&
      err !== null &&
      (err as { code?: number }).code === 11000
    );
  }
}
