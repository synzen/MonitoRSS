import { createDecipheriv } from "crypto";

export function decrypt(input: string, hexKey: string): string {
  const [iv, text, authtag] = input.split(".");
  if (!iv || !text || !authtag) {
    throw new Error("Invalid encrypted input format");
  }
  const key = Buffer.from(hexKey, "hex");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authtag, "base64"));
  const decrypted =
    decipher.update(text, "base64", "utf8") + decipher.final("utf8");

  return decrypted;
}
