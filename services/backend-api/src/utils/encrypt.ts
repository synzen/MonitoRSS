import { createCipheriv, randomBytes } from "crypto";

const encrypt = (data: string, key: string) => {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-128-gcm", key, iv);
  const encrypted = cipher.update(data, "utf8", "hex") + cipher.final("hex");
  const authtag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}.${encrypted}.${authtag}`;
};

export default encrypt;
