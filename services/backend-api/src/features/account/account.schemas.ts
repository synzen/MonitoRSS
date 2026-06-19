import { Type, type Static } from "@sinclair/typebox";

export const DeleteAccountBodySchema = Type.Object(
  {
    code: Type.String({ pattern: "^[0-9]{6}$" }),
  },
  { additionalProperties: false },
);

export type DeleteAccountBody = Static<typeof DeleteAccountBodySchema>;
