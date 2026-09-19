import { Type, type Static } from "@sinclair/typebox";

// The code is only required when the user has a verified email to confirm
// against; users without one delete on the session alone (see AccountService).
export const DeleteAccountBodySchema = Type.Object(
  {
    code: Type.Optional(Type.String({ pattern: "^[0-9]{6}$" })),
  },
  { additionalProperties: false },
);

export type DeleteAccountBody = Static<typeof DeleteAccountBodySchema>;
