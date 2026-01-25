import { createCipheriv, randomBytes } from "crypto";

export function encrypt(data: string, hexKey: string): string {
  const iv = randomBytes(16);
  const key = Buffer.from(hexKey, "hex");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted =
    cipher.update(data, "utf8", "base64") + cipher.final("base64");
  const authtag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${encrypted}.${authtag.toString("base64")}`;
}
