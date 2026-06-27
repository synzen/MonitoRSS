import { Type, type Static } from "@sinclair/typebox";

const EmailSchema = Type.String({
  maxLength: 254,
  pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
});

export const SendEmailVerificationBodySchema = Type.Object(
  {
    email: EmailSchema,
  },
  { additionalProperties: false },
);

export type SendEmailVerificationBody = Static<
  typeof SendEmailVerificationBodySchema
>;

export const ConfirmEmailVerificationBodySchema = Type.Object(
  {
    email: EmailSchema,
    code: Type.String({ pattern: "^[0-9]{6}$" }),
  },
  { additionalProperties: false },
);

export type ConfirmEmailVerificationBody = Static<
  typeof ConfirmEmailVerificationBodySchema
>;

export const RevertEmailVerificationBodySchema = Type.Object(
  {
    token: Type.String({ minLength: 1, maxLength: 1024 }),
  },
  { additionalProperties: false },
);

export type RevertEmailVerificationBody = Static<
  typeof RevertEmailVerificationBodySchema
>;
