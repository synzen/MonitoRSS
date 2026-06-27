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
import VERIFIED_EMAIL_REVERTED_TEMPLATE from "./verified-email-reverted.template";

const verificationTemplate = Handlebars.compile(EMAIL_VERIFICATION_TEMPLATE);
const verifiedEmailChangedTemplate = Handlebars.compile(
  VERIFIED_EMAIL_CHANGED_TEMPLATE,
);
const verifiedEmailRevertedTemplate = Handlebars.compile(
  VERIFIED_EMAIL_REVERTED_TEMPLATE,
);

const CODE_TTL_MS = 10 * 60 * 1000;
// Revert-link lifetime: long enough that an infrequent email-checker still
// catches a takeover notice spanning a weekend, short enough that the token
// (which carries PII and grants a session-invalidating action) is not retained
// indefinitely.
const REVERT_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;
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

  private readonly revertKey: Buffer;

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

    // Separate subkey for revert-link tokens, independent of the OTP key.
    this.revertKey = Buffer.from(
      hkdfSync(
        "sha256",
        deps.config.BACKEND_API_SESSION_SECRET,
        Buffer.alloc(0),
        "monitorss:verified-email-revert",
        32,
      ),
    );
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private signWith(key: Buffer, value: string): string {
    return createHmac("sha256", key).update(value).digest("hex");
  }

  private hashCode(code: string): string {
    return this.signWith(this.otpKey, code);
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

    // Security-relevant change: a structured record for after-the-fact takeover
    // investigation, governed by log retention rather than a queryable PII table.
    logger.info("Verified email changed", {
      userId,
      hadPreviousVerifiedEmail: previousVerifiedEmail !== null,
    });

    // The verified email is the billing identity of every workspace this user
    // owns, so move their Paddle customers to the new address. Best-effort: a
    // failure here must not roll back the verified-email change that committed.
    await this.syncOwnedWorkspaceBillingEmail(userId, email);

    // Notify the previous address that the verified email moved. Suppressed on
    // first-time verification (no previous address) and on idempotent
    // same-address re-verify (nothing changed). Best-effort: a send failure must
    // never fail or roll back the email change that already committed.
    if (previousVerifiedEmail && previousVerifiedEmail !== email) {
      await this.notifyVerifiedEmailChanged(
        userId,
        previousVerifiedEmail,
        email,
      );
    }
  }

  async createRevertToken(
    userId: string,
    oldEmail: string,
    newEmail: string,
    options: { ttlMs?: number } = {},
  ): Promise<string> {
    const payload = JSON.stringify({
      u: userId,
      o: this.normalizeEmail(oldEmail),
      n: this.normalizeEmail(newEmail),
      exp: Date.now() + (options.ttlMs ?? REVERT_TOKEN_TTL_MS),
    });
    const body = Buffer.from(payload).toString("base64url");
    const sig = this.signRevertBody(body);
    return `${body}.${sig}`;
  }

  async revertVerifiedEmail(rawToken: string): Promise<void> {
    const [body, sig] = rawToken.split(".");

    if (!body || !sig || !this.codesMatch(this.signRevertBody(body), sig)) {
      throw new BadRequestError(ApiErrorCode.EMAIL_VERIFICATION_INVALID_CODE);
    }

    let userId: string;
    let oldEmail: string;
    let newEmail: string;
    let exp: number;
    try {
      ({
        u: userId,
        o: oldEmail,
        n: newEmail,
        exp,
      } = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
        u: string;
        o: string;
        n: string;
        exp: number;
      });
    } catch {
      // A signed body that does not decode to the expected JSON is as good as an
      // invalid token; return the same 400 as a bad signature rather than a 500.
      throw new BadRequestError(ApiErrorCode.EMAIL_VERIFICATION_INVALID_CODE);
    }

    if (typeof exp !== "number" || Date.now() > exp) {
      throw new BadRequestError(ApiErrorCode.EMAIL_VERIFICATION_EXPIRED);
    }

    let reverted: boolean;
    try {
      ({ reverted } = await this.deps.userRepository.revertVerifiedEmail(
        userId,
        newEmail,
        oldEmail,
      ));
    } catch (err) {
      // The restored address may have been verified by another account since the
      // change, tripping the unique index. Surface a clean conflict like confirm()
      // does rather than a 500.
      if (this.isDuplicateKeyError(err)) {
        throw new ConflictError(ApiErrorCode.EMAIL_ALREADY_IN_USE);
      }
      throw err;
    }

    // A no-op revert means a newer change already moved the verified email off
    // the value this link targeted, so the link no longer applies. Surface it as
    // an error so the page does not falsely claim the change was undone.
    if (!reverted) {
      throw new ConflictError(
        ApiErrorCode.EMAIL_VERIFICATION_REVERT_SUPERSEDED,
      );
    }

    // Move the billing identity back to the restored address, mirroring the
    // forward sync in confirm(). Best-effort: a failure must not undo the revert.
    await this.syncOwnedWorkspaceBillingEmail(userId, oldEmail);

    // Notify the restored address (the person who clicked revert) that the change
    // was undone. The displaced address is deliberately not notified: in a
    // takeover it is the attacker's, and emailing it would both tip them off and
    // disclose the restored address.
    await this.notifyVerifiedEmailReverted(oldEmail);
  }

  private async notifyVerifiedEmailReverted(
    restoredEmail: string,
  ): Promise<void> {
    try {
      await this.deps.smtpTransport!.sendMail({
        from: createFromFormatter(this.deps.config)("MonitoRSS", "noreply"),
        to: restoredEmail,
        subject: "Your MonitoRSS verified email change was reverted",
        html: this.renderEmail(verifiedEmailRevertedTemplate, {
          restoredEmail,
        }),
      });
    } catch (err) {
      logger.error("Failed to send verified-email-reverted notice", {
        stack: (err as Error).stack,
      });
    }
  }

  private signRevertBody(body: string): string {
    return this.signWith(this.revertKey, body);
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
    userId: string,
    oldEmail: string,
    newEmail: string,
  ): Promise<void> {
    // Reaching confirm() implies a code was successfully sent, which requires a
    // configured transport (sendCode throws otherwise), so no extra
    // is-SMTP-configured guard is needed at this call site.
    const token = await this.createRevertToken(userId, oldEmail, newEmail);
    // Points at a frontend confirm page (not the API directly) so the action is
    // a deliberate POST from that page rather than a GET that email scanners or
    // link prefetchers could trigger.
    const revertUrl = `${this.deps.config.BACKEND_API_LOGIN_REDIRECT_URI}/email-verification/revert?token=${encodeURIComponent(
      token,
    )}`;

    try {
      await this.deps.smtpTransport!.sendMail({
        from: createFromFormatter(this.deps.config)("MonitoRSS", "noreply"),
        to: oldEmail,
        subject: "Your MonitoRSS verified email was changed",
        html: this.renderEmail(verifiedEmailChangedTemplate, {
          oldEmail,
          newEmail,
          revertUrl,
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
