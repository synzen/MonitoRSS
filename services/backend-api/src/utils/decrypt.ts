import { createDecipheriv } from "crypto";

const decrypt = (input: string, hexKey: string) => {
  const [iv, text, authtag] = input.split(".");
  const key = Buffer.from(hexKey, "hex");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(authtag, "base64"));
  const decrpyted =
    decipher.update(text, "base64", "utf8") + decipher.final("utf8");

  return decrpyted;
};

export default decrypt;
