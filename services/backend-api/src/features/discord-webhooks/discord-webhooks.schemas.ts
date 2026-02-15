import { Type, type Static } from "@sinclair/typebox";

export const WebhookParamsSchema = Type.Object({
  id: Type.String(),
});
export type WebhookParams = Static<typeof WebhookParamsSchema>;
