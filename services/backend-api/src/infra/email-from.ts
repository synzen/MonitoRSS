import type { Config } from "../config";

export type FormatFrom = (displayName: string, localPart: string) => string;

export function createFromFormatter(config: Config): FormatFrom {
  const override = config.BACKEND_API_SMTP_FROM;
  const domain = config.BACKEND_API_SMTP_FROM_DOMAIN;

  return (displayName, localPart) => {
    if (override) {
      return override;
    }
    if (!domain) {
      throw new Error(
        "createFromFormatter requires BACKEND_API_SMTP_FROM or BACKEND_API_SMTP_FROM_DOMAIN to be set",
      );
    }
    return `"${displayName}" <${localPart}@${domain}>`;
  };
}
