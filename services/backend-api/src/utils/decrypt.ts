import { createDecipheriv } from "crypto";

const decrypt = (input: string, key: string) => {
  const [iv, text, authtag] = input.split(".");

  const decipher = createDecipheriv("aes-128-gcm", key, iv);
  decipher.setAuthTag(Buffer.from(authtag, "hex"));
  const decrpyted =
    decipher.update(text, "hex", "utf8") + decipher.final("utf8");

  return decrpyted;
};

export default decrypt;
