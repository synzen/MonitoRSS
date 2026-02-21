import { Type, type Static } from "@sinclair/typebox";

export const CreateDiscoverySearchEventBodySchema = Type.Object({
  searchTerm: Type.String({ minLength: 1, maxLength: 100 }),
  resultCount: Type.Integer({ minimum: 0 }),
});

export type CreateDiscoverySearchEventBody = Static<
  typeof CreateDiscoverySearchEventBodySchema
>;
