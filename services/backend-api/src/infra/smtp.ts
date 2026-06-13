import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { Config } from "../config";

export type SmtpTransport =
  nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null;

export function createSmtpTransport(config: Config): SmtpTransport {
  const host = config.BACKEND_API_SMTP_HOST;
  const username = config.BACKEND_API_SMTP_USERNAME;
  const password = config.BACKEND_API_SMTP_PASSWORD;

  if (!host || !username || !password) {
    return null;
  }

  // Production default is implicit TLS on 465; both are overridable so a local
  // or test mailer can listen on a plain-SMTP port.
  const secure = config.BACKEND_API_SMTP_SECURE;

  return nodemailer.createTransport({
    host,
    port: config.BACKEND_API_SMTP_PORT ?? (secure ? 465 : 587),
    secure,
    auth: {
      user: username,
      pass: password,
    },
  });
}
