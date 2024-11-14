import { createDecipheriv } from "crypto";

const decrypt = (input: string, hexKey: string) => {
  const [iv, text, authtag] = input.split(".");
  const key = Buffer.from(hexKey, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authtag, "hex"));
  const decrpyted =
    decipher.update(text, "hex", "utf8") + decipher.final("utf8");

  return decrpyted;
};

export default decrypt;
