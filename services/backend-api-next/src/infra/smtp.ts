import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { Config } from "../config";

export type SmtpTransport = nodemailer.Transporter<SMTPTransport.SentMessageInfo> | null;

export function createSmtpTransport(config: Config): SmtpTransport {
  const host = config.BACKEND_API_SMTP_HOST;
  const username = config.BACKEND_API_SMTP_USERNAME;
  const password = config.BACKEND_API_SMTP_PASSWORD;

  if (!host || !username || !password) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: 465,
    secure: true,
    auth: {
      user: username,
      pass: password,
    },
  });
}
